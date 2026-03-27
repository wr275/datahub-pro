import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pipelinesApi, filesApi } from '../api'

const STEP_TYPES = [
  { value: 'remove_nulls', label: 'Remove Nulls', icon: '🧹', tooltip: 'Remove rows where selected columns have empty or null values. Leave column list empty to check all columns.' },
  { value: 'rename_columns', label: 'Rename Columns', icon: '✏️', tooltip: 'Rename one or more column headers. Enter pairs as old_name:new_name, one per line.' },
  { value: 'filter_rows', label: 'Filter Rows', icon: '🔍', tooltip: 'Keep only rows matching a condition. Choose a column, operator (equals, contains, greater_than, etc.) and a value to compare against.' },
  { value: 'join_datasets', label: 'Join Datasets', icon: '🔀', tooltip: 'Merge a second dataset into this one using a shared key column. Choose inner join (only matching rows) or left join (keep all rows from first dataset).' },
]

function Tooltip({ text }) {
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0,
      background: '#0c1446', color: '#fff', fontSize: '0.75rem', padding: '8px 12px',
      borderRadius: 8, zIndex: 200, pointerEvents: 'none',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', marginBottom: 8,
      maxWidth: 280, lineHeight: 1.5,
    }}>
      {text}
      <div style={{ position: 'absolute', top: '100%', left: 16, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0c1446' }} />
    </div>
  )
}

function StepConfig({ step, onChange, files }) {
  const type = step.type
  const cfg = step.config || {}
  const set = (key, val) => onChange({ ...step, config: { ...cfg, [key]: val } })

  if (type === 'remove_nulls') {
    return (
      <div>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
          Columns to check (comma-separated, or leave empty for all)
        </label>
        <input value={(cfg.columns || []).join(', ')} onChange={e => set('columns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="e.g. email, phone (or leave empty)"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', boxSizing: 'border-box' }} />
      </div>
    )
  }

  if (type === 'rename_columns') {
    const mappingText = Object.entries(cfg.mapping || {}).map(([k, v]) => `${k}:${v}`).join('\n')
    return (
      <div>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
          Rename mappings — one per line as <code>old_name:new_name</code>
        </label>
        <textarea rows={3} value={mappingText}
          onChange={e => {
            const mapping = {}
            e.target.value.split('\n').forEach(line => {
              const [k, ...rest] = line.split(':')
              if (k && rest.length) mapping[k.trim()] = rest.join(':').trim()
            })
            set('mapping', mapping)
          }}
          placeholder="first_name:First Name&#10;order_id:Order ID"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }} />
      </div>
    )
  }

  if (type === 'filter_rows') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Column</label>
          <input value={cfg.column || ''} onChange={e => set('column', e.target.value)} placeholder="column_name"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Operator</label>
          <select value={cfg.operator || 'equals'} onChange={e => set('operator', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', boxSizing: 'border-box', background: '#fff' }}>
            <option value="equals">equals</option>
            <option value="not_equals">not equals</option>
            <option value="contains">contains</option>
            <option value="not_contains">not contains</option>
            <option value="greater_than">greater than</option>
            <option value="less_than">less than</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Value</label>
          <input value={cfg.value || ''} onChange={e => set('value', e.target.value)} placeholder="value"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', boxSizing: 'border-box' }} />
        </div>
      </div>
    )
  }

  if (type === 'join_datasets') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Second Dataset</label>
          <select value={cfg.file_id || ''} onChange={e => set('file_id', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', background: '#fff', boxSizing: 'border-box' }}>
            <option value="">Select file…</option>
            {(files || []).map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Left Key</label>
          <input value={cfg.join_key_left || ''} onChange={e => set('join_key_left', e.target.value)} placeholder="id"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Right Key</label>
          <input value={cfg.join_key_right || ''} onChange={e => set('join_key_right', e.target.value)} placeholder="id"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Join Type</label>
          <select value={cfg.join_type || 'inner'} onChange={e => set('join_type', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8eaf4', borderRadius: 7, fontSize: '0.85rem', background: '#fff', boxSizing: 'border-box' }}>
            <option value="inner">Inner</option>
            <option value="left">Left</option>
          </select>
        </div>
      </div>
    )
  }

  return null
}

function RunModal({ pipeline, files, onClose }) {
  const navigate = useNavigate()
  const [fileId, setFileId] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handlePreview = async () => {
    if (!fileId) return
    setPreviewing(true)
    setError(null)
    try {
      const resp = await pipelinesApi.preview(pipeline.id, { file_id: fileId, preview_only: true })
      setPreview(resp.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const handleRun = async () => {
    if (!fileId) return
    setRunning(true)
    setError(null)
    try {
      const resp = await pipelinesApi.run(pipeline.id, { file_id: fileId })
      setResult(resp.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 860, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 900, color: '#0c1446', fontSize: '1.1rem' }}>▶ Run Pipeline: {pipeline.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 2 }}>{pipeline.steps?.length || 0} steps · Run count: {pipeline.run_count || 0}</div>
          </div>
          <button onClick={onClose} style={{ padding: '6px 14px', background: '#f3f4f6', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, color: '#6b7280' }}>✕ Close</button>
        </div>

        {!result ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>Select Input Dataset</label>
              <select value={fileId} onChange={e => { setFileId(e.target.value); setPreview(null) }}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8eaf4', borderRadius: 9, fontSize: '0.9rem', background: '#fff' }}>
                <option value="">Choose a file…</option>
                {files.map(f => <option key={f.id} value={f.id}>{f.filename} ({(f.rows || 0).toLocaleString()} rows)</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button onClick={handlePreview} disabled={!fileId || previewing}
                style={{ padding: '10px 20px', background: fileId ? '#0097b2' : '#e5e7eb', color: fileId ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, cursor: fileId ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.85rem' }}>
                {previewing ? '⟳ Loading…' : '👁 Preview (50 rows)'}
              </button>
              <button onClick={handleRun} disabled={!fileId || running}
                style={{ padding: '10px 20px', background: fileId ? '#0c1446' : '#e5e7eb', color: fileId ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, cursor: fileId ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.85rem' }}>
                {running ? '⟳ Running…' : '▶ Run & Save Output'}
              </button>
            </div>

            {error && <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem', marginBottom: 16 }}>❌ {error}</div>}

            {preview && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
                  Preview: {preview.total_rows.toLocaleString()} rows after transform (input: {preview.input_rows.toLocaleString()})
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e8eaf4' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: '#f8f9ff' }}>
                        {preview.columns.map(col => (
                          <th key={col} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e8eaf4', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f2f8', background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                          {preview.columns.map(col => (
                            <td key={col} style={{ padding: '7px 10px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0c1446', marginBottom: 8 }}>Pipeline Complete!</div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 24 }}>
              {result.message}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => navigate(`/analytics/${result.file_id}`)}
                style={{ padding: '11px 24px', background: '#0c1446', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}>
                📊 Analyse Output
              </button>
              <button onClick={() => navigate('/files')}
                style={{ padding: '11px 24px', background: '#f8f9ff', color: '#0c1446', border: '1px solid #e8eaf4', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}>
                View in Files
              </button>
              <button onClick={onClose}
                style={{ padding: '11px 24px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DataPipelines() {
  const navigate = useNavigate()
  const [pipelines, setPipelines] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | {pipeline obj}
  const [running, setRunning] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', steps: [] })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    Promise.all([
      pipelinesApi.list().then(r => setPipelines(r.data || [])),
      filesApi.list().then(r => setFiles(r.data || [])),
    ]).finally(() => setLoading(false))
  }, [])

  const loadPipelines = () => pipelinesApi.list().then(r => setPipelines(r.data || []))

  const startNew = () => {
    setForm({ name: '', description: '', steps: [] })
    setEditing('new')
  }

  const startEdit = (p) => {
    setForm({ name: p.name, description: p.description || '', steps: p.steps || [] })
    setEditing(p)
  }

  const addStep = (type) => {
    setForm(f => ({ ...f, steps: [...f.steps, { type, config: {} }] }))
  }

  const updateStep = (idx, updated) => {
    setForm(f => ({ ...f, steps: f.steps.map((s, i) => i === idx ? updated : s) }))
  }

  const removeStep = (idx) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }))
  }

  const moveStep = (idx, dir) => {
    setForm(f => {
      const steps = [...f.steps]
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= steps.length) return f
      ;[steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]]
      return { ...f, steps }
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      if (editing === 'new') {
        await pipelinesApi.create(form)
        setMessage({ type: 'success', text: 'Pipeline created!' })
      } else {
        await pipelinesApi.update(editing.id, form)
        setMessage({ type: 'success', text: 'Pipeline updated!' })
      }
      await loadPipelines()
      setEditing(null)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this pipeline?')) return
    try {
      await pipelinesApi.remove(id)
      await loadPipelines()
    } catch {
      setMessage({ type: 'error', text: 'Delete failed' })
    }
  }

  if (editing !== null) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0c1446' }}>
              {editing === 'new' ? '+ New Pipeline' : `✏️ Edit: ${editing.name}`}
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.85rem' }}>Build a sequence of transforms to run on any dataset</p>
          </div>
          <button onClick={() => setEditing(null)} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: '#6b7280' }}>← Back</button>
        </div>

        {message && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', color: message.type === 'success' ? '#166534' : '#991b1b', fontSize: '0.85rem' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>Pipeline Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Clean Orders Data"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8eaf4', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this pipeline do?"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8eaf4', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

          {/* Steps */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Transform Steps</div>

            {form.steps.length === 0 && (
              <div style={{ background: '#f8f9ff', borderRadius: 10, border: '1px dashed #d1d5db', padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', marginBottom: 16 }}>
                No steps yet. Add a transform below to get started.
              </div>
            )}

            {form.steps.map((step, idx) => {
              const stepMeta = STEP_TYPES.find(s => s.value === step.type) || {}
              return (
                <div key={idx} style={{ background: '#f8f9ff', borderRadius: 10, border: '1px solid #e8eaf4', padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1rem' }}>{stepMeta.icon}</span>
                      <span style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.85rem' }}>Step {idx + 1}: {stepMeta.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                        style={{ padding: '4px 8px', background: '#fff', border: '1px solid #e8eaf4', borderRadius: 5, cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', color: '#6b7280' }}>↑</button>
                      <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === form.steps.length - 1}
                        style={{ padding: '4px 8px', background: '#fff', border: '1px solid #e8eaf4', borderRadius: 5, cursor: idx === form.steps.length - 1 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', color: '#6b7280' }}>↓</button>
                      <button type="button" onClick={() => removeStep(idx)}
                        style={{ padding: '4px 8px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', fontSize: '0.75rem', color: '#ef4444' }}>Remove</button>
                    </div>
                  </div>
                  <StepConfig step={step} onChange={updated => updateStep(idx, updated)} files={files} />
                </div>
              )
            })}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>Add a step:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STEP_TYPES.map(st => (
                  <div key={st.value} style={{ position: 'relative' }}
                    onMouseEnter={() => setTooltip(st.value)}
                    onMouseLeave={() => setTooltip(null)}>
                    {tooltip === st.value && <Tooltip text={st.tooltip} />}
                    <button type="button" onClick={() => addStep(st.value)}
                      style={{ padding: '8px 14px', background: '#fff', border: '1px solid #e8eaf4', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {st.icon} {st.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setEditing(null)}
              style={{ padding: '11px 24px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '11px 28px', background: saving ? '#9ca3af' : '#0c1446', color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'wait' : 'pointer', fontWeight: 700 }}>
              {saving ? 'Saving…' : (editing === 'new' ? 'Create Pipeline' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0c1446' }}>⚙️ Data Pipelines</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Build repeatable transform sequences — clean, filter, rename, and join your data automatically
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/hub')} style={{ padding: '8px 16px', background: '#f8f9ff', border: '1px solid #e8eaf4', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280' }}>
            ← Back to Hub
          </button>
          <button onClick={startNew} style={{ padding: '10px 20px', background: '#0c1446', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
            + New Pipeline
          </button>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`, color: message.type === 'success' ? '#166534' : '#991b1b', fontSize: '0.9rem' }}>
          {message.text}
        </div>
      )}

      {/* How it works */}
      <div style={{ background: '#f8f9ff', borderRadius: 12, border: '1px solid #e8eaf4', padding: '16px 20px', marginBottom: 28 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1446', marginBottom: 8 }}>💡 How Pipelines Work</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {STEP_TYPES.map(st => (
            <div key={st.value} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 8 }}
              onMouseEnter={() => setTooltip('info_' + st.value)}
              onMouseLeave={() => setTooltip(null)}>
              {tooltip === 'info_' + st.value && <Tooltip text={st.tooltip} />}
              <span style={{ fontSize: '1rem' }}>{st.icon}</span>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>{st.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>hover for details</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading…</div>
      ) : pipelines.length === 0 ? (
        <div style={{ background: '#f8f9ff', borderRadius: 14, border: '1px dashed #d1d5db', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚙️</div>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8 }}>No pipelines yet</div>
          <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 20 }}>Create a pipeline to automate repeated data transforms</div>
          <button onClick={startNew} style={{ padding: '11px 24px', background: '#0c1446', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}>
            + Create Your First Pipeline
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pipelines.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8eaf4', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                <div style={{ width: 40, height: 40, background: '#0c144618', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>⚙️</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.95rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                    {p.steps?.length || 0} steps
                    {p.description && ` · ${p.description}`}
                    {p.run_count > 0 && ` · Ran ${p.run_count} time${p.run_count !== 1 ? 's' : ''}`}
                    {p.last_run_at && ` · Last: ${new Date(p.last_run_at).toLocaleDateString()}`}
                  </div>
                  {p.steps?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {p.steps.map((s, i) => {
                        const meta = STEP_TYPES.find(t => t.value === s.type) || {}
                        return (
                          <span key={i} style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#f8f9ff', border: '1px solid #e8eaf4', borderRadius: 12, color: '#6b7280', fontWeight: 600 }}>
                            {meta.icon} {meta.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setRunning(p)}
                  style={{ padding: '8px 16px', background: '#0c1446', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                  ▶ Run
                </button>
                <button onClick={() => startEdit(p)}
                  style={{ padding: '8px 14px', background: '#f8f9ff', color: '#0c1446', border: '1px solid #e8eaf4', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  ✏️ Edit
                </button>
                <button onClick={() => handleDelete(p.id)}
                  style={{ padding: '8px 12px', background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {running && (
        <RunModal
          pipeline={running}
          files={files}
          onClose={() => { setRunning(null); loadPipelines() }}
        />
      )}
    </div>
  )
}
