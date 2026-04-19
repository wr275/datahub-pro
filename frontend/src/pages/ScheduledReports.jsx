import React, { useState } from 'react'

const MOCK_SCHEDULES = [
  { id: 1, name: 'Weekly Sales Summary', report: 'Auto Report', frequency: 'Weekly', day: 'Monday', time: '08:00', recipients: 'team@company.com', status: 'active', lastRun: '2025-01-13' },
  { id: 2, name: 'Monthly KPI Dashboard', report: 'Executive Dashboard', frequency: 'Monthly', day: '1st', time: '07:00', recipients: 'exec@company.com', status: 'active', lastRun: '2025-01-01' },
  { id: 3, name: 'Daily Anomaly Alert', report: 'Anomaly Detection', frequency: 'Daily', day: 'Every day', time: '06:00', recipients: 'alerts@company.com', status: 'paused', lastRun: '2025-01-10' },
]

export default function ScheduledReports() {
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', report: '', frequency: 'Weekly', day: 'Monday', time: '08:00', recipients: '' })

  function toggleStatus(id) {
    setSchedules(schedules.map(s => s.id === id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s))
  }

  function deleteSchedule(id) { setSchedules(schedules.filter(s => s.id !== id)) }

  function addSchedule() {
    if (!form.name || !form.report || !form.recipients) return
    setSchedules([...schedules, { ...form, id: Date.now(), status: 'active', lastRun: '—' }])
    setForm({ name: '', report: '', frequency: 'Weekly', day: 'Monday', time: '08:00', recipients: '' })
    setShowForm(false)
  }

  const reports = ['Auto Report', 'Executive Dashboard', 'AI Narrative', 'Anomaly Detection', 'Variance Analysis', 'Forecasting', 'KPI Dashboard']

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Scheduled Reports</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Automate report delivery on a recurring schedule</p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '9px 20px', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>+ New Schedule</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24, border: '1px solid #e91e8c20' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>New Scheduled Report</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              ['Schedule Name', <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekly Sales" style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />],
              ['Report Type', <select value={form.report} onChange={e => setForm({ ...form, report: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{reports.map(r => <option key={r} value={r}>{r}</option>)}</select>],
              ['Frequency', <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>{['Daily', 'Weekly', 'Monthly'].map(f => <option key={f} value={f}>{f}</option>)}</select>],
              ['Time', <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }} />],
              ['Recipients (email)', <input value={form.recipients} onChange={e => setForm({ ...form, recipients: e.target.value })} placeholder="email@company.com" style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />],
            ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addSchedule} style={{ padding: '9px 20px', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Create Schedule</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead><tr style={{ background: '#f9fafb' }}>{['Name', 'Report', 'Frequency', 'Time', 'Recipients', 'Last Run', 'Status', 'Actions'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
          <tbody>
            {schedules.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0c1446' }}>{s.name}</td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>{s.report}</td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>{s.frequency}</td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>{s.day}, {s.time}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.8rem' }}>{s.recipients}</td>
                <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: '0.8rem' }}>{s.lastRun}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700, background: s.status === 'active' ? '#dcfce7' : '#f3f4f6', color: s.status === 'active' ? '#166534' : '#6b7280' }}>{s.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleStatus(s.id)} style={{ padding: '5px 10px', background: s.status === 'active' ? '#fef9c3' : '#dcfce7', color: s.status === 'active' ? '#854d0e' : '#166534', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>{s.status === 'active' ? 'Pause' : 'Resume'}</button>
                    <button onClick={() => deleteSchedule(s.id)} style={{ padding: '5px 10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schedules.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No scheduled reports yet. Click "New Schedule" to create one.</div>}
      </div>
    </div>
  )
}
