import React, { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { adminApi } from '../../api'
import { formatDate, formatInt } from './adminFormat'

export default function AdminUsers() {
  // Filters use the shape the backend expects — notably `status=active|suspended`
  // rather than a boolean, because the /users endpoint aliases it to
  // `status_` server-side.
  const [filters, setFilters] = useState({ q: '', role: '', status: '' })
  const [data, setData] = useState({ users: [], totals: {} })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null) // { user, field, next }

  const reload = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = {}
      if (filters.q) params.q = filters.q
      if (filters.role) params.role = filters.role
      if (filters.status) params.status = filters.status
      const res = await adminApi.listUsers(params)
      setData(res.data || { users: [], totals: {} })
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { reload() }, [reload])

  const submitConfirm = async () => {
    if (!confirm) return
    try {
      await adminApi.patchUser(confirm.user.id, { [confirm.field]: confirm.next })
      setConfirm(null)
      reload()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Update failed')
      setConfirm(null)
    }
  }

  const t = data.totals || {}

  return (
    <AdminLayout
      title="Users"
      subtitle="Every user across every workspace — suspend, grant platform-admin access"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10, marginBottom: 16 }}>
        <Stat label="Total users" value={formatInt(t.all)} />
        <Stat label="Active" value={formatInt(t.active)} tint="#16a34a" />
        <Stat label="Superusers" value={formatInt(t.superusers)} tint="#6d28d9" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={filters.q}
          onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
          placeholder="Search email, name or organisation…"
          style={{ flex: 1, minWidth: 240, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem' }}
        />
        <select value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value }))} style={selStyle}>
          <option value="">All roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={selStyle}>
          <option value="">All users</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 12 }}>{err}</div>}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Workspace</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last login</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>}
            {!loading && data.users.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No users match.</td></tr>}
            {data.users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, color: '#0c1446' }}>{u.full_name || u.email}</span>
                    {u.is_superuser && <span style={{ padding: '1px 7px', background: '#ede9fe', color: '#6d28d9', borderRadius: 10, fontSize: '0.65rem', fontWeight: 800 }}>SUPER</span>}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{u.email}</div>
                </td>
                <td style={{ ...tdStyle, color: '#6b7280' }}>{u.organisation_name || '—'}</td>
                <td style={tdStyle}>{u.role}</td>
                <td style={tdStyle}>
                  {u.is_active ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Active</span> : <span style={{ color: '#dc2626', fontWeight: 600 }}>Suspended</span>}
                </td>
                <td style={{ ...tdStyle, color: '#6b7280' }}>{formatDate(u.last_login)}</td>
                <td style={tdStyle}>
                  <button onClick={() => setConfirm({ user: u, field: 'is_active', next: !u.is_active })} style={actionBtn(u.is_active ? '#dc2626' : '#16a34a')}>
                    {u.is_active ? 'Suspend' : 'Reactivate'}
                  </button>
                  <button onClick={() => setConfirm({ user: u, field: 'is_superuser', next: !u.is_superuser })} style={actionBtn(u.is_superuser ? '#6b7280' : '#6d28d9')}>
                    {u.is_superuser ? 'Revoke superuser' : 'Grant superuser'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmModal
          title={
            confirm.field === 'is_active'
              ? (confirm.next ? 'Reactivate user' : 'Suspend user')
              : (confirm.next ? 'Grant superuser access' : 'Revoke superuser access')
          }
          body={
            confirm.field === 'is_active'
              ? (confirm.next
                  ? `${confirm.user.email} will regain access to their workspace.`
                  : `${confirm.user.email} will be logged out and blocked from logging back in.`)
              : (confirm.next
                  ? `${confirm.user.email} will get full platform-admin powers — see every workspace, every user, and every billing record.`
                  : `${confirm.user.email} will lose access to the Platform Admin dashboard.`)
          }
          danger={(confirm.field === 'is_active' && !confirm.next) || (confirm.field === 'is_superuser' && !confirm.next)}
          onCancel={() => setConfirm(null)}
          onConfirm={submitConfirm}
        />
      )}
    </AdminLayout>
  )
}

function Stat({ label, value, tint = '#6b7280' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1446', marginTop: 3 }}>{value}</div>
    </div>
  )
}

function ConfirmModal({ title, body, danger, onCancel, onConfirm }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0c1446' }}>{title}</h3>
        <p style={{ color: '#374151', fontSize: '0.92rem', marginTop: 10, lineHeight: 1.45 }}>{body}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: danger ? '#dc2626' : '#6d28d9', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

const thStyle = { padding: '11px 14px', fontWeight: 700 }
const tdStyle = { padding: '11px 14px', color: '#0c1446' }
const selStyle = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem', background: '#fff' }
const actionBtn = (color) => ({
  background: 'none', border: `1px solid ${color}33`, color, borderRadius: 6,
  padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', marginRight: 6
})
