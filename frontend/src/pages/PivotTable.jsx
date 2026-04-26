import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import DateRangePicker, { applyDateFilter } from '../components/ui/DateRangePicker'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'

export default function PivotTable() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [rowField, setRowField] = useState('')
  const [valField, setValField] = useState('')
  const [aggFunc, setAggFunc] = useState('sum')
  const [pivot, setPivot] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setHeaders([]); setRows([]); setPivot(null); setDateRange(null)
    if (!id) return
    analyticsApi.preview(id).then(r => {
      setHeaders(r.data.headers || [])
      setRows(r.data.rows || [])
    }).catch(() => {})
  }

  function run() {
    if (!rowField || !valField || !rows.length) return
    const scoped = applyDateFilter(rows, dateRange)
    if (!scoped.length) { setPivot(null); return }
    const groups = {}
    scoped.forEach(row => {
      const key = row[rowField] || '(blank)'
      const val = parseFloat(row[valField]) || 0
      if (!groups[key]) groups[key] = []
      groups[key].push(val)
    })
    const result = Object.entries(groups).map(([key, vals]) => {
      const sum = vals.reduce((a, b) => a + b, 0)
      const mean = sum / vals.length
      const min = Math.min(...vals); const max = Math.max(...vals)
      return { key, count: vals.length, sum: sum.toFixed(2), mean: mean.toFixed(2), min: min.toFixed(2), max: max.toFixed(2) }
    }).sort((a, b) => parseFloat(b[aggFunc]) - parseFloat(a[aggFunc]))
    setPivot(result)
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Pivot Table</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Group and aggregate your data by any column</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Row (Group By)</div>
            <select value={rowField} onChange={e => setRowField(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Column --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Value</div>
            <select value={valField} onChange={e => setValField(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Numeric col --</option>
              {numericCols.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Sort By</div>
            <select value={aggFunc} onChange={e => setAggFunc(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              {['sum', 'mean', 'count', 'min', 'max'].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {headers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <DateRangePicker
              columns={headers}
              value={dateRange}
              onChange={setDateRange}
              storageKey="pivot-table.dateRange"
            />
          </div>
        )}

        <button onClick={run} disabled={!rowField || !valField} style={{ padding: '9px 24px', background: rowField && valField ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: rowField && valField ? 'pointer' : 'default' }}>Build Pivot</button>
      </div>

      {pivot && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, color: '#0c1446' }}>Pivot: {rowField} → {valField} ({pivot.length} groups)</div>
            <ExportMenu data={pivot} filename={`pivot-${rowField}-${valField}`} title={`Pivot Table — ${rowField} by ${valField}`} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {[rowField, 'Count', 'Sum', 'Average', 'Min', 'Max'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {pivot.map((row, i) => (
                  <tr key={row.key} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: '#0c1446' }}>{row.key}</td>
                    <td style={{ padding: '9px 14px', color: '#374151' }}>{row.count}</td>
                    <td style={{ padding: '9px 14px', color: '#374151', fontWeight: aggFunc === 'sum' ? 700 : 400 }}>{Number(row.sum).toLocaleString()}</td>
                    <td style={{ padding: '9px 14px', color: '#374151', fontWeight: aggFunc === 'mean' ? 700 : 400 }}>{Number(row.mean).toLocaleString()}</td>
                    <td style={{ padding: '9px 14px', color: '#374151' }}>{Number(row.min).toLocaleString()}</td>
                    <td style={{ padding: '9px 14px', color: '#374151' }}>{Number(row.max).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!pivot && (
        <EmptyState
          icon="🔄"
          title="Configure grouping and click Build Pivot"
          body="Pick a column to group by, a numeric value, and an aggregation. Use the date filter to scope to a window."
        />
      )}
    </div>
  )
}
