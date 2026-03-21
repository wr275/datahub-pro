import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function DataCleaner() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [cleaned, setCleaned] = useState(null)
  const [ops, setOps] = useState({ removeDupes: true, trimWhitespace: true, fillMissingNum: 'none', fillMissingText: 'none', removeEmptyRows: false })

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setCleaned(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!rows.length) return
    let result = rows.map(r => ({ ...r }))
    const log = []
    const numericCols = headers.filter(h => result.some(r => !isNaN(parseFloat(r[h]))))
    const textCols = headers.filter(h => !numericCols.includes(h))

    if (ops.trimWhitespace) {
      let count = 0
      result = result.map(r => {
        const nr = { ...r }
        textCols.forEach(h => { if (typeof nr[h] === 'string' && nr[h] !== nr[h].trim()) { nr[h] = nr[h].trim(); count++ } })
        return nr
      })
      if (count) log.push(`Trimmed whitespace in ${count} cells`)
    }

    if (ops.removeEmptyRows) {
      const before = result.length
      result = result.filter(r => headers.some(h => r[h] != null && r[h] !== ''))
      const removed = before - result.length
      if (removed) log.push(`Removed ${removed} empty rows`)
    }

    if (ops.removeDupes) {
      const seen = new Set()
      const before = result.length
      result = result.filter(r => {
        const key = JSON.stringify(headers.map(h => r[h]))
        if (seen.has(key)) return false
        seen.add(key); return true
      })
      const removed = before - result.length
      if (removed) log.push(`Removed ${removed} duplicate rows`)
    }

    if (ops.fillMissingNum !== 'none') {
      numericCols.forEach(h => {
        const vals = result.map(r => parseFloat(r[h])).filter(v => !isNaN(v))
        let fill = 0
        if (ops.fillMissingNum === 'mean' && vals.length) fill = vals.reduce((a, b) => a + b, 0) / vals.length
        else if (ops.fillMissingNum === 'median' && vals.length) { const s = [...vals].sort((a, b) => a - b); fill = s[Math.floor(s.length / 2)] }
        else if (ops.fillMissingNum === 'zero') fill = 0
        let count = 0
        result = result.map(r => { if (r[h] === '' || r[h] == null || isNaN(parseFloat(r[h]))) { count++; return { ...r, [h]: parseFloat(fill.toFixed(4)) } } return r })
        if (count) log.push(`Filled ${count} missing values in "${h}" with ${ops.fillMissingNum} (${parseFloat(fill.toFixed(2))})`)
      })
    }

    if (ops.fillMissingText !== 'none') {
      textCols.forEach(h => {
        let fill = ops.fillMissingText === 'blank' ? '' : '(unknown)'
        let count = 0
        result = result.map(r => { if (r[h] === '' || r[h] == null) { count++; return { ...r, [h]: fill } } return r })
        if (count) log.push(`Filled ${count} blank text cells in "${h}" with "${fill}"`)
      })
    }

    setCleaned({ rows: result, log, originalCount: rows.length, cleanedCount: result.length })
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Data Cleaner</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Automatically fix common data quality issues — duplicates, missing values, and whitespace</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Select File</div>
          <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', marginBottom: 12 }}>
            <option value="">-- Choose --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
          {rows.length > 0 && <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{rows.length} rows, {headers.length} columns loaded</div>}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Cleaning Operations</div>
          {[
            ['removeDupes', 'Remove duplicate rows'],
            ['trimWhitespace', 'Trim leading/trailing whitespace'],
            ['removeEmptyRows', 'Remove entirely empty rows']
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={ops[key]} onChange={e => setOps({ ...ops, [key]: e.target.checked })} />
              <span style={{ fontSize: '0.875rem', color: '#374151' }}>{label}</span>
            </label>
          ))}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Fill Missing Numeric Values</div>
            <select value={ops.fillMissingNum} onChange={e => setOps({ ...ops, fillMissingNum: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', marginBottom: 10 }}>
              <option value="none">Don't fill</option>
              <option value="mean">Fill with Mean</option>
              <option value="median">Fill with Median</option>
              <option value="zero">Fill with Zero</option>
            </select>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Fill Missing Text Values</div>
            <select value={ops.fillMissingText} onChange={e => setOps({ ...ops, fillMissingText: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }}>
              <option value="none">Don't fill</option>
              <option value="blank">Fill with empty string</option>
              <option value="unknown">Fill with "(unknown)"</option>
            </select>
          </div>
        </div>
      </div>

      <button onClick={run} disabled={!fileId || !rows.length} style={{ padding: '10px 28px', background: fileId && rows.length ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: fileId && rows.length ? 'pointer' : 'default', marginBottom: 24 }}>Clean Data</button>

      {cleaned && (
        <div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 10 }}>Cleaning Report</div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              <div><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Original rows: </span><strong>{cleaned.originalCount}</strong></div>
              <div><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Cleaned rows: </span><strong style={{ color: '#10b981' }}>{cleaned.cleanedCount}</strong></div>
              <div><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Removed: </span><strong style={{ color: '#ef4444' }}>{cleaned.originalCount - cleaned.cleanedCount}</strong></div>
            </div>
            {cleaned.log.length === 0 ? <div style={{ color: '#10b981', fontSize: '0.875rem' }}>✓ No issues found — data is already clean!</div> :
              cleaned.log.map((l, i) => <div key={i} style={{ fontSize: '0.875rem', color: '#374151', padding: '3px 0' }}>✓ {l}</div>)}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Cleaned Data Preview (first 50 rows)</div>
            <div style={{ overflowX: 'auto', maxHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead><tr style={{ background: '#f9fafb' }}>{headers.map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {cleaned.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {headers.map(h => <td key={h} style={{ padding: '7px 12px', color: '#374151', whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6' }}>{row[h] ?? '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!cleaned && <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🧹</div><div>Select a file and cleaning options, then click Clean Data</div></div>}
    </div>
  )
}
