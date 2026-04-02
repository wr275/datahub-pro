/**
 * api.test.js — unit tests for the shared axios instance in src/api.js
 *
 * Strategy: extract interceptor handlers directly from the axios instance
 * after module import, rather than making real HTTP calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock localStorage before importing api.js ──────────────────────────────
const _ls = (() => {
  let store = {}
  return {
    getItem:    vi.fn(k => store[k] ?? null),
    setItem:    vi.fn((k, v) => { store[k] = String(v) }),
    removeItem: vi.fn(k => { delete store[k] }),
    clear ()    { store = {}; vi.clearAllMocks() },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: _ls, writable: false })

// ── Mock window.location ───────────────────────────────────────────────────
const _loc = { href: '' }
Object.defineProperty(globalThis, 'window', { value: { location: _loc }, writable: true })

// ── Import after mocks are in place ───────────────────────────────────────
import api, { authApi, filesApi, analyticsApi, billingApi, usersApi } from '../../api'

// ── Helpers ───────────────────────────────────────────────────────────────
const reqHandler  = () => api.interceptors.request.handlers.find(Boolean)
const respHandler = () => api.interceptors.response.handlers.find(Boolean)

// ════════════════════════════════════════════════════════════════════════════
describe('axios instance', () => {
  it('sets JSON Content-Type by default', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('registers at least one request interceptor', () => {
    expect(api.interceptors.request.handlers.filter(Boolean).length).toBeGreaterThan(0)
  })

  it('registers at least one response interceptor', () => {
    expect(api.interceptors.response.handlers.filter(Boolean).length).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('request interceptor — Bearer token', () => {
  beforeEach(() => _ls.clear())

  it('attaches Authorization header when access_token is in localStorage', async () => {
    _ls.getItem.mockImplementation(k => k === 'access_token' ? 'tok-abc' : null)
    const result = await reqHandler().fulfilled({ headers: {} })
    expect(result.headers.Authorization).toBe('Bearer tok-abc')
  })

  it('leaves Authorization unset when no token stored', async () => {
    const result = await reqHandler().fulfilled({ headers: {} })
    expect(result.headers.Authorization).toBeUndefined()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('response interceptor — 401 handling', () => {
  beforeEach(() => { _ls.clear(); _loc.href = '' })

  it('removes access_token from localStorage on 401', async () => {
    try { await respHandler().rejected({ response: { status: 401 } }) } catch {}
    expect(_ls.removeItem).toHaveBeenCalledWith('access_token')
  })

  it('removes user from localStorage on 401', async () => {
    try { await respHandler().rejected({ response: { status: 401 } }) } catch {}
    expect(_ls.removeItem).toHaveBeenCalledWith('user')
  })

  it('redirects to /login on 401', async () => {
    try { await respHandler().rejected({ response: { status: 401 } }) } catch {}
    expect(_loc.href).toBe('/login')
  })

  it('re-throws the original error', async () => {
    const err = { response: { status: 401 } }
    await expect(respHandler().rejected(err)).rejects.toEqual(err)
  })

  it('does NOT redirect on 403 or 500', async () => {
    for (const status of [403, 500]) {
      _loc.href = ''
      try { await respHandler().rejected({ response: { status } }) } catch {}
      expect(_loc.href).toBe('')
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('exported API namespaces', () => {
  it('authApi — login, register, me, changePassword', () => {
    expect(typeof authApi.login).toBe('function')
    expect(typeof authApi.register).toBe('function')
    expect(typeof authApi.me).toBe('function')
    expect(typeof authApi.changePassword).toBe('function')
  })

  it('filesApi — list, upload, download, delete', () => {
    expect(typeof filesApi.list).toBe('function')
    expect(typeof filesApi.upload).toBe('function')
    expect(typeof filesApi.download).toBe('function')
    expect(typeof filesApi.delete).toBe('function')
  })

  it('analyticsApi — preview, summary, kpis', () => {
    expect(typeof analyticsApi.preview).toBe('function')
    expect(typeof analyticsApi.summary).toBe('function')
    expect(typeof analyticsApi.kpis).toBe('function')
  })

  it('billingApi — plans, createCheckout, portal, cancel', () => {
    expect(typeof billingApi.plans).toBe('function')
    expect(typeof billingApi.createCheckout).toBe('function')
    expect(typeof billingApi.portal).toBe('function')
    expect(typeof billingApi.cancel).toBe('function')
  })

  it('usersApi — team, invite, auditLog', () => {
    expect(typeof usersApi.team).toBe('function')
    expect(typeof usersApi.invite).toBe('function')
    expect(typeof usersApi.auditLog).toBe('function')
  })
})
