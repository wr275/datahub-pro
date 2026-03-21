import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function AdvancedFilter() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState([{ col: '', op: 'equals', val: '' }])
  const [logic, setLogic] = useState('AND')
  const [result, setResult] = useState(null)
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function addFilter() { setFilters([...filters, { col: '', op: 'equals', val: '' }]) }
  function removeFilter(i) { setFilters(filters.filter((_, idx) => idx !== i)) }
  function updateFilter(i, field, val) {
    const updated = [...filters]
    updated[i] = { ...updated[i], [field]: val }
    setFilters(updated)
  }

  function testFilter(row, f) {
    if (!f.col) return true
    const raw = row[f.col]
    const v = f.val
    const num = parseFloat(raw); const numV = parseFloat(v)
    switch (f.op) {
      case 'equals': return String(raw ?? '').toLowerCase() === String(v).toLowerCase()
      case 'not_equals': return String(raw ?? '').toLowerCase() !== String(v).toLowerCase()
      case 'contains': return String(raw ?? '').toLowerCase().includes(String(v).toLowerCase())
      case 'not_contains': return !String(raw ?? '').toLowerCase().includes(String(v).toLowerCase())
      case 'starts_with': return String(raw ?? '').toLowerCase().startsWith(String(v).toLowerCase())
      case 'gt': return !isNaN(num) && !isNaN(numV) && num > numV
      case 'gte': return !isNaN(num) && !isNaN(numV) && num >= numV
      case 'lt': return !isNaN(num) && !isNaN(numV) && num < numV
      case 'lte': return !isNaN(num) && !isNaN(numV) && num <= numV
      case 'is_empty': return raw == null || raw === ''
      case 'is_not_empty': return raw != null && raw !== ''
      default: return true
    }
  }

  function run() {
    if (!rows.length) return
    const activeFilters = filters.filter(f => f.col)
    let filtered = rows.filter(row => {
      if (!activeFilters.length) return true
      const results = activeFilters.map(f => testFilter(row, f))
      return logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
    })
    if (sortCol) {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sortCol]; const bv = b[sortCol]
        const an = parseFloat(av); const bn = parseFloat(bv)
        if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an
        return sortDir === 'asc' ? String(av ?? '').localeCompare(String(bv ?? '')) : String(bv ?? '').localeCompare(String(av ?? ''))
      })
    }
    setResult({ rows: filtered, total: filtered.length })
  }

  const ops = [['equals', '= Equals'], ['not_equals', '≠ Not equals'], ['contains', '∋ Contains'], ['not_contains', '∌ Not contains'], ['starts_with', '⊂ Starts with'], ['gt', '> Greater than'], ['gte', '≥ Greater or equal'], ['lt', '< Less than'], ['lte', '≤ Less or equal'], ['is_empty', '∅ Is empty'], ['is_not_empty', '✓ Is not empty']]

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Advanced Filter</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Apply multiple conditions to filter and sort your data precisely</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Logic</div>
            <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
              {['AND', 'OR'].map(l => (
                <button key={l} onClick={() => setLogic(l)} style={{ padding: '9px 20px', background: logic === l ? '#0c1446' : '#fff', color: logic === l ? '#fff' : '#374151', border: 'none', fontWeight: 700, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {filters.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {i > 0 && <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', minWidth: 28, paddingBottom: 10 }}>{logic}</div>}
              {i === 0 && <div style={{ minWidth: 28 }} />}
              <select value={f.col} onChange={e => updateFilter(i, 'col', e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', minWidth: 150 }}>
                <option value="">-- Column --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <select value={f.op} onChange={e => updateFilter(i, 'op', e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }}>
                {ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {!['is_empty', 'is_not_empty'].includes(f.op) && (
                <input value={f.val} onChange={e => updateFilter(i, 'val', e.target.value)} placeholder="value" style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem', width: 140 }} />
              )}
              {filters.length > 1 && <button onClick={() => removeFilter(i)} style={{ padding: '8px 10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕</button>}
            </div>
          ))}
          <button onClick={addFilter} style={{ marginTop: 4, padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>+ Add Filter</button>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Sort By</div>
            <select value={sortCol} onChange={e => setSortCol(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">(no sort)</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Direction</div>
            <select value={sortDir} onChange={e => setSortDir(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="asc">Ascending ↑</option>
              <option value="desc">Descending ↓</option>
            </select>
          </div>
          <button onClick={run} disabled={!fileId} style={{ padding: '9px 24px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>Apply Filters</button>
        </div>
      </div>

      {result && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#0c1446' }}>{result.total} rows match your filters</span>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>of {rows.length} total</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 450 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead><tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>{headers.map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {result.rows.slice(0, 200).map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {headers.map(h => <td key={h} style={{ padding: '7px 12px', color: '#374151', whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6' }}>{row[h] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</div><div>Add filter conditions and click Apply Filters</div></div>}
    </div>
  )
}
