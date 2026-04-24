import React, { useState, useEffect, useMemo } from 'react'
import { usersApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const VALID_ROLES = ['owner', 'admin', 'member', 'viewer']

// Tiny CSV parser — handles quoted fields and commas inside quotes. Good
// enough for the small paste-a-CSV use case; not trying to be a full parser.
function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cur += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { row.push(cur); cur = '' }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(cur); cur = ''
        if (row.some(c => c.trim() !== '')) rows.push(row)
        row = []
      } else cur += ch
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row) }
  return rows
}

// Parse a pasted/uploaded CSV into {email, full_name, role} records.
// Accepts column order "email[,full_name][,role]" with or without a header row.
function csvToInvites(text) {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  // Header detection: first row has no @ in column 0 → treat as header
  let headerCols = null
  let dataRows = rows
  if (!rows[0][0].includes('@')) {
    headerCols = rows[0].map(c => c.trim().toLowerCase())
    dataRows = rows.slice(1)
  }
  return dataRows.map(r => {
    if (headerCols) {
      const rec = {}
      headerCols.forEach((h, i) => { rec[h] = (r[i] || '').trim() })
      return {
        email: rec.email || '',
        full_name: rec.full_name || rec.name || '',
        role: (rec.role || 'member').toLowerCase(),
      }
    }
    return {
      email: (r[0] || '').trim(),
      full_name: (r[1] || '').trim(),
      role: ((r[2] || 'member').trim() || 'member').toLowerCase(),
    }
  }).filter(i => i.email)
}

function daysUntil(iso) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.round(ms / 86400000)
}

// ────────────────────────────────────────────────────────────────────────────

function BulkInviteModal({ onClose, onDone }) {
  const [text, setText] = useState('email,full_name,role\n')
  const [preview, setPreview] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)

  useEffect(() => { setPreview(csvToInvites(text)) }, [text])

  const submit = async () => {
    if (preview.length === 0) { toast.error('No valid email rows found'); return }
    setSubmitting(true)
    try {
      const res = await usersApi.inviteBulk(preview)
      setResults(res.data)
      if (res.data.errors === 0) {
        toast.success(`Sent ${res.data.sent + res.data.created} invites`)
      } else {
        toast((t) => (
          <span>Sent {res.data.sent + res.data.created}, {res.data.errors} failed — see details below</span>
        ))
      }
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk invite failed')
    } finally {
      setSubmitting(false)
    }
  }

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result || ''))
    reader.readAsText(f)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,20,70,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 720, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0c1446' }}>Bulk invite</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 4 }}>
              Paste a CSV below, or upload a .csv file. First column is email; full_name and role are optional.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ fontSize: '0.85rem' }} />
        </div>

        <textarea
          className="form-input"
          style={{ width: '100%', height: 160, fontFamily: 'monospace', fontSize: '0.82rem' }}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="email,full_name,role&#10;alice@example.com,Alice Smith,member&#10;bob@example.com,Bob Jones,admin"
        />

        {preview.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0c1446', marginBottom: 6 }}>
              Preview: {preview.length} invite{preview.length === 1 ? '' : 's'}
            </div>
            <div style={{ maxHeight: 120, overflow: 'auto', fontSize: '0.78rem', color: '#374151' }}>
              {preview.slice(0, 20).map((p, i) => (
                <div key={i}>{p.email} <span style={{ color: '#9ca3af' }}>· {p.role}</span>{p.full_name ? <span style={{ color: '#6b7280' }}> ({p.full_name})</span> : null}</div>
              ))}
              {preview.length > 20 && <div style={{ color: '#9ca3af' }}>…and {preview.length - 20} more</div>}
            </div>
          </div>
        )}

        {results && (
          <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#14532d', marginBottom: 6 }}>
              Results: {results.sent + results.created} created · {results.errors} errors
            </div>
            <div style={{ maxHeight: 160, overflow: 'auto', fontSize: '0.78rem' }}>
              {results.results.map((r, i) => (
                <div key={i} style={{ color: r.status === 'error' ? '#991b1b' : '#14532d' }}>
                  {r.email} — {r.status === 'error' ? `error: ${r.error}` : r.status}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>Close</button>
          <button onClick={submit} className="btn-primary" disabled={submitting || preview.length === 0}>
            {submitting ? 'Sending…' : `Send ${preview.length} invites`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

export default function Team() {
  const { user } = useAuth()
  const [team, setTeam] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteName, setInviteName] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')  // 'active' | 'pending'
  const [bulkOpen, setBulkOpen] = useState(false)
  // Track per-row pending action so we can show spinners / disable buttons.
  const [busyId, setBusyId] = useState(null)

  const canInvite = user?.role === 'owner' || user?.role === 'admin' || user?.is_superuser
  const isOwner = user?.role === 'owner' || user?.is_superuser

  const refresh = () => {
    usersApi.team()
      .then(res => setTeam(res.data || []))
      .catch(() => toast.error('Failed to load team'))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail) return
    try {
      const res = await usersApi.invite({ email: inviteEmail, role: inviteRole, full_name: inviteName })
      const data = res?.data || {}
      toast.success(data.message || ('Invitation sent to ' + inviteEmail))
      if (data.email_sent === false && data.accept_url) {
        toast((t) => (
          <span style={{ fontSize: '0.85rem' }}>
            Email delivery not configured. Share this link:<br/>
            <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{data.accept_url}</code>
          </span>
        ), { duration: 12000 })
      }
      setInviteEmail('')
      setInviteName('')
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invite failed')
    }
  }

  const handleResend = async (m) => {
    setBusyId(m.id)
    try {
      const res = await usersApi.resendInvite(m.id)
      const data = res?.data || {}
      toast.success(data.message || 'Invite resent')
      if (data.email_sent === false && data.accept_url) {
        toast((t) => (
          <span style={{ fontSize: '0.85rem' }}>
            Email delivery not configured. New link:<br/>
            <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{data.accept_url}</code>
          </span>
        ), { duration: 12000 })
      }
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Resend failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (m) => {
    if (!window.confirm(`Cancel pending invite for ${m.email}?`)) return
    setBusyId(m.id)
    try {
      await usersApi.cancelInvite(m.id)
      toast.success('Invite cancelled')
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cancel failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleRoleChange = async (m, newRole) => {
    if (newRole === m.role) return
    // Guardrail for owner demotion from the UI
    if (m.role === 'owner' && newRole !== 'owner') {
      if (!window.confirm(`Demote ${m.email} from owner to ${newRole}? Make sure another owner exists.`)) return
    }
    setBusyId(m.id)
    try {
      await usersApi.updateRole(m.id, newRole)
      toast.success(`${m.email} is now ${newRole}`)
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Role update failed')
    } finally {
      setBusyId(null)
    }
  }

  const { activeMembers, pendingMembers } = useMemo(() => {
    return {
      activeMembers: team.filter(m => m.status === 'active'),
      pendingMembers: team.filter(m => m.status === 'pending'),
    }
  }, [team])

  const roleColors = { owner: 'badge-navy', admin: 'badge-magenta', member: 'badge-green', viewer: 'badge-orange' }

  const renderRoleCell = (m) => {
    // Only owners/admins can edit roles. Admins can't edit owners. Self can't demote from owner.
    const canEdit = canInvite
      && m.id !== user?.id
      && !(user?.role === 'admin' && m.role === 'owner')
      && m.status === 'active'
    if (!canEdit) {
      return <span className={'badge ' + (roleColors[m.role] || 'badge-navy')}>{m.role}</span>
    }
    return (
      <select
        value={m.role}
        onChange={e => handleRoleChange(m, e.target.value)}
        disabled={busyId === m.id}
        className="form-input"
        style={{ padding: '4px 8px', fontSize: '0.8rem', width: 110 }}
      >
        {VALID_ROLES.map(r => {
          // Admins can't promote anyone TO owner.
          if (r === 'owner' && !isOwner) return null
          return <option key={r} value={r}>{r}</option>
        })}
      </select>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446' }}>Team</h1>
        <p style={{ color: '#4a5280', marginTop: 4 }}>Manage your workspace members, roles and pending invites</p>
      </div>

      {canInvite && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0c1446' }}>Invite team member</h2>
            <button onClick={() => setBulkOpen(true)} className="btn-secondary" style={{ fontSize: '0.82rem' }}>
              Bulk invite (CSV)
            </button>
          </div>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="form-input" style={{ flex: '1 1 220px' }} type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
            <input className="form-input" style={{ flex: '1 1 160px' }} type="text" placeholder="Full name (optional)" value={inviteName} onChange={e => setInviteName(e.target.value)} />
            <select className="form-input" style={{ width: 130 }} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
              {isOwner && <option value="owner">Owner</option>}
            </select>
            <button type="submit" className="btn-primary">Send invite</button>
          </form>
        </div>
      )}

      {/* Tab switcher — pending only shown if there are any */}
      <div className="card">
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #e2e5f1', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => setTab('active')}
            style={{
              background: tab === 'active' ? '#eef2ff' : 'transparent', color: tab === 'active' ? '#0c1446' : '#6b7280',
              border: 'none', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            Members ({activeMembers.length})
          </button>
          <button
            onClick={() => setTab('pending')}
            style={{
              background: tab === 'pending' ? '#eef2ff' : 'transparent', color: tab === 'pending' ? '#0c1446' : '#6b7280',
              border: 'none', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            Pending invites {pendingMembers.length > 0 && <span style={{ background: '#e91e8c', color: '#fff', padding: '1px 7px', borderRadius: 10, fontSize: '0.7rem', marginLeft: 4 }}>{pendingMembers.length}</span>}
          </button>
        </div>

        {loading ? <p style={{ padding: 24, color: '#8b92b3' }}>Loading...</p> : (
          tab === 'active' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e5f1' }}>
                  {['Name', 'Email', 'Role', 'Last login', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4a5280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeMembers.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #e2e5f1' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0c1446' }}>
                      {m.full_name || '—'}
                      {m.id === user?.id && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#9ca3af', fontWeight: 400 }}>(you)</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4a5280' }}>{m.email}</td>
                    <td style={{ padding: '12px 16px' }}>{renderRoleCell(m)}</td>
                    <td style={{ padding: '12px 16px', color: '#4a5280' }}>{m.last_login ? new Date(m.last_login).toLocaleDateString('en-GB') : 'Never'}</td>
                    <td style={{ padding: '12px 16px', color: '#4a5280' }}>{m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : '—'}</td>
                  </tr>
                ))}
                {activeMembers.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, color: '#9ca3af', textAlign: 'center' }}>No active members yet.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e5f1' }}>
                  {['Email', 'Role', 'Invited', 'Expires', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4a5280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingMembers.map(m => {
                  const daysLeft = daysUntil(m.invite_expires_at)
                  const expired = m.invite_expired || (daysLeft !== null && daysLeft < 0)
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #e2e5f1' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0c1446' }}>
                        {m.email}
                        {m.full_name && <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>({m.full_name})</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={'badge ' + (roleColors[m.role] || 'badge-navy')}>{m.role}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4a5280' }}>
                        {m.invited_at ? new Date(m.invited_at).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {expired ? (
                          <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.8rem' }}>Expired</span>
                        ) : daysLeft !== null ? (
                          <span style={{ color: daysLeft <= 1 ? '#dc2626' : (daysLeft <= 3 ? '#d97706' : '#4a5280'), fontSize: '0.82rem' }}>
                            in {daysLeft} day{daysLeft === 1 ? '' : 's'}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {canInvite && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleResend(m)}
                              disabled={busyId === m.id}
                              className="btn-secondary"
                              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                            >
                              {busyId === m.id ? '…' : 'Resend'}
                            </button>
                            <button
                              onClick={() => handleCancel(m)}
                              disabled={busyId === m.id}
                              style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {pendingMembers.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, color: '#9ca3af', textAlign: 'center' }}>No pending invites.</td></tr>
                )}
              </tbody>
            </table>
          )
        )}
      </div>

      {bulkOpen && <BulkInviteModal onClose={() => setBulkOpen(false)} onDone={refresh} />}
    </div>
  )
}
