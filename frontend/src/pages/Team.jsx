import React, { useState, useEffect } from 'react'
import { usersApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Team() {
  const { user } = useAuth()
  const [team, setTeam] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [loading, setLoading] = useState(true)
  const canInvite = user?.role === 'owner' || user?.role === 'admin'

  useEffect(() => { usersApi.team().then(res => setTeam(res.data)).catch(() => {}).finally(() => setLoading(false)) }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail) return
    try {
      const res = await usersApi.invite({ email: inviteEmail, role: inviteRole })
      const data = res?.data || {}
      toast.success(data.message || ('Invitation sent to ' + inviteEmail))
      if (data.email_sent === false && data.accept_url) {
        // Email couldn't be delivered — show the accept URL so the inviter
        // can share it manually.
        toast((t) => (
          <span style={{ fontSize: '0.85rem' }}>
            Email delivery not configured. Share this link:<br/>
            <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{data.accept_url}</code>
          </span>
        ), { duration: 12000 })
      }
      setInviteEmail('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invite failed')
    }
  }

  const roleColors = { owner: 'badge-navy', admin: 'badge-magenta', member: 'badge-green', viewer: 'badge-orange' }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446' }}>Team</h1>
        <p style={{ color: '#4a5280', marginTop: 4 }}>Manage your workspace members and roles</p>
      </div>

      {canInvite && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Invite Team Member</h2>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input className="form-input" style={{ flex: '1 1 240px' }} type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
            <select className="form-input" style={{ width: 140 }} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" className="btn-primary">Send Invite</button>
          </form>
        </div>
      )}

      <div className="card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e5f1' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0c1446' }}>Members ({team.length})</h2>
        </div>
        {loading ? <p style={{ padding: 24, color: '#8b92b3' }}>Loading...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e5f1' }}>
                {['Name', 'Email', 'Role', 'Last Login', 'Joined'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4a5280', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #e2e5f1' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0c1446' }}>{m.full_name || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#4a5280' }}>{m.email}</td>
                  <td style={{ padding: '12px 16px' }}><span className={'badge ' + (roleColors[m.role] || 'badge-navy')}>{m.role}</span></td>
                  <td style={{ padding: '12px 16px', color: '#4a5280' }}>{m.last_login ? new Date(m.last_login).toLocaleDateString('en-GB') : 'Never'}</td>
                  <td style={{ padding: '12px 16px', color: '#4a5280' }}>{new Date(m.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
