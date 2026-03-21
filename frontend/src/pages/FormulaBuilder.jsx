import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

const BLOCKS = [
  { type: 'column', label: 'Column', color: '#e91e8c', icon: '📊' },
  { type: 'number', label: 'Number', color: '#0097b2', icon: '#' },
  { type: 'operator', label: '+', color: '#10b981', icon: '+' },
  { type: 'operator', label: '-', color: '#10b981', icon: '-' },
  { type: 'operator', label: '*', color: '#10b981', icon: '×' },
  { type: 'operator', label: '/', color: '#10b981', icon: '÷' },
  { type: 'function', label: 'SUM', color: '#8b5cf6', icon: 'Σ' },
  { type: 'function', label: 'AVG', color: '#8b5cf6', icon: 'μ' },
  { type: 'function', label: 'ROUND', color: '#8b5cf6', icon: '≈' },
  { type: 'function', label: 'ABS', color: '#f59e0b', icon: '|x|' },
  { type: 'function', label: 'IF', color: '#ef4444', icon: '?' },
]

export default function FormulaBuilder() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [tokens, setTokens] = useState([])
  const [customNum, setCustomNum] = useState('10')
  const [selectedCol, setSelectedCol] = useState('')
  const [outputName, setOutputName] = useState('Computed')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setPreview(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function addToken(type, label) {
    if (type === 'column' && !selectedCol) return
    const token = type === 'column' ? { type, label: selectedCol, display: selectedCol } : { type, label, display: label }
    setTokens([...tokens, token])
  }

  function buildExpression() {
    return tokens.map(t => {
      if (t.type === 'operator') return ({ '+': '+', '-': '-', '*': '*', '/': '/' })[t.label] || t.label
      return t.label
    }).join(' ')
  }

  function evalExpression(row) {
    const expr = tokens.map(t => {
      if (t.type === 'column') {
        const val = parseFloat(row[t.label]) || 0
        return val
      }
      if (t.type === 'number') return parseFloat(t.label) || 0
      if (t.type === 'operator') return ({ '+': '+', '-': '-', '*': '*', '/': '/' })[t.label] || t.label
      if (t.type === 'function') return t.label
      return t.label
    })
    // Simple left-to-right evaluation
    let result = 0
    let op = '+'
    for (let i = 0; i < expr.length; i++) {
      const tok = expr[i]
      if (typeof tok === 'number') {
        if (op === '+') result += tok
        else if (op === '-') result -= tok
        else if (op === '*') result *= tok
        else if (op === '/') result = tok !== 0 ? result / tok : 0
      } else if (typeof tok === 'string' && ['+', '-', '*', '/'].includes(tok)) {
        op = tok
      }
    }
    return result
  }

  function computePreview() {
    if (!tokens.length || !rows.length) return
    setError('')
    try {
      const results = rows.slice(0, 10).map(row => {
        const computed = parseFloat(evalExpression(row).toFixed(4))
        return { ...row, [outputName]: computed }
      })
      setPreview({ rows: results, headers: [...headers, outputName] })
    } catch (e) { setError('Evaluation error: ' + e.message) }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Formula Builder AI</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Build formulas visually using drag-and-drop blocks</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Dataset</div>
          <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', marginBottom: 16 }}>
            <option value="">-- Choose --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>

          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 8 }}>Building Blocks</div>
          <div style={{ marginBottom: 10 }}>
            <select value={selectedCol} onChange={e => setSelectedCol(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', marginBottom: 6 }}>
              <option value="">-- Select column --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <button onClick={() => addToken('column', selectedCol)} disabled={!selectedCol} style={{ width: '100%', padding: '7px', background: selectedCol ? '#e91e8c20' : '#f3f4f6', color: '#e91e8c', border: '1px solid #e91e8c', borderRadius: 6, cursor: selectedCol ? 'pointer' : 'default', fontWeight: 700, fontSize: '0.82rem' }}>+ Add Column</button>
          </div>

          <div style={{ marginBottom: 10, display: 'flex', gap: 6 }}>
            <input value={customNum} onChange={e => setCustomNum(e.target.value)} type="number" style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }} />
            <button onClick={() => addToken('number', customNum)} style={{ padding: '7px 12px', background: '#0097b220', color: '#0097b2', border: '1px solid #0097b2', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>+ Num</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['+', '-', '*', '/'].map(op => (
              <button key={op} onClick={() => addToken('operator', op)} style={{ padding: '8px 14px', background: '#10b98120', color: '#10b981', border: '1px solid #10b981', borderRadius: 6, cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}>{op}</button>
            ))}
            {['SUM', 'AVG', 'ROUND', 'ABS'].map(fn => (
              <button key={fn} onClick={() => addToken('function', fn)} style={{ padding: '7px 12px', background: '#8b5cf620', color: '#8b5cf6', border: '1px solid #8b5cf6', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>{fn}</button>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Formula Builder</div>
          <div style={{ minHeight: 80, background: '#f9fafb', borderRadius: 8, padding: 12, border: '2px dashed #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}>
            {tokens.length === 0 ? <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Click blocks on the left to build your formula...</span> :
              tokens.map((t, i) => (
                <div key={i} onClick={() => setTokens(tokens.filter((_, idx) => idx !== i))} style={{ padding: '6px 12px', borderRadius: 16, background: t.type === 'column' ? '#e91e8c' : t.type === 'operator' ? '#10b981' : t.type === 'number' ? '#0097b2' : '#8b5cf6', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }} title="Click to remove">{t.display}</div>
              ))
            }
          </div>

          <div style={{ fontFamily: 'monospace', background: '#0c1446', color: '#10b981', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16 }}>
            = {tokens.length ? buildExpression() : '...'}
          </div>

          {tokens.length > 0 && <button onClick={() => setTokens([])} style={{ padding: '6px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', marginRight: 8 }}>Clear All</button>}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <input value={outputName} onChange={e => setOutputName(e.target.value)} placeholder="Output column name" style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }} />
            <button onClick={computePreview} disabled={!tokens.length || !fileId} style={{ padding: '9px 20px', background: tokens.length && fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: tokens.length && fileId ? 'pointer' : 'default' }}>Preview</button>
          </div>

          {error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: 10, borderRadius: 8, marginTop: 10, fontSize: '0.85rem' }}>{error}</div>}
        </div>
      </div>

      {preview && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Preview with Computed Column</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead><tr style={{ background: '#f9fafb' }}>{preview.headers.map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: h === outputName ? '#e91e8c' : '#374151', borderBottom: '1px solid #e5e7eb', background: h === outputName ? '#fdf2f8' : undefined }}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {preview.headers.map(h => <td key={h} style={{ padding: '7px 12px', color: h === outputName ? '#e91e8c' : '#374151', fontWeight: h === outputName ? 700 : 400, borderBottom: '1px solid #f3f4f6', background: h === outputName ? '#fdf2f8' : undefined }}>{row[h] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!preview && <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🧱</div><div>Build a formula from blocks and click Preview</div></div>}
    </div>
  )
}
