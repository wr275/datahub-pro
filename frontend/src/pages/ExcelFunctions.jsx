import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

const EXCEL_FUNCS = [
  { name: 'VLOOKUP', category: 'Lookup', syntax: 'VLOOKUP(value, range_col, result_col)', desc: 'Find a value in one column and return a value from another' },
  { name: 'COUNTIF', category: 'Statistical', syntax: 'COUNTIF(col, condition)', desc: 'Count cells matching a condition' },
  { name: 'SUMIF', category: 'Mathematical', syntax: 'SUMIF(condition_col, condition, sum_col)', desc: 'Sum values where a condition is met' },
  { name: 'AVERAGEIF', category: 'Statistical', syntax: 'AVERAGEIF(condition_col, condition, avg_col)', desc: 'Average values where a condition is met' },
  { name: 'LEFT', category: 'Text', syntax: 'LEFT(col, n)', desc: 'Extract first N characters from text' },
  { name: 'RIGHT', category: 'Text', syntax: 'RIGHT(col, n)', desc: 'Extract last N characters from text' },
  { name: 'MID', category: 'Text', syntax: 'MID(col, start, length)', desc: 'Extract substring from text' },
  { name: 'FIND', category: 'Text', syntax: 'FIND(search, col)', desc: 'Find position of text within string' },
  { name: 'SUBSTITUTE', category: 'Text', syntax: 'SUBSTITUTE(col, old, new)', desc: 'Replace specific text in a string' },
  { name: 'TEXT', category: 'Text', syntax: 'TEXT(col, format)', desc: 'Convert number to formatted text' },
  { name: 'DATE', category: 'Date/Time', syntax: 'DATE(year_col)', desc: 'Parse and format date values' },
  { name: 'YEAR', category: 'Date/Time', syntax: 'YEAR(date_col)', desc: 'Extract year from date' },
  { name: 'MONTH', category: 'Date/Time', syntax: 'MONTH(date_col)', desc: 'Extract month from date' },
  { name: 'RANK', category: 'Statistical', syntax: 'RANK(col)', desc: 'Rank values in a column (1 = highest)' },
  { name: 'PERCENTILE', category: 'Statistical', syntax: 'PERCENTILE(col, p)', desc: 'Calculate percentile value' },
]

export default function ExcelFunctions() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [selectedFn, setSelectedFn] = useState(null)
  const [params, setParams] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function selectFn(fn) {
    setSelectedFn(fn); setParams({}); setResult(null); setError('')
  }

  function execute() {
    if (!selectedFn || !rows.length) return
    setError(''); setResult(null)
    try {
      let output
      const p = params
      const col = rows.map(r => r[p.col] ?? '')
      const numCol = col.map(v => parseFloat(v)).filter(v => !isNaN(v))

      switch (selectedFn.name) {
        case 'VLOOKUP': {
          const lookupVal = p.value; const resultRows = rows.filter(r => String(r[p.range_col] ?? '').toLowerCase() === String(lookupVal).toLowerCase())
          output = resultRows.length ? resultRows.map(r => r[p.result_col]).join(', ') : '#N/A'
          setResult({ type: 'value', value: output, label: `VLOOKUP result for "${lookupVal}"` })
          break
        }
        case 'COUNTIF': {
          const cond = p.condition; const count = rows.filter(r => {
            const v = String(r[p.col] ?? '')
            if (cond.startsWith('>')) return parseFloat(v) > parseFloat(cond.slice(1))
            if (cond.startsWith('<')) return parseFloat(v) < parseFloat(cond.slice(1))
            if (cond.startsWith('=')) return v === cond.slice(1)
            return v.toLowerCase().includes(cond.toLowerCase())
          }).length
          setResult({ type: 'value', value: count, label: `COUNTIF count` })
          break
        }
        case 'SUMIF': {
          const sumVals = rows.filter(r => String(r[p.condition_col] ?? '').toLowerCase().includes(String(p.condition).toLowerCase())).map(r => parseFloat(r[p.sum_col]) || 0)
          setResult({ type: 'value', value: sumVals.reduce((a, b) => a + b, 0).toFixed(2), label: 'SUMIF result' })
          break
        }
        case 'AVERAGEIF': {
          const avgVals = rows.filter(r => String(r[p.condition_col] ?? '').toLowerCase().includes(String(p.condition).toLowerCase())).map(r => parseFloat(r[p.avg_col]) || 0)
          const avg = avgVals.length ? avgVals.reduce((a, b) => a + b, 0) / avgVals.length : 0
          setResult({ type: 'value', value: avg.toFixed(4), label: 'AVERAGEIF result' })
          break
        }
        case 'LEFT': {
          const leftRows = rows.slice(0, 10).map(r => ({ input: r[p.col], result: String(r[p.col] ?? '').slice(0, parseInt(p.n) || 1) }))
          setResult({ type: 'table', rows: leftRows, label: `LEFT(${p.col}, ${p.n})` })
          break
        }
        case 'RIGHT': {
          const rightRows = rows.slice(0, 10).map(r => ({ input: r[p.col], result: String(r[p.col] ?? '').slice(-(parseInt(p.n) || 1)) }))
          setResult({ type: 'table', rows: rightRows, label: `RIGHT(${p.col}, ${p.n})` })
          break
        }
        case 'RANK': {
          const sorted = [...numCol].sort((a, b) => b - a)
          const ranked = rows.slice(0, 20).map(r => ({ value: parseFloat(r[p.col]) || 0, rank: sorted.indexOf(parseFloat(r[p.col]) || 0) + 1 }))
          setResult({ type: 'table', rows: ranked, label: `RANK(${p.col})` })
          break
        }
        case 'YEAR': {
          const years = rows.slice(0, 10).map(r => { const d = new Date(r[p.col]); return { input: r[p.col], result: isNaN(d) ? '#VALUE!' : d.getFullYear() } })
          setResult({ type: 'table', rows: years, label: `YEAR(${p.col})` })
          break
        }
        case 'MONTH': {
          const months = rows.slice(0, 10).map(r => { const d = new Date(r[p.col]); return { input: r[p.col], result: isNaN(d) ? '#VALUE!' : d.getMonth() + 1 } })
          setResult({ type: 'table', rows: months, label: `MONTH(${p.col})` })
          break
        }
        case 'PERCENTILE': {
          const p_val = parseFloat(params.p) || 50; const sorted2 = [...numCol].sort((a, b) => a - b)
          const idx = Math.floor(sorted2.length * p_val / 100)
          setResult({ type: 'value', value: sorted2[idx]?.toFixed(4), label: `${p_val}th percentile of ${p.col}` })
          break
        }
        default:
          setError('Function not yet implemented in demo. Try VLOOKUP, COUNTIF, SUMIF, LEFT, RIGHT, RANK, YEAR, MONTH, or PERCENTILE.')
      }
    } catch (e) { setError('Error: ' + e.message) }
  }

  const categories = ['All', ...new Set(EXCEL_FUNCS.map(f => f.category))]
  const filtered = category === 'All' ? EXCEL_FUNCS : EXCEL_FUNCS.filter(f => f.category === category)

  const paramFields = {
    VLOOKUP: [['value', 'Search Value'], ['range_col', 'Search Column'], ['result_col', 'Return Column']],
    COUNTIF: [['col', 'Column'], ['condition', 'Condition (e.g. >100 or "text")']],
    SUMIF: [['condition_col', 'Condition Column'], ['condition', 'Condition'], ['sum_col', 'Sum Column']],
    AVERAGEIF: [['condition_col', 'Condition Column'], ['condition', 'Condition'], ['avg_col', 'Avg Column']],
    LEFT: [['col', 'Column'], ['n', 'Number of chars']],
    RIGHT: [['col', 'Column'], ['n', 'Number of chars']],
    MID: [['col', 'Column'], ['start', 'Start position'], ['length', 'Length']],
    FIND: [['search', 'Search text'], ['col', 'Column']],
    SUBSTITUTE: [['col', 'Column'], ['old', 'Find'], ['new', 'Replace with']],
    RANK: [['col', 'Column to rank']],
    PERCENTILE: [['col', 'Column'], ['p', 'Percentile (0-100)']],
    YEAR: [['col', 'Date column']],
    MONTH: [['col', 'Date column']],
    TEXT: [['col', 'Column'], ['format', 'Format string']],
    DATE: [['col', 'Date column']],
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Excel Functions</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Apply familiar Excel-style functions to your data</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Functions</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {categories.map(c => <button key={c} onClick={() => setCategory(c)} style={{ padding: '4px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', background: category === c ? '#0c1446' : '#f3f4f6', color: category === c ? '#fff' : '#374151', fontSize: '0.78rem', fontWeight: 600 }}>{c}</button>)}
          </div>
          {filtered.map(fn => (
            <div key={fn.name} onClick={() => selectFn(fn)} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', background: selectedFn?.name === fn.name ? '#e91e8c10' : '#f9fafb', border: `1px solid ${selectedFn?.name === fn.name ? '#e91e8c' : 'transparent'}` }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e91e8c', fontSize: '0.85rem' }}>{fn.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{fn.desc}</div>
            </div>
          ))}
        </div>

        <div>
          {selectedFn ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 4 }}>{selectedFn.name}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#6b7280', marginBottom: 12 }}>{selectedFn.syntax}</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
                <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
                  <option value="">-- Choose --</option>
                  {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
                </select>
              </div>
              {(paramFields[selectedFn.name] || []).map(([key, label]) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>
                  {['col', 'range_col', 'result_col', 'condition_col', 'sum_col', 'avg_col'].includes(key) ? (
                    <select value={params[key] || ''} onChange={e => setParams({ ...params, [key]: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
                      <option value="">-- Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  ) : (
                    <input value={params[key] || ''} onChange={e => setParams({ ...params, [key]: e.target.value })} placeholder={label} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  )}
                </div>
              ))}
              {error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>{error}</div>}
              <button onClick={execute} disabled={!fileId} style={{ padding: '9px 24px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>Execute</button>
            </div>
          ) : (
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 8 }}>ƒ</div><div>Select a function from the left panel</div></div>
          )}

          {result && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>{result.label}</div>
              {result.type === 'value' ? (
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e91e8c' }}>{result.value}</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>{Object.keys(result.rows[0] || {}).map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
                  <tbody>{result.rows.map((r, i) => <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>{Object.values(r).map((v, vi) => <td key={vi} style={{ padding: '7px 12px', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{v}</td>)}</tr>)}</tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
