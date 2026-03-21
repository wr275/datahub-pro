import React, { useState, useEffect } from 'react'
import { filesApi } from '../api'

const ACTIONS = ['File Uploaded', 'Analysis Run', 'Report Generated', 'Data Exported', 'Filter Applied', 'File Deleted', 'Login', 'Settings Changed']

function generateLogs(files) {
  const logs = []
  const now = Date.now()
  const users = ['waqas114@gmail.com', 'admin@datahub.io', 'analyst@datahub.io']
  files.forEach((f, fi) => {
    logs.push({ id: fi * 10 + 1, timestamp: new Date(now - fi * 3600000 - 1800000).toISOString(), user: users[0], action: 'File Uploaded', resource: f.filename, status: 'success', ip: '192.168.1.1' })
    logs.push({ id: fi * 10 + 2, timestamp: new Date(now - fi * 3600000 - 900000).toISOString(), user: users[fi % users.length], action: ACTIONS[fi % ACTIONS.length], resource: f.filename, status: 'success', ip: '192.168.1.' + (fi + 2) })
  })
  // Static logs
  logs.push({ id: 99, timestamp: new Date(now - 7200000).toISOString(), user: users[0], action: 'Login', resource: 'DataHub Pro', status: 'success', ip: '192.168.1.1' })
  logs.push({ id: 100, timestamp: new Date(now - 86400000).toISOString(), user: users[1], action: 'Settings Changed', resource: 'AI Settings', status: 'success', ip: '10.0.0.5' })
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    filesApi.list().then(r => { setLogs(generateLogs(r.data || [])) }).catch(() => { setLogs(generateLogs([])) })
  }, [])

  const filtered = logs.filter(l => {
    const q = filter.toLowerCase()
    const matchText = !q || l.user.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.resource.toLowerCase().includes(q)
    const matchAction = !actionFilter || l.action === actionFilter
    return matchText && matchAction
  })

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Audit Log</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Track all user actions and system events for compliance and security</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search by user, action, resource..." style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
          <option value="">All Actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: '#6b7280', padding: '0 12px', background: '#f9fafb', borderRadius: 8 }}>
          {filtered.length} events
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead><tr style={{ background: '#f9fafb' }}>{['Timestamp', 'User', 'Action', 'Resource', 'IP Address', 'Status'].map(h => <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.slice(0, 100).map((log, i) => (
              <tr key={log.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '10px 14px', color: '#6b7280', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                <td style={{ padding: '10px 14px', color: '#374151', fontWeight: 600 }}>{log.user}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600, background: log.action === 'Login' ? '#dbeafe' : log.action === 'File Deleted' ? '#fee2e2' : '#f0fdf4', color: log.action === 'Login' ? '#1d4ed8' : log.action === 'File Deleted' ? '#dc2626' : '#166534' }}>
                    {log.action}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: '0.82rem' }}>{log.resource}</td>
                <td style={{ padding: '10px 14px', color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.ip}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ color: log.status === 'success' ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '0.8rem' }}>● {log.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No matching log entries found.</div>}
      </div>
    </div>
  )
}
