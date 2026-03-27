import { useState, useEffect } from 'react'
import { pipelinesApi, filesApi } from '../api'

const STEP_TYPES = [
  { value: 'remove_nulls', label: 'Remove Empty Rows', desc: 'Remove rows where selected columns are empty', icon: '🧹' },
  { value: 'rename_columns', label: 'Rename Columns', desc: 'Rename one or more column headers', icon: '✏️' },
  { value: 'filter_rows', label: 'Filter Rows', desc: 'Keep only rows that match a condition', icon: '🔍' },
  { value: 'join_datasets', label: 'Join Datasets', desc: 'Merge another dataset by a shared key column', icon: '🔗' },
]

const OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than']

function StepConfig({ step, onChange }) {
  const cfg = step.config || {}

  if (step.type === 'remove_nulls') {
    return (
      <div>
        <label style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Columns to check (comma-separated, leave blank for all)</label>
        <input value={(cfg.columns || []).join(', ')} onChange={e => onChange({ ...step, config: { columns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} placeholder="e.g. price, email" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'6px 10px', color:'#fff', boxSizing:'border-box' }} />
      </div>
    )
  }

  if (step.type === 'rename_columns') {
    const mappingStr = Object.entries(cfg.mapping || {}).map(([k,v]) => k + ':' + v).join(', ')
    return (
      <div>
        <label style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Rename pairs (old:new, comma-separated)</label>
        <input value={mappingStr} onChange={e => {
          const mapping = {}
          e.target.value.split(',').forEach(pair => {
            const [k, v] = pair.split(':').map(s => s.trim())
            if (k && v) mapping[k] = v
          })
          onChange({ ...step, config: { mapping } })
        }} placeholder="e.g. old_name:new_name, col2:column2" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'6px 10px', color:'#fff', boxSizing:'border-box' }} />
      </div>
    )
  }

  if (step.type === 'filter_rows') {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <div>
          <label style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Column</label>
          <input value={cfg.column || ''} onChange={e => onChange({ ...step, config: { ...cfg, column: e.target.value } })} placeholder="column name" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'6px 10px', color:'#fff', boxSizing:'border-box' }} />
        </div>
        <div>
          <label style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Operator</label>
          <select value={cfg.operator || 'equals'} onChange={e => onChange({ ...step, config: { ...cfg, operator: e.target.value } })} style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'6px 10px', color:'#fff', boxSizing:'border-box' }}>
            {['equals','not_equals','contains','not_contains','greater_than','less_than'].map(op => <option key={op} value={op}>{op.replace('_',' ')}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Value</label>
          <input value={cfg.value || ''} onChange={e => onChange({ ...step, config: { ...cfg, value: e.target.value } })} placeholder="value" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'6px 10px', color:'#fff', boxSizing:'border-box' }} />
        </div>
      </div>
    )
  }

  if (step.type === 'join_datasets') {
    return (
      <div>
        <label style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Join key column name</label>
        <input value={cfg.join_key || ''} onChange={e => onChange({ ...step, config: { ...cfg, join_key: e.target.value } })} placeholder="e.g. order_id" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'6px 10px', color:'#fff', boxSizing:'border-box', marginBottom:8 }} />
        <label style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Paste second CSV data below</label>
        <textarea value={cfg.csv_text || ''} onChange={e => onChange({ ...step, config: { ...cfg, csv_text: e.target.value } })} rows={4} placeholder="id,name,value
1,foo,100" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'6px 10px', color:'#fff', boxSizing:'border-box', fontFamily:'monospace', fontSize:12 }} />
      </div>
    )
  }

  return null
}

function RunModal({ pipeline, onClose }) {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveOutput, setSaveOutput] = useState(false)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data)).catch(() => {}) }, [])

  const runPreview = async () => {
    if (!fileId) { setError('Select a file first'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await pipelinesApi.preview(pipeline.id, { file_id: fileId, save_output: false })
      setResult(r.data)
    } catch (e) { setError(e.response?.data?.detail || 'Preview failed') }
    finally { setLoading(false) }
  }

  const runAndSave = async () => {
    if (!fileId) { setError('Select a file first'); return }
    setLoading(true); setError('')
    try {
      const r = await pipelinesApi.run(pipeline.id, { file_id: fileId, save_output: true, output_name: pipeline.name + '_output.csv' })
      setResult(r.data)
    } catch (e) { setError(e.response?.data?.detail || 'Run failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div style={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:12, padding:28, width:800, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, color:'#fff', fontSize:17 }}>Run Pipeline: {pipeline.name}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:18 }}>×</button>
        </div>
        {error && <div style={{ background:'#ff4444', color:'#fff', padding:'8px 12px', borderRadius:6, marginBottom:12, fontSize:13 }}>{error}</div>}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:6 }}>Select input file</label>
          <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'8px 12px', color:'#fff' }}>
            <option value="">-- choose a file --</option>
            {files.filter(f => f.filename?.endsWith('.csv')).map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          <button onClick={runPreview} disabled={loading} style={{ padding:'8px 18px', borderRadius:6, border:'1px solid #e91e8c', background:'transparent', color:'#e91e8c', cursor:'pointer', fontSize:13 }}>
            {loading ? 'Running...' : '▶ Preview (first 50 rows)'}
          </button>
          <button onClick={runAndSave} disabled={loading} style={{ padding:'8px 18px', borderRadius:6, border:'none', background:'#e91e8c', color:'#fff', cursor:'pointer', fontSize:13 }}>
            {loading ? 'Running...' : '💾 Run & Save to Files'}
          </button>
        </div>
        {result && (
          <div>
            <div style={{ color:'#888', fontSize:12, marginBottom:10 }}>
              {result.total_rows} rows after transformation {result.output_file_id ? '· Saved to your files ✓' : '· Preview only'}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>{result.headers.map(h => <th key={h} style={{ background:'#2a2a3e', color:'#ccc', padding:'6px 10px', textAlign:'left', border:'1px solid #333', whiteSpace:'nowrap' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {result.rows.slice(0,20).map((row, i) => (
                    <tr key={i}>{result.headers.map(h => <td key={h} style={{ color:'#fff', padding:'4px 10px', border:'1px solid #2a2a3e', whiteSpace:'nowrap', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>{row[h] || ''}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DataPipelines() {
  const [pipelines, setPipelines] = useState([])
  const [editing, setEditing] = useState(null)
  const [running, setRunning] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', steps: [] })
  const [message, setMessage] = useState('')

  const load = async () => {
    try { const r = await pipelinesApi.list(); setPipelines(r.data) } catch {}
  }

  useEffect(() => { load() }, [])

  const startNew = () => {
    setForm({ name: '', description: '', steps: [] })
    setEditing('new')
  }

  const startEdit = (p) => {
    setForm({ name: p.name, description: p.description || '', steps: p.steps || [] })
    setEditing(p.id)
  }

  const addStep = (type) => {
    setForm(f => ({ ...f, steps: [...f.steps, { type, config: {} }] }))
  }

  const removeStep = (idx) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }))
  }

  const updateStep = (idx, step) => {
    setForm(f => { const steps = [...f.steps]; steps[idx] = step; return { ...f, steps } })
  }

  const save = async () => {
    if (!form.name.trim()) { setMessage('Pipeline name is required'); return }
    try {
      if (editing === 'new') { await pipelinesApi.create({ name: form.name, description: form.description, steps: form.steps }) }
      else { await pipelinesApi.update(editing, { name: form.name, description: form.description, steps: form.steps }) }
      setEditing(null); load()
      setMessage('Pipeline saved!'); setTimeout(() => setMessage(''), 3000)
    } catch (e) { setMessage(e.response?.data?.detail || 'Save failed') }
  }

  const deletePipeline = async (id) => {
    if (!confirm('Delete this pipeline?')) return
    try { await pipelinesApi.remove(id); load() } catch {}
  }

  return (
    <div style={{ padding:32, maxWidth:960, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32 }}>
        <div>
          <h1 style={{ color:'#fff', margin:0, fontSize:24 }}>Data Pipelines</h1>
          <p style={{ color:'#888', margin:'8px 0 0', fontSize:14 }}>Build reusable transform pipelines. Apply them to any CSV dataset to clean, reshape, and enrich your data.</p>
        </div>
        {!editing && <button onClick={startNew} style={{ padding:'10px 20px', borderRadius:8, border:'none', background:'#e91e8c', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:500 }}>+ New Pipeline</button>}
      </div>

      {message && <div style={{ background: message.includes('fail') || message.includes('required') ? '#ff4444' : '#22c55e', color:'#fff', padding:'10px 16px', borderRadius:8, marginBottom:20, fontSize:14 }}>{message}</div>}

      {editing ? (
        <div style={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:12, padding:28 }}>
          <h2 style={{ color:'#fff', margin:'0 0 20px', fontSize:17 }}>{editing === 'new' ? 'New Pipeline' : 'Edit Pipeline'}</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <label style={{ display:'block' }}>
              <span style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Pipeline Name *</span>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Clean Sales Data" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'8px 12px', color:'#fff', boxSizing:'border-box' }} />
            </label>
            <label style={{ display:'block' }}>
              <span style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:4 }}>Description</span>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this pipeline do?" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'8px 12px', color:'#fff', boxSizing:'border-box' }} />
            </label>
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ color:'#ccc', fontSize:14, fontWeight:500, marginBottom:12 }}>Steps ({form.steps.length})</div>
            {form.steps.map((step, idx) => {
              const meta = STEP_TYPES.find(s => s.value === step.type) || {}
              return (
                <div key={idx} style={{ background:'#2a2a3e', border:'1px solid #444', borderRadius:8, padding:16, marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:16 }}>{meta.icon}</span>
                      <span style={{ color:'#fff', fontSize:13, fontWeight:500 }}>Step {idx + 1}: {meta.label}</span>
                    </div>
                    <button onClick={() => removeStep(idx)} style={{ background:'none', border:'none', color:'#ff6666', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
                  </div>
                  <StepConfig step={step} onChange={(s) => updateStep(idx, s)} />
                </div>
              )
            })}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
              {STEP_TYPES.map(s => (
                <button key={s.value} onClick={() => addStep(s.value)} style={{ padding:'6px 14px', borderRadius:6, border:'1px dashed #555', background:'transparent', color:'#888', cursor:'pointer', fontSize:12 }}>
                  {s.icon} + {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:12 }}>
            <button onClick={() => setEditing(null)} style={{ padding:'8px 20px', borderRadius:6, border:'1px solid #444', background:'transparent', color:'#aaa', cursor:'pointer' }}>Cancel</button>
            <button onClick={save} style={{ padding:'8px 20px', borderRadius:6, border:'none', background:'#e91e8c', color:'#fff', cursor:'pointer' }}>Save Pipeline</button>
          </div>
        </div>
      ) : (
        <div>
          {pipelines.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#666', border:'1px dashed #333', borderRadius:12 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>⚙️</div>
              <div style={{ fontSize:15, marginBottom:8 }}>No pipelines yet</div>
              <div style={{ fontSize:13 }}>Create a pipeline to automate data transformations</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {pipelines.map(p => (
                <div key={p.id} style={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:10, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ color:'#fff', fontWeight:500, fontSize:15 }}>{p.name}</div>
                    <div style={{ color:'#888', fontSize:12, marginTop:4 }}>
                      {p.steps?.length || 0} step{(p.steps?.length || 0) !== 1 ? 's' : ''} · Ran {p.run_count || 0} time{(p.run_count || 0) !== 1 ? 's' : ''}
                      {p.last_run_at ? ' · Last run ' + new Date(p.last_run_at).toLocaleDateString() : ''}
                    </div>
                    {p.description && <div style={{ color:'#666', fontSize:12, marginTop:2 }}>{p.description}</div>}
                  </div>
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={() => setRunning(p)} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #e91e8c', background:'transparent', color:'#e91e8c', cursor:'pointer', fontSize:12, fontWeight:500 }}>▶ Run</button>
                    <button onClick={() => startEdit(p)} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #444', background:'transparent', color:'#ccc', cursor:'pointer', fontSize:12 }}>Edit</button>
                    <button onClick={() => deletePipeline(p.id)} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #ff4444', background:'transparent', color:'#ff4444', cursor:'pointer', fontSize:12 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {running && <RunModal pipeline={running} onClose={() => { setRunning(null); load() }} />}
    </div>
  )
}
