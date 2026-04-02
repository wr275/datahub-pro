import React, { useState, useEffect } from 'react'
import { scheduledReportsApi, filesApi } from '../api'
import toast from 'react-hot-toast'

const REPORT_TYPES = [
  'Data Summary', 'Auto Report', 'Executive Dashboard',
  'AI Narrative', 'Anomaly Detection', 'Variance Analysis',
  'Forecasting', 'KPI Dashboard',
]

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const EMPTY_FORM = {
  name: '', report_type: 'Data Summary', frequency: 'Weekly',
  day_of_week: 'Monday', day_of_month: 1, send_time: '08:00',
  recipients: '', file_id: '',
}

export default function ScheduledReports() {
  const [schedules, setSchedules] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    Promise.all([
      scheduledReportsApi.list(),
      filesApi.list(),
    ]).then(([sRes, fRes]) => {
      setSchedules(sRes.data)
      setFiles(fRes.data || [])
    }).catch(() => toast.error('Failed to load schedules'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    if (!form.name || !form.recipients) {
      toast.error('Name and recipients are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        report_type: (form.report_type || 'Data Summary').toLowerCase().replace(/ /g, '_'),
        frequency: form.frequency.toLowerCase(),
        day_of_week: form.frequency === 'Weekly' ? form.day_of_week : null,
        day_of_month: form.frequency === 'Monthly' ? Number(form.day_of_month) : null,
        send_time: form.send_time,
        recipients: form.recipients,
        file_id: form.file_id || null,
      }
      const res = await scheduledReportsApi.create(payload)
      setSchedules(prev => [res.data, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
      toast.success('Schedule created')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create schedule')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id) {
    try {
      const res = await scheduledReportsApi.toggle(id)
      setSchedules(prev => prev.map(s => s.id === id ? res.data : s))
    } catch {
      toast.error('Failed to update schedule')
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete schedule "${name}"?`)) return
    try {
      await scheduledReportsApi.remove(id)
      setSchedules(prev => prev.filter(s => s.id !== id))
      toast.success('Schedule deleted')
    } catch {
      toast.error('Failed to delete schedule')
    }
  }

  async function handleSendNow(id, name) {
    try {
      await scheduledReportsApi.sendNow(id)
      toast.success(`"${name}" queued for immediate delivery`)
    } catch {
      toast.error('Failed to trigger report')
    }
  }

  function freqLabel(s) {
    if (s.frequency === 'weekly') return `Weekly · ${s.day_of_week}s`
    if (s.frequency === 'monthly') return `Monthly · Day ${s.day_of_month}`
    return 'Daily'
  }

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>Loading schedules…</div>
  )

  return (
    <div style={{ padding: 32, maxWidth: 1040, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Scheduled Reports</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>
        Automate report delivery — your team gets a data summary email on your schedule.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '9px 20px', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          + New Schedule
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 28, border: '1px solid #fce7f3' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 18, fontSize: '1rem' }}>New Scheduled Report</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 18 }}>
            {/* Name */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Schedule Name *</div>
              <input style={inp} placeholder="e.g. Weekly Sales Summary" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            {/* Report type */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Report Type</div>
              <select style={inp} value={form.report_type} onChange={e => setForm({ ...form, report_type: e.target.value })}>
                {REPORT_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* Linked file */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Data File (optional)</div>
              <select style={inp} value={form.file_id} onChange={e => setForm({ ...form, file_id: e.target.value })}>
                <option value="">— No file —</option>
                {files.map(f => <option key={f.id} value={f.id}>{f.original_filename || f.filename}</option>)}
              </select>
            </div>
            {/* Frequency */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Frequency</div>
              <select style={inp} value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
                {['Daily', 'Weekly', 'Monthly'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            {/* Day of week (weekly) */}
            {form.frequency === 'Weekly' && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Day of Week</div>
                <select style={inp} value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })}>
                  {DAYS_OF_WEEK.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            )}
            {/* Day of month (monthly) */}
            {form.frequency === 'Monthly' && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Day of Month</div>
                <input style={inp} type="number" min={1} max={28} value={form.day_of_month}
                  onChange={e => setForm({ ...form, day_of_month: Number(e.target.value) })} />
              </div>
            )}
            {/* Time */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Send Time (UTC)</div>
              <input style={inp} type="time" value={form.send_time} onChange={e => setForm({ ...form, send_time: e.target.value })} />
            </div>
            {/* Recipients */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Recipients * <span style={{ fontWeight: 400, color: '#9ca3af' }}>(comma-separated)</span></div>
              <input style={inp} placeholder="alice@company.com, bob@company.com" value={form.recipients}
                onChange={e => setForm({ ...form, recipients: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleCreate} disabled={saving}
              style={{ padding: '9px 22px', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Creating…' : 'Create Schedule'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              style={{ padding: '9px 18px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Name', 'Report', 'Schedule', 'Recipients', 'Last Sent', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedules.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0c1446' }}>{s.name}</td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>
                  {(s.report_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>
                  {freqLabel(s)} <span style={{ color: '#9ca3af' }}>· {s.send_time} UTC</span>
                </td>
                <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '0.8rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.recipients}
                </td>
                <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: '0.8rem' }}>
                  {s.last_run_at ? new Date(s.last_run_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700,
                    background: s.status === 'active' ? '#dcfce7' : '#f3f4f6',
                    color: s.status === 'active' ? '#166534' : '#6b7280',
                  }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSendNow(s.id, s.name)}
                      style={{ padding: '5px 10px', background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                      Send Now
                    </button>
                    <button onClick={() => handleToggle(s.id)}
                      style={{ padding: '5px 10px', background: s.status === 'active' ? '#fef9c3' : '#dcfce7', color: s.status === 'active' ? '#854d0e' : '#166534', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                      {s.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => handleDelete(s.id, s.name)}
                      style={{ padding: '5px 10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem' }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schedules.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📅</div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>No scheduled reports yet</div>
            <div style={{ fontSize: '0.875rem' }}>Create a schedule to automatically email data summaries to your team.</div>
          </div>
        )}
      </div>
    </div>
  )
}
