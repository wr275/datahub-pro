/**
 * auth.test.jsx — tests for AuthContext and Login page
 *
 * Mocks: api.js (authApi), react-router-dom, react-hot-toast
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mock localStorage ──────────────────────────────────────────────────────
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
Object.defineProperty(globalThis, 'window',       { value: { location: { href: '' } }, writable: true })

// ── Mock api.js ────────────────────────────────────────────────────────────
vi.mock('../../api', () => ({
  default: {},
  authApi: {
    me:    vi.fn(),
    login: vi.fn(),
  },
}))

// ── Mock react-router-dom ─────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}))

// ── Mock react-hot-toast ──────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

// ── Imports after mocks ───────────────────────────────────────────────────
import { authApi } from '../../api'
import { AuthProvider, useAuth } from '../../context/AuthContext'
import Login from '../../pages/Login'
import toast from 'react-hot-toast'

// ── Helper ────────────────────────────────────────────────────────────────
function renderWithAuth (ui) {
  return render(<AuthProvider>{ui}</AuthProvider>)
}

// ════════════════════════════════════════════════════════════════════════════
describe('AuthContext — on mount', () => {
  beforeEach(() => { _ls.clear(); vi.clearAllMocks() })

  it('calls authApi.me() exactly once on mount', async () => {
    authApi.me.mockResolvedValueOnce({ data: null })
    renderWithAuth(<div />)
    await waitFor(() => expect(authApi.me).toHaveBeenCalledTimes(1))
  })

  it('exposes user data when me() resolves successfully', async () => {
    const userData = { id: '1', email: 'alice@test.com', name: 'Alice' }
    authApi.me.mockResolvedValueOnce({ data: userData })

    function Spy () {
      const { user, loading } = useAuth()
      if (loading) return <span>loading</span>
      return <span data-testid="email">{user?.email}</span>
    }

    renderWithAuth(<Spy />)
    await waitFor(() =>
      expect(screen.getByTestId('email').textContent).toBe('alice@test.com')
    )
  })

  it('clears access_token from localStorage when me() rejects', async () => {
    authApi.me.mockRejectedValueOnce(new Error('401'))
    renderWithAuth(<div />)
    await waitFor(() =>
      expect(_ls.removeItem).toHaveBeenCalledWith('access_token')
    )
  })

  it('clears user from localStorage when me() rejects', async () => {
    authApi.me.mockRejectedValueOnce(new Error('401'))
    renderWithAuth(<div />)
    await waitFor(() =>
      expect(_ls.removeItem).toHaveBeenCalledWith('user')
    )
  })

  it('sets loading=false after me() resolves', async () => {
    authApi.me.mockResolvedValueOnce({ data: { id: '1' } })
    function Spy () {
      const { loading } = useAuth()
      return <span data-testid="loading">{String(loading)}</span>
    }
    renderWithAuth(<Spy />)
    expect(screen.getByTestId('loading').textContent).toBe('true')
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    )
  })

  it('sets loading=false after me() rejects', async () => {
    authApi.me.mockRejectedValueOnce(new Error('fail'))
    function Spy () {
      const { loading } = useAuth()
      return <span data-testid="loading">{String(loading)}</span>
    }
    renderWithAuth(<Spy />)
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('AuthContext — login() and logout()', () => {
  beforeEach(() => { _ls.clear(); vi.clearAllMocks() })

  it('login() stores access_token in localStorage', async () => {
    authApi.me.mockResolvedValueOnce({ data: null })
    function Spy () {
      const { login, loading } = useAuth()
      if (loading) return null
      return (
        <button onClick={() => login({ access_token: 'tok-xyz', user: { id: '2' } })}>
          login
        </button>
      )
    }
    renderWithAuth(<Spy />)
    await waitFor(() => screen.getByRole('button'))
    await act(async () => { await userEvent.click(screen.getByRole('button')) })
    expect(_ls.setItem).toHaveBeenCalledWith('access_token', 'tok-xyz')
  })

  it('login() stores user object in localStorage', async () => {
    authApi.me.mockResolvedValueOnce({ data: null })
    const user = { id: '2', email: 'bob@test.com' }
    function Spy () {
      const { login, loading } = useAuth()
      if (loading) return null
      return <button onClick={() => login({ access_token: 'tok', user })}>login</button>
    }
    renderWithAuth(<Spy />)
    await waitFor(() => screen.getByRole('button'))
    await act(async () => { await userEvent.click(screen.getByRole('button')) })
    expect(_ls.setItem).toHaveBeenCalledWith('user', JSON.stringify(user))
  })

  it('logout() removes access_token and user from localStorage', async () => {
    authApi.me.mockResolvedValueOnce({ data: { id: '1' } })
    function Spy () {
      const { logout, loading } = useAuth()
      if (loading) return null
      return <button onClick={logout}>logout</button>
    }
    renderWithAuth(<Spy />)
    await waitFor(() => screen.getByRole('button'))
    await act(async () => { await userEvent.click(screen.getByRole('button')) })
    expect(_ls.removeItem).toHaveBeenCalledWith('access_token')
    expect(_ls.removeItem).toHaveBeenCalledWith('user')
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('Login page — rendering', () => {
  beforeEach(() => {
    _ls.clear(); vi.clearAllMocks(); mockNavigate.mockReset()
    authApi.me.mockResolvedValue({ data: null })
  })

  it('renders an email input', async () => {
    renderWithAuth(<Login />)
    await waitFor(() =>
      expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument()
    )
  })

  it('renders a password input', async () => {
    renderWithAuth(<Login />)
    await waitFor(() =>
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    )
  })

  it('renders the Sign in submit button', async () => {
    renderWithAuth(<Login />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    )
  })

  it('renders a link to /register', async () => {
    renderWithAuth(<Login />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /request access/i })
      expect(link).toHaveAttribute('href', '/register')
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('Login page — form submission', () => {
  beforeEach(() => {
    _ls.clear(); vi.clearAllMocks(); mockNavigate.mockReset()
    authApi.me.mockResolvedValue({ data: null })
  })

  it('calls authApi.login with the entered email and password', async () => {
    authApi.login.mockResolvedValueOnce({
      data: { access_token: 'tok', user: { id: '1' } },
    })
    renderWithAuth(<Login />)
    await waitFor(() => screen.getByPlaceholderText('you@company.com'))

    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'user@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'Password1!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'user@test.com', password: 'Password1!',
      })
    )
  })

  it('navigates to /dashboard on successful login', async () => {
    authApi.login.mockResolvedValueOnce({
      data: { access_token: 'tok', user: { id: '1' } },
    })
    renderWithAuth(<Login />)
    await waitFor(() => screen.getByRole('button', { name: /sign in/i }))

    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'user@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'Password1!')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows an error toast when login fails', async () => {
    authApi.login.mockRejectedValueOnce({
      response: { data: { detail: 'Invalid credentials' } },
    })
    renderWithAuth(<Login />)
    await waitFor(() => screen.getByRole('button', { name: /sign in/i }))

    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'bad@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials')
    )
  })

  it('shows fallback error toast when response has no detail', async () => {
    authApi.login.mockRejectedValueOnce({ response: {} })
    renderWithAuth(<Login />)
    await waitFor(() => screen.getByRole('button', { name: /sign in/i }))

    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'x@x.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Login failed')
    )
  })
})
