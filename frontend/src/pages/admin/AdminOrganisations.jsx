import React, { useEffect, useState, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { adminApi } from '../../api'
import { formatCents, formatDate, formatInt, formatNumber, planBadge, statusBadge } from './adminFormat'

const PLANS = ['starter', 'growth', 'enterprise']
const STATUSES = ['trialing', 'active', 'cancelled', 'suspended']

export default function AdminOrganisations() {
  const [filters, setFilters] = useState({ q: '', plan: '', ai: '', status: '' })
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = {}
      if (filters.q) params.q = filters.q
      if (filters.plan) params.plan = filters.plan
      if (filters.ai) params.ai = filters.ai
      if (filters.status) params.status = filters.status
      const res = await adminApi.listOrganisations(params)
      setRows(res.data?.organisations || [])
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load organisations')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { reload() }, [reload])

  return (
    <AdminLayout
      title="Organisations"
      subtitle="Every workspace on the platform — search, filter, and manage"
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={filters.q}
          onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
          placeholder="Search name or slug…"
          style={{ flex: 1, minWidth: 220, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem' }}
        />
        <select value={filters.plan} onChange={e => setFilters(f => ({ ...f, plan: e.target.value }))} style={selStyle}>
          <option value="">All plans</option>
          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={selStyle}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.ai} onChange={e => setFilters(f => ({ ...f, ai: e.target.value }))} style={selStyle}>
          <option value="">AI: any</option>
          <option value="on">AI on</option>
          <option value="off">AI off</option>
        </select>
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 12 }}>{err}</div>}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={thStyle}>Workspace</th>
              <th style={thStyle}>Plan</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>AI</th>
              <th style={thStyle}>Users</th>
              <th style={thStyle}>MRR</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 24, color: '#9ca3af', textAlign: 'center' }}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, color: '#9ca3af', textAlign: 'center' }}>No organisations match these filters.</td></tr>
            )}
            {rows.map(o => {
              const pb = planBadge(o.plan)
              const sb = statusBadge(o.subscription_status)
              return (
                <tr key={o.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#0c1446' }}>{o.name}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{o.slug}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...badgeStyle, background: pb.bg, color: pb.fg }}>{o.plan || 'trial'}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...badgeStyle, background: sb.bg, color: sb.fg }}>{o.subscription_status || 'active'}</span>
                  </td>
                  <td style={tdStyle}>
                    {o.ai_enabled ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ On</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Off</span>
                    )}
                  </td>
                  <td style={tdStyle}>{formatInt(o.user_count)}</td>
                  <td style={tdStyle}>{formatCents(o.mrr_pence)}</td>
                  <td style={{ ...tdStyle, color: '#6b7280' }}>{formatDate(o.created_at)}</td>
                  <td style={tdStyle}>
                    <button onClick={() => setSelectedId(o.id)} style={linkBtnStyle}>Manage →</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedId && <OrgDrawer orgId={selectedId} onClose={() => setSelectedId(null)} onChange={reload} />}
    </AdminLayout>
  )
}

// Detail drawer — slides in from the right. Chose a drawer over a dedicated
// /admin/orgs/:id page because admins usually flip through many orgs in
// sequence; keeping the list visible behind preserves their place.
function OrgDrawer({ orgId, onClose, onChange }) {
  const [detail, setDetail] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setErr('')
    try {
      const res = await adminApi.getOrganisation(orgId)
      setDetail(res.data)
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load organisation')
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  const patch = async (body) => {
    setSaving(true)
    setErr('')
    try {
      await adminApi.patchOrganisation(orgId, body)
      await load()
      onChange?.()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Backend returns a flat shape — no `.organisation` sub-object. The
  // `users`, `usage_30d`, `recent_audit` fields are spread alongside the
  // summary fields.
  const o = detail || {}
  const usage = o.usage_30d || {}

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 540, maxWidth: '96vw', background: '#fff', height: '100vh', overflowY: 'auto',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', padding: '20px 24px 32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Workspace</div>
            <h2 style={{ margin: '2px 0 0', fontSize: '1.3rem', fontWeight: 800, color: '#0c1446' }}>
              {o.name || '…'}
            </h2>
            <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>{o.slug}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.6rem', color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 12 }}>{err}</div>}

        {detail && (
          <>
            <Section title="AI add-on">
              <ToggleRow
                label="Enable AI features"
                sub="Turns on Ask Your Data, AI Insights, AI Narrative and related tools. Approving a pending AI request also flips this on."
                on={!!o.ai_enabled}
                disabled={saving}
                onToggle={v => patch({ ai_enabled: v })}
              />
              {o.ai_enabled_at && (
                <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: 6 }}>
                  Enabled {formatDate(o.ai_enabled_at)}
                </div>
              )}
            </Section>

            <Section title="Plan">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PLANS.map(p => (
                  <button key={p} disabled={saving}
                    onClick={() => patch({ plan: p })}
                    style={{
                      ...pillBtn,
                      background: o.plan === p ? '#6d28d9' : '#f3f4f6',
                      color: o.plan === p ? '#fff' : '#374151',
                    }}>
                    {p}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Subscription status">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} disabled={saving}
                    onClick={() => patch({ subscription_status: s })}
                    style={{
                      ...pillBtn,
                      background: o.subscription_status === s ? '#0c1446' : '#f3f4f6',
                      color: o.subscription_status === s ? '#fff' : '#374151',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Usage (last 30 days)">
              <KvRow k="AI tokens" v={formatNumber(usage.ai_tokens)} />
              <KvRow k="AI cost" v={formatCents(usage.ai_cost_cents)} />
              <KvRow k="File uploads" v={formatInt(usage.uploads)} />
            </Section>

            <Section title={`Users (${(o.users || []).length})`}>
              {(o.users || []).map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.88rem' }}>
                  <div>
                    <div style={{ color: '#0c1446' }}>{u.full_name || u.email}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{u.email}</div>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{u.role}</div>
                </div>
              ))}
            </Section>

            <Section title="Recent activity">
              {(o.recent_audit || []).slice(0, 10).map(a => (
                <div key={a.id} style={{ fontSize: '0.82rem', color: '#6b7280', padding: '4px 0' }}>
                  <span style={{ color: '#6d28d9', fontWeight: 600 }}>{a.action}</span>
                  {' · '}{a.detail}
                  <span style={{ marginLeft: 8, color: '#9ca3af' }}>{formatDate(a.created_at)}</span>
                </div>
              ))}
              {(!o.recent_audit || o.recent_audit.length === 0) && (
                <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No activity yet.</div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ color: '#374151', fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function KvRow({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.88rem' }}>
      <span style={{ color: '#6b7280' }}>{k}</span>
      <span style={{ color: '#0c1446', fontWeight: 600 }}>{v}</span>
    </div>
  )
}

function ToggleRow({ label, sub, on, onToggle, disabled }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#0c1446', fontSize: '0.9rem' }}>{label}</div>
        {sub && <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{sub}</div>}
      </div>
      <button
        onClick={() => onToggle(!on)}
        disabled={disabled}
        style={{
          width: 46, height: 26, background: on ? '#16a34a' : '#d1d5db',
          border: 'none', borderRadius: 13, position: 'relative', cursor: 'pointer',
          transition: 'all 0.15s', flexShrink: 0, opacity: disabled ? 0.6 : 1
        }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20,
          background: '#fff', borderRadius: '50%', transition: 'left 0.15s'
        }} />
      </button>
    </div>
  )
}

const thStyle = { padding: '11px 14px', fontWeight: 700 }
const tdStyle = { padding: '11px 14px', color: '#0c1446' }
const selStyle = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem', background: '#fff' }
const badgeStyle = { padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }
const linkBtnStyle = { background: 'none', border: 'none', color: '#6d28d9', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }
const pillBtn = { padding: '6px 14px', border: 'none', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }
