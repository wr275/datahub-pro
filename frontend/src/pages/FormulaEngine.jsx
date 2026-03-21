import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

const FUNCS = {
  SUM: (args, data) => args.reduce((a, b) => a + getVal(b, data), 0),
  AVG: (args, data) => args.reduce((a, b) => a + getVal(b, data), 0) / args.length,
  MIN: (args, data) => Math.min(...args.map(a => getVal(a, data))),
  MAX: (args, data) => Math.max(...args.map(a => getVal(a, data))),
  COUNT: (args, data) => args.length,
  IF: (args, data) => {
    const cond = getVal(args[0], data); const t = getVal(args[1], data); const f = getVal(args[2], data)
    return cond ? t : f
  },
  ROUND: (args, data) => parseFloat(parseFloat(getVal(args[0], data)).toFixed(getVal(args[1], data) || 0)),
  ABS: (args, data) => Math.abs(getVal(args[0], data)),
  SQRT: (args, data) => Math.sqrt(getVal(args[0], data)),
  POWER: (args, data) => Math.pow(getVal(args[0], data), getVal(args[1], data)),
  CONCAT: (args, data) => args.map(a => String(getVal(a, data))).join(''),
  LEN: (args, data) => String(getVal(args[0], data)).length,
  UPPER: (args, data) => String(getVal(args[0], data)).toUpperCase(),
  LOWER: (args, data) => String(getVal(args[0], data)).toLowerCase(),
  TRIM: (args, data) => String(getVal(args[0], data)).trim(),
}

function getVal(expr, data) {
  const s = String(expr).trim()
  if (data && data[s] !== undefined) return parseFloat(data[s]) || data[s]
  if (!isNaN(parseFloat(s))) return parseFloat(s)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1)
  return s
}

function evaluate(formula, row) {
  const f = formula.trim().toUpperCase()
  const match = f.match(/^([A-Z]+)\((.+)\)$/)
  if (!match) return getVal(formula, row)
  const fn = match[1]; const argsStr = match[2]
  // Simple argument parsing (no nested commas)
  const args = argsStr.split(',').map(a => a.trim())
  if (FUNCS[fn]) return FUNCS[fn](args.map(a => {
    // Recursively evaluate nested functions
    if (a.match(/^[A-Z]+\(/)) return evaluate(a.replace(/([A-Z]+)/g, s => s), row)
    return a
  }), row)
  return '#NAME?'
}

export default function FormulaEngine() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [formula, setFormula] = useState('')
  const [colName, setColName] = useState('Formula Result')
  const [results, setResults] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResults(null); setPreview(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function runPreview() {
    if (!formula || !rows.length) return
    setError('')
    try {
      const sample = rows.slice(0, 5).map(row => {
        let result
        try { result = evaluate(formula, row) } catch (e) { result = '#ERROR!' }
        return { ...row, [colName]: result }
      })
      setPreview(sample)
    } catch (e) { setError('Formula error: ' + e.message) }
  }

  function applyToAll() {
    if (!formula || !rows.length) return
    setError('')
    try {
      const computed = rows.map(row => {
        let result
        try { result = evaluate(formula, row) } catch (e) { result = '#ERROR!' }
        return { ...row, [colName]: result }
      })
      setResults({ rows: computed, headers: [...headers, colName] })
    } catch (e) { setError('Formula error: ' + e.message) }
  }

  const exampleFormulas = [
    ['SUM(col1, col2)', 'Add two columns'],
    ['AVG(price, cost)', 'Average of columns'],
    ['ROUND(price, 2)', 'Round to 2 decimals'],
    ['IF(sales, High, Low)', 'Conditional check'],
    ['CONCAT(first, " ", last)', 'Concatenate text'],
    ['UPPER(name)', 'Convert to uppercase'],
    ['ABS(variance)', 'Absolute value'],
    ['POWER(base, 2)', 'Square a value'],
  ]

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Formula Engine</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Apply built-in formulas to compute new columns from your data</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          {headers.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Available Columns</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {headers.map(h => <span key={h} onClick={() => setFormula(f => f + h)} style={{ background: '#f3f4f6', padding: '4px 10px', borderRadius: 12, fontSize: '0.8rem', cursor: 'pointer', color: '#374151' }}>{h}</span>)}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Formula</div>
            <input value={formula} onChange={e => setFormula(e.target.value)} placeholder='e.g. SUM(revenue, discount)' style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'monospace', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>New Column Name</div>
            <input value={colName} onChange={e => setColName(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={runPreview} disabled={!formula || !fileId} style={{ padding: '9px 18px', background: formula && fileId ? '#0097b2' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: formula && fileId ? 'pointer' : 'default' }}>Preview (5 rows)</button>
            <button onClick={applyToAll} disabled={!formula || !fileId} style={{ padding: '9px 18px', background: formula && fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: formula && fileId ? 'pointer' : 'default' }}>Apply to All</button>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Example Formulas</div>
          {exampleFormulas.map(([f, d]) => (
            <div key={f} onClick={() => setFormula(f)} style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: '#f9fafb' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#e91e8c', fontWeight: 700 }}>{f}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {(preview || results) && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>
            {results ? `Full Results — ${results.rows.length} rows` : 'Preview — first 5 rows'}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {(results ? results.headers : [...headers, colName]).map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: h === colName ? '#e91e8c' : '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', background: h === colName ? '#fdf2f8' : undefined }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(results ? results.rows.slice(0, 100) : preview).map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {(results ? results.headers : [...headers, colName]).map(h => (
                      <td key={h} style={{ padding: '7px 12px', color: h === colName ? '#e91e8c' : '#374151', fontWeight: h === colName ? 700 : 400, whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6', background: h === colName ? '#fdf2f8' : undefined }}>{row[h] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!preview && !results && <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>ƒ(x)</div><div>Build a formula using column names and functions, then click Preview or Apply</div></div>}
    </div>
  )
}
