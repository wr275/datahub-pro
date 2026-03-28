import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi, calculatedFieldsApi } from '../api'
import toast from 'react-hot-toast'

const OPERATORS = [
  { value: '+', label: '+ Add' },
  { value: '-', label: 'â Subtract' },
  { value: '*', label: 'Ã Multiply' },
  { value: '/', label: 'Ã· Divide' },
  { value: '%', label: '% Pct of' },
]
const PINK = '#e91e8c'
const CARD = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 }
const SEL = { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 10px', fontSize: '0.85rem', background: '#fff', color: '#1e293b', cursor: 'pointer' }
const INPUT = { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 10px', fontSize: '0.85rem', color: '#1e293b', outline: 'none', width: '100%' }
const BTN = (extra = {}) => ({ padding: '9px 18px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: 'none', ...extra })

function OperandPicker({ type, col, const_, columns, onTypeChange, onColChange, onConstChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #d1d5db', flexShrink: 0 }}>
        <button
          onClick={() => onTypeChange('column')}
          style={{ padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: type === 'column' ? PINK : '#f8fafc', color: type === 'column' ? '#fff' : '#64748b' }}
        >Col</button>
        <button
          onClick={() => onTypeChange('constant')}
          style={{ padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: type === 'constant' ? PINK : '#f8fafc', color: type === 'constant' ? '#fff' : '#64748b' }}
        >123</button>
      </div>
      {type === 'column' ? (
        <select value={col} onChange={e => onColChange(e.target.value)} style={{ ...SEL, minWidth: 120 }}>
          <option value="">â pick column â</option>
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <input
          type="number"
          placeholder="0"
          value={const_ ?? ''}
          onChange={e => onConstChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          style={{ ...INPUT, width: 100 }}
        />
      )}
    </div>
  )
}

function FieldRow({ field, columns, updateField, removeField, canRemove, index }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 10, background: '#fdf2f8', border: '1px solid #fbc8e4', marginBottom: 10 }}>
      <span style={{ color: PINK, fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>â¦</span>
      <input
        placeholder="New column name"
        value={field.name}
        onChange={e => updateField('name', e.target.value)}
        style={{ ...INPUT, width: 160 }}
      />
      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>=</span>
      <OperandPicker
        type={field.col_a_type}
        col={field.col_a}
        const_={field.const_a}
        columns={columns}
        onTypeChange={v => updateField('col_a_type', v)}
        onColChange={v => updateField('col_a', v)}
        onConstChange={v => updateField('const_a', v)}
      />
      <select value={field.operator} onChange={e => updateField('operator', e.target.value)} style={{ ...SEL }}>
        {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      <OperandPicker
        type={field.col_b_type}
        col={field.col_b}
        const_={field.const_b}
        columns={columns}
        onTypeChange={v => updateField('col_b_type', v)}
        onColChange={v => updateField('col_b', v)}
        onConstChange={v => updateField('const_b', v)}
      />
      {canRemove && (
        <button onClick={removeField} style={{ ...BTN({ background: '#fee2e2', color: '#dc2626' }), padding: '6px 10px', marginLeft: 'auto', flexShrink: 0 }}>â</button>
      )}
    </div>
  )
}

const emptyField = () => ({
  name: '',
  col_a: '',
  col_a_type: 'column',
  const_a: null,
  operator: '+',
  col_b: '',
  col_b_type: 'column',
  const_b: null,
})

export default function CalculatedFields() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [columns, setColumns] = useState([])
  const [fields, setFields] = useState([emptyField()])
  const [preview, setPreview] = useState(null)
  const [savedSets, setSavedSets] = useState([])
  const [loading, setLoading] = useState(false)
  const [setName, setSetName] = useState('')

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data)).catch(() => {})
    loadSets()
  }, [])

  useEffect(() => {
    if (!fileId) { setColumns([]); return }
    const file = files.find(f => f.id === fileId)
    setColumns(file?.column_names || [])
  }, [fileId, files])

  const loadSets = () => {
    calculatedFieldsApi.list().then(r => setSavedSets(r.data)).catch(() => {})
  }

  const allColumns = (idx) => [
    ...columns,
    ...fields.slice(0, idx).map(f => f.name).filter(Boolean),
  ]

  const updateField = (idx, key, val) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f))
  }
  const removeField = (idx) => setFields(prev => prev.filter((_, i) => i !== idx))
  const addField = () => setFields(prev => [...prev, emptyField()])

  const handlePreview = async () => {
    if (!fileId) return toast.error('Select a file first')
    setLoading(true)
    try {
      const r = await calculatedFieldsApi.preview({ file_id: fileId, fields })
      setPreview(r.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Preview failed')
    } finally { setLoading(false) }
  }

  const handleExport = async () => {
    if (!fileId) return toast.error('Select a file first')
    setLoading(true)
    try {
      const r = await calculatedFieldsApi.export({ file_id: fileId, fields })
      const url = URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url; a.download = 'calculated_fields.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error('Export failed')
    } finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!setName.trim()) return toast.error('Enter a name for this field set')
    if (!fileId) return toast.error('Select a file first')
    try {
      await calculatedFieldsApi.save({ set_name: setName, file_id: fileId, fields })
      toast.success('Field set saved!')
      setSetName('')
      loadSets()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    }
  }

  const handleLoad = (set) => {
    setFileId(set.file_id)
    setFields(JSON.parse(set.fields_json))
    toast.success('Loaded: ' + set.name)
  }

  const handleDelete = async (id) => {
    try {
      await calculatedFieldsApi.delete(id)
      toast.success('Deleted')
      loadSets()
    } catch { toast.error('Delete failed') }
  }

  const previewCols = preview && preview.length > 0 ? Object.keys(preview[0]) : []
  const calcNames = new Set(fields.map(f => f.name).filter(Boolean))

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>ð§® Calculated Fields</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 6 }}>
          Create new columns from your data without writing code â profit, LTV, margins, and more.
        </p>
      </div>

      {/* File picker */}
      <div style={CARD}>
        <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.88rem', display: 'block', marginBottom: 8 }}>Select data file</label>
        <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ ...SEL, minWidth: 280 }}>
          <option value="">â choose an uploaded file â</option>
          {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
        </select>
      </div>

      {/* Formula builder */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Formula Builder</h2>
          <button onClick={addField} style={BTN({ background: '#f0fdf4', color: '#16a34a' })}>+ Add Field</button>
        </div>
        {fields.map((field, idx) => (
          <FieldRow
            key={idx}
            index={idx}
            field={field}
            columns={allColumns(idx)}
            updateField={(k, v) => updateField(idx, k, v)}
            removeField={() => removeField(idx)}
            canRemove={fields.length > 1}
          />
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={handlePreview} disabled={loading} style={BTN({ background: PINK, color: '#fff' })}>
            {loading ? 'Loadingâ¦' : 'ð Preview (50 rows)'}
          </button>
          <button onClick={handleExport} disabled={loading} style={BTN({ background: '#1e293b', color: '#fff' })}>
            â¬ Export CSV
          </button>
        </div>
      </div>

      {/* Save / Load sets */}
      <div style={CARD}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 14, marginTop: 0 }}>Save Field Set</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            placeholder="Name this field setâ¦"
            value={setName}
            onChange={e => setSetName(e.target.value)}
            style={{ ...INPUT, width: 260 }}
          />
          <button onClick={handleSave} style={BTN({ background: '#6366f1', color: '#fff' })}>ð¾ Save</button>
        </div>
        {savedSets.length > 0 && (
          <>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#374151', marginBottom: 10 }}>Saved Sets</h3>
            {savedSets.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: '0.88rem', color: '#1e293b', fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{JSON.parse(s.fields_json).length} fields</span>
                <button onClick={() => handleLoad(s)} style={BTN({ background: '#eff6ff', color: '#2563eb', padding: '5px 12px' })}>Load</button>
                <button onClick={() => handleDelete(s.id)} style={BTN({ background: '#fee2e2', color: '#dc2626', padding: '5px 12px' })}>Delete</button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Preview table */}
      {preview && (
        <div style={CARD}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 14, marginTop: 0 }}>
            Preview <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.85rem' }}>({preview.length} rows)</span>
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {previewCols.map(c => (
                    <th key={c} style={{ padding: '8px 12px', background: calcNames.has(c) ? '#fdf2f8' : '#f8fafc', color: calcNames.has(c) ? PINK : '#374151', fontWeight: 700, borderBottom: '2px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {calcNames.has(c) ? 'â¦ ' : ''}{c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    {previewCols.map(c => (
                      <td key={c} style={{ padding: '7px 12px', borderBottom: '1px solid #f1f5f9', color: calcNames.has(c) ? PINK : '#1e293b', fontWeight: calcNames.has(c) ? 600 : 400 }}>
                        {row[c] !== null && row[c] !== undefined ? String(row[c]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
