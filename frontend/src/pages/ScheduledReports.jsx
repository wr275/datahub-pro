/**
 * Scheduled Reports 2.0 — wired to the real backend (was entirely mocked in 1.0).
 *
 * New in 2.0:
 *   · Template picker (fetched from /templates — server is the source of truth)
 *   · File selector so a schedule is actually linked to a dataset
 *   · Conditional day-of-week / day-of-month inputs based on frequency
 *   · CSV attachment toggle + max-retries control
 *   · Delivery log modal per schedule (status, attempts, errors, trigger)
 *   · Send-now button with feedback
 *   · Next run timestamp shown in the table
 */
import React, { useEffect, useState } from 'react'
import { scheduledReportsApi, filesApi } from '../api'

const PINK = '#e91e8c'
const TEAL = '#0097b2'
const NAVY = '#0c1446'

const FREQUENCIES = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const EMPTY_FORM = {
  name: '',
  report_type: 'data_summary',
  frequency: 'weekly',
  day_of_week: 'Monday',
  day_of_month: 1,
  send_time: '08:00',
  recipients: '',
  file_id: '',
  attach_csv: false,
  max_retries: 2,
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: '0.875rem',
  background: '#fff',
  boxSizing: 'border-box',
}

const labelStyle = { fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }

function statusPill(status) {
  const map = {
    sent:      { bg: '#dcfce7', fg: '#166534' },
    failed:    { bg: '#fee2e2', fg: '#991b1b' },
    retrying:  { bg: '#fef3c7', fg: '#92400e' },
    skipped:   { bg: '#f3f4f6', fg: '#6b7280' },
    active:    { bg: '#dcfce7', fg: '#166534' },
    paused:    { bg: '#f3f4f6', fg: '#6b7280' },
  }
  const s = map[status] || { bg: '#e0e7ff', fg: '#3730a3' }
  return { background: s.bg, color: s.fg, padding: '3px 10px', borderRadius: 12, fontSize: '0.74rem', fontWeight: 700 }
}

function formatWhen(schedule) {
  const freq = schedule.frequency
  const time = schedule.send_time || '08:00'
  if (freq === 'daily')   return `Daily · ${time} UTC`
  if (freq === 'weekly')  return `${schedule.day_of_week || 'Monday'}s · ${time} UTC`
  if (freq === 'monthly') return `Day ${schedule.day_of_month || 1} · ${time} UTC`
  return time
}

function niceTemplate(id, templates) {
  const t = templates.find(x => x.id === id)
  return t ? t.name : id
}

function niceDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ───── Delivery log modal ─────

function DeliveryLog({ schedule, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    scheduledReportsApi.deliveries(schedule.id, 50)
      .then(r => { if (!cancelled) setRows(r.data || []) })
      .catch(() => { if (!cancelled) setErr('Failed to load delivery history.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [schedule.id])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(12,20,70,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 26, maxWidth: 820, width: '100%', maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(12,20,70,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Delivery log</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: NAVY }}>{schedule.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>Most recent 50 attempts, newest first.</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {loading && <div style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>Loading…</div>}
        {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>{err}</div>}

        {!loading && !err && rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
            No delivery attempts yet. The next run will appear here.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['When', 'Status', 'Attempt', 'Trigger', 'Rows', 'Details'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{niceDate(r.attempted_at)}</td>
                  <td style={{ padding: '9px 12px' }}><span style={statusPill(r.status)}>{r.status}</span></td>
                  <td style={{ padding: '9px 12px', color: '#6b7280' }}>#{r.attempt}</td>
                  <td style={{ padding: '9px 12px', color: '#6b7280' }}>{r.trigger}</td>
                  <td style={{ padding: '9px 12px', color: '#6b7280' }}>{r.rows_included ?? '—'}</td>
                  <td style={{ padding: '9px 12px', color: r.error_message ? '#991b1b' : '#6b7280', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.error_message || r.recipients || ''}>
                    {r.error_message || r.recipients || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ───── Create / edit form ─────

function ScheduleForm({ form, setForm, templates, files, onSave, onCancel, saving, editing }) {
  const selectedTemplate = templates.find(t => t.id === form.report_type)
  const fileRequired = selectedTemplate?.needs_file

  function update(patch) { setForm({ ...form, ...patch }) }

  const canSave = form.name.trim() && form.recipients.trim() && (!fileRequired || form.file_id) && !saving

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24, border: '1px solid ' + PINK + '20' }}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: 16, fontSize: '1rem' }}>
        {editing ? 'Edit schedule' : 'New scheduled report'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={labelStyle}>Schedule name</div>
          <input value={form.name} onChange={e => update({ name: e.target.value })} placeholder="e.g. Weekly Sales Summary" style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>Report template</div>
          <select value={form.report_type} onChange={e => update({ report_type: e.target.value })} style={inputStyle}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Linked data file {fileRequired ? '(required)' : '(optional)'}</div>
          <select value={form.file_id} onChange={e => update({ file_id: e.target.value })} style={inputStyle}>
            <option value="">— None —</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.original_filename || f.filename}</option>)}
          </select>
        </div>
      </div>

      {selectedTemplate?.desc && (
        <div style={{ background: '#f9fafb', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', color: '#4b5563', marginBottom: 14, lineHeight: 1.5 }}>
          <strong style={{ color: NAVY }}>{selectedTemplate.name}:</strong> {selectedTemplate.desc}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={labelStyle}>Frequency</div>
          <select value={form.frequency} onChange={e => update({ frequency: e.target.value })} style={inputStyle}>
            {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        {form.frequency === 'weekly' && (
          <div>
            <div style={labelStyle}>Day of week</div>
            <select value={form.day_of_week || 'Monday'} onChange={e => update({ day_of_week: e.target.value })} style={inputStyle}>
              {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        {form.frequency === 'monthly' && (
          <div>
            <div style={labelStyle}>Day of month (1–28)</div>
            <input type="number" min="1" max="28" value={form.day_of_month || 1}
              onChange={e => update({ day_of_month: Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 1)) })}
              style={inputStyle} />
          </div>
        )}
        <div>
          <div style={labelStyle}>Send time (UTC)</div>
          <input type="time" value={form.send_time || '08:00'} onChange={e => update({ send_time: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>Max retries on failure</div>
          <input type="number" min="0" max="5" value={form.max_retries}
            onChange={e => update({ max_retries: Math.max(0, Math.min(5, parseInt(e.target.value, 10) || 0)) })}
            style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={labelStyle}>Recipients (comma-separated)</div>
        <input value={form.recipients} onChange={e => update({ recipients: e.target.value })}
          placeholder="alice@acme.com, bob@acme.com" style={inputStyle} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#374151', marginBottom: 18, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.attach_csv} onChange={e => update({ attach_csv: e.target.checked })} />
        Attach the source data as a CSV file to the email
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSave} disabled={!canSave}
          style={{ padding: '9px 22px', background: canSave ? PINK : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: canSave ? 'pointer' : 'default', fontSize: '0.9rem' }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create schedule'}
        </button>
        <button onClick={onCancel} disabled={saving}
          style={{ padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ───── Page ─────

export default function ScheduledReports() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  const [templates, setTemplates] = useState([])
  const [files, setFiles] = useState([])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [logFor, setLogFor] = useState(null)

  async function loadAll() {
    setLoading(true); setErr('')
    try {
      const [schedResp, tmplResp, filesResp] = await Promise.all([
        scheduledReportsApi.list(),
        scheduledReportsApi.templates(),
        filesApi.list(),
      ])
      setSchedules(schedResp.data || [])
      setTemplates(tmplResp.data?.templates || [])
      setFiles(filesResp.data || [])
    } catch (e) {
      setErr('Failed to load scheduled reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  function startCreate() {
    setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); setInfo(''); setErr('')
  }

  function startEdit(s) {
    setEditingId(s.id)
    setForm({
      name: s.name || '',
      report_type: s.report_type || 'data_summary',
      frequency: s.frequency || 'weekly',
      day_of_week: s.day_of_week || 'Monday',
      day_of_month: s.day_of_month || 1,
      send_time: s.send_time || '08:00',
      recipients: s.recipients || '',
      file_id: s.file_id || '',
      attach_csv: !!s.attach_csv,
      max_retries: s.max_retries ?? 2,
    })
    setShowForm(true); setInfo(''); setErr('')
  }

  async function save() {
    setSaving(true); setErr('')
    try {
      const body = { ...form }
      // Trim null-ish conditional fields so backend ignores them for non-matching frequencies.
      if (form.frequency !== 'weekly')  body.day_of_week = null
      if (form.frequency !== 'monthly') body.day_of_month = null
      if (!body.file_id) body.file_id = null
      if (editingId) {
        await scheduledReportsApi.update(editingId, body)
        setInfo('Schedule updated.')
      } else {
        await scheduledReportsApi.create(body)
        setInfo('Schedule created.')
      }
      setShowForm(false); setEditingId(null); setForm(EMPTY_FORM)
      await loadAll()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(s) {
    try {
      await scheduledReportsApi.toggle(s.id)
      await loadAll()
    } catch { setErr('Toggle failed.') }
  }

  async function remove(s) {
    if (!confirm(`Delete "${s.name}"? This also removes its delivery history.`)) return
    try {
      await scheduledReportsApi.remove(s.id)
      await loadAll()
    } catch { setErr('Delete failed.') }
  }

  async function sendNow(s) {
    try {
      await scheduledReportsApi.sendNow(s.id)
      setInfo(`"${s.name}" queued for immediate delivery. Check the delivery log in a few seconds.`)
      setTimeout(loadAll, 2000)
    } catch { setErr('Send-now failed.') }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: NAVY }}>Scheduled Reports</h1>
        <p style={{ margin: 0, color: '#6b7280' }}>
          Automate report delivery with templates, retries on failure, and a full audit log. Emails are sent via the platform SendGrid account.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
          {loading ? 'Loading…' : `${schedules.length} schedule${schedules.length === 1 ? '' : 's'}`}
        </div>
        {!showForm && (
          <button onClick={startCreate}
            style={{ padding: '9px 20px', background: PINK, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            + New schedule
          </button>
        )}
      </div>

      {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 8, color: '#dc2626', fontSize: '0.85rem', marginBottom: 14 }}>{typeof err === 'string' ? err : JSON.stringify(err)}</div>}
      {info && <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 12, borderRadius: 8, color: '#065f46', fontSize: '0.85rem', marginBottom: 14 }}>{info}</div>}

      {showForm && (
        <ScheduleForm
          form={form} setForm={setForm}
          templates={templates} files={files}
          editing={!!editingId} saving={saving}
          onSave={save}
          onCancel={() => { setShowForm(false); setEditingId(null) }}
        />
      )}

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Name', 'Template', 'When', 'Recipients', 'Next run', 'Last delivery', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s, i) => {
                const d = s.deliveries || {}
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: NAVY }}>
                      {s.name}
                      {s.attach_csv && <span title="CSV attached" style={{ marginLeft: 8, fontSize: '0.68rem', color: TEAL, fontWeight: 700, background: TEAL + '22', padding: '1px 6px', borderRadius: 10 }}>CSV</span>}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{niceTemplate(s.report_type, templates)}</td>
                    <td style={{ padding: '12px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{formatWhen(s)}</td>
                    <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.recipients}>{s.recipients}</td>
                    <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{niceDate(s.next_run_at)}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {d.last_status ? (
                        <span style={statusPill(d.last_status)}>{d.last_status}</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Never sent</span>
                      )}
                      {d.failed_attempts > 0 && (
                        <span title={`${d.failed_attempts} failure${d.failed_attempts === 1 ? '' : 's'} total`} style={{ marginLeft: 6, fontSize: '0.72rem', color: '#991b1b', fontWeight: 600 }}>
                          ({d.failed_attempts} fail)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={statusPill(s.status)}>{s.status}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => sendNow(s)} title="Send immediately"
                          style={{ padding: '5px 10px', background: PINK + '22', color: PINK, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
                          Send now
                        </button>
                        <button onClick={() => setLogFor(s)} title="View delivery log"
                          style={{ padding: '5px 10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
                          Log
                        </button>
                        <button onClick={() => startEdit(s)} title="Edit"
                          style={{ padding: '5px 10px', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
                          Edit
                        </button>
                        <button onClick={() => toggleStatus(s)}
                          style={{ padding: '5px 10px', background: s.status === 'active' ? '#fef9c3' : '#dcfce7', color: s.status === 'active' ? '#854d0e' : '#166534', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
                          {s.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                        <button onClick={() => remove(s)}
                          style={{ padding: '5px 10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && schedules.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            No scheduled reports yet. Click "New schedule" to create one.
          </div>
        )}
      </div>

      {logFor && <DeliveryLog schedule={logFor} onClose={() => setLogFor(null)} />}
    </div>
  )
}
