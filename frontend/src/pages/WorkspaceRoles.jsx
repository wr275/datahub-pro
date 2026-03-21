import React, { useState } from 'react'

const INITIAL_MEMBERS = [
  { id: 1, name: 'Waqas Rafique', email: 'waqas114@gmail.com', role: 'Owner', status: 'active', joined: '2024-01-01' },
  { id: 2, name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Admin', status: 'active', joined: '2024-03-15' },
  { id: 3, name: 'Mike Chen', email: 'mike@company.com', role: 'Analyst', status: 'active', joined: '2024-06-20' },
  { id: 4, name: 'Emma Davis', email: 'emma@company.com', role: 'Viewer', status: 'invited', joined: '2025-01-10' },
]

const ROLES = ['Owner', 'Admin', 'Analyst', 'Viewer']
const PERMISSIONS = {
  Owner: ['Upload files', 'Delete files', 'Run all analyses', 'Manage users', 'Change settings', 'View audit log', 'Export data', 'Create reports'],
  Admin: ['Upload files', 'Delete files', 'Run all analyses', 'Manage users', 'View audit log', 'Export data', 'Create reports'],
  Analyst: ['Upload files', 'Run all analyses', 'Export data', 'Create reports'],
  Viewer: ['View dashboards', 'View reports'],
}

const ROLE_COLORS = { Owner: '#e91e8c', Admin: '#0097b2', Analyst: '#10b981', Viewer: '#f59e0b' }

export default function WorkspaceRoles() {
  const [members, setMembers] = useState(INITIAL_MEMBERS)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Analyst')
  const [selectedRole, setSelectedRole] = useState('Analyst')

  function invite() {
    if (!inviteEmail) return
    setMembers([...members, { id: Date.now(), name: inviteEmail.split('@')[0], email: inviteEmail, role: inviteRole, status: 'invited', joined: new Date().toISOString().slice(0, 10) }])
    setInviteEmail('')
  }

  function changeRole(id, newRole) {
    setMembers(members.map(m => m.id === id ? { ...m, role: newRole } : m))
  }

  function removeMember(id) {
    setMembers(members.filter(m => m.id !== id))
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Workspace & Roles</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Manage team members and their permissions</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Invite Team Member</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              {ROLES.filter(r => r !== 'Owner').map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={invite} disabled={!inviteEmail} style={{ padding: '9px 20px', background: inviteEmail ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: inviteEmail ? 'pointer' : 'default' }}>Invite</button>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Role Explorer</div>
          <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', marginBottom: 10 }}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PERMISSIONS[selectedRole]?.map(p => <span key={p} style={{ padding: '4px 8px', background: ROLE_COLORS[selectedRole] + '20', color: ROLE_COLORS[selectedRole], borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>✓ {p}</span>)}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>{members.length} Team Members</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead><tr style={{ background: '#f9fafb' }}>{['Member', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: ROLE_COLORS[m.role] + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: ROLE_COLORS[m.role], fontSize: '0.9rem' }}>{m.name.charAt(0).toUpperCase()}</div>
                    <span style={{ fontWeight: 600, color: '#0c1446' }}>{m.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{m.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <select value={m.role} onChange={e => changeRole(m.id, e.target.value)} disabled={m.role === 'Owner'} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem', fontWeight: 600, color: ROLE_COLORS[m.role], background: ROLE_COLORS[m.role] + '15', cursor: m.role === 'Owner' ? 'not-allowed' : 'pointer' }}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700, background: m.status === 'active' ? '#dcfce7' : '#fef9c3', color: m.status === 'active' ? '#166534' : '#854d0e' }}>{m.status}</span>
                </td>
                <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: '0.82rem' }}>{m.joined}</td>
                <td style={{ padding: '12px 16px' }}>
                  {m.role !== 'Owner' && <button onClick={() => removeMember(m.id)} style={{ padding: '5px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
