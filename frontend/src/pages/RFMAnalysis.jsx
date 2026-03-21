import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

var SEGMENTS = [
  { name: 'Champions', r: [4,5], f: [4,5], m: [4,5], color: '#e91e8c', desc: 'Bought recently, buy often, spend the most' },
  { name: 'Loyal', r: [3,5], f: [3,5], m: [3,5], color: '#0097b2', desc: 'Regular buyers with good spend' },
  { name: 'Potential', r: [3,5], f: [1,3], m: [1,3], color: '#10b981', desc: 'Recent buyers who could become loyal' },
  { name: 'At Risk', r: [1,2], f: [3,5], m: [3,5], color: '#f59e0b', desc: 'Were loyal but have not bought recently' },
  { name: 'Lost', r: [1,2], f: [1,2], m: [1,2], color: '#ef4444', desc: 'Low engagement across all dimensions' }
]

function scoreToSegment(r, f, m) {
  for (var i = 0; i < SEGMENTS.length; i++) {
    var s = SEGMENTS[i]
    if (r >= s.r[0] && r <= s.r[1] && f >= s.f[0] && f <= s.f[1] && m >= s.m[0] && m <= s.m[1]) return s.name
  }
  return 'Other'
}

function scoreQuintile(values, v) {
  var sorted = values.slice().sort(function(a, b) { return a - b })
  var idx = sorted.indexOf(v)
  var pct = (idx / (sorted.length - 1)) * 100
  if (pct >= 80) return 5
  if (pct >= 60) return 4
  if (pct >= 40) return 3
  if (pct >= 20) return 2
  return 1
}

function computeRFM(rows, customerCol, dateCol, monetaryCol) {
  var customers = {}
  var now = new Date()

  rows.forEach(function(row) {
    var id = row[customerCol]
    var d = new Date(row[dateCol])
    var val = parseFloat(row[monetaryCol]) || 0
    if (!id) return
    if (!customers[id]) customers[id] = { id: id, dates: [], total: 0 }
    if (!isNaN(d.getTime())) customers[id].dates.push(d)
    customers[id].total += val
  })

  var records = Object.values(customers).filter(function(c) { return c.dates.length > 0 })

  records.forEach(function(c) {
    var latest = new Date(Math.max.apply(null, c.dates))
    c.recency = Math.floor((now - latest) / (1000 * 60 * 60 * 24))
    c.frequency = c.dates.length
    c.monetary = c.total
  })

  var recencies = records.map(function(c) { return c.recency })
  var freqs = records.map(function(c) { return c.frequency })
  var moneys = records.map(function(c) { return c.monetary })

  records.forEach(function(c) {
    c.rScore = 6 - scoreQuintile(recencies, c.recency)
    c.fScore = scoreQuintile(freqs, c.frequency)
    c.mScore = scoreQuintile(moneys, c.monetary)
    c.segment = scoreToSegment(c.rScore, c.fScore, c.mScore)
  })

  return records
}

export default function RFMAnalysis() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [customerCol, setCustomerCol] = useState('')
  const [dateCol, setDateCol] = useState('')
  const [monetaryCol, setMonetaryCol] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(function() {
    filesApi.list().then(function(r) { setFiles(r.data || []) }).catch(function() {})
  }, [])

  function onFileChange(id) {
    setFileId(id); setHeaders([]); setResults(null); setError('')
    setCustomerCol(''); setDateCol(''); setMonetaryCol('')
    if (!id) return
    setPreviewLoading(true)
    analyticsApi.preview(id)
      .then(function(r) { setHeaders(r.data.headers || []) })
      .catch(function() { setError('Could not load file columns.') })
      .finally(function() { setPreviewLoading(false) })
  }

  function run() {
    if (!fileId || !customerCol || !dateCol || !monetaryCol) return
    setLoading(true); setError(''); setResults(null)
    analyticsApi.preview(fileId)
      .then(function(r) {
        var rows = r.data.rows || []
        if (rows.length < 2) { setError('Not enough data to compute RFM scores.'); return }
        var rfm = computeRFM(rows, customerCol, dateCol, monetaryCol)
        if (rfm.length === 0) { setError('No valid customer records found with the selected columns.'); return }
        setResults(rfm)
      })
      .catch(function() { setError('Analysis failed. Please check the file and column selections.') })
      .finally(function() { setLoading(false) })
  }

  var segmentCounts = {}
  if (results) {
    SEGMENTS.forEach(function(s) { segmentCounts[s.name] = 0 })
    segmentCounts['Other'] = 0
    results.forEach(function(r) { segmentCounts[r.segment] = (segmentCounts[r.segment] || 0) + 1 })
  }

  var chartData = SEGMENTS.map(function(s) { return { name: s.name, count: segmentCounts[s.name] || 0, color: s.color } })

  var selectStyle = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', background: '#fff' }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>RFM Analysis</h1>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: '0.95rem' }}>Segment customers by Recency, Frequency and Monetary value</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={function(e) { onFileChange(e.target.value) }} style={selectStyle}>
              <option value="">-- Choose a file --</option>
              {files.map(function(f) { return <option key={f.id} value={f.id}>{f.filename}</option> })}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Customer ID column</div>
            <select value={customerCol} onChange={function(e) { setCustomerCol(e.target.value) }} style={selectStyle} disabled={!headers.length}>
              <option value="">-- Select --</option>
              {headers.map(function(h) { return <option key={h} value={h}>{h}</option> })}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Date column</div>
            <select value={dateCol} onChange={function(e) { setDateCol(e.target.value) }} style={selectStyle} disabled={!headers.length}>
              <option value="">-- Select --</option>
              {headers.map(function(h) { return <option key={h} value={h}>{h}</option> })}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Monetary column</div>
            <select value={monetaryCol} onChange={function(e) { setMonetaryCol(e.target.value) }} style={selectStyle} disabled={!headers.length}>
              <option value="">-- Select --</option>
              {headers.map(function(h) { return <option key={h} value={h}>{h}</option> })}
            </select>
          </div>
          <button onClick={run} disabled={!customerCol || !dateCol || !monetaryCol || loading}
            style={{ padding: '10px 24px', background: (customerCol && dateCol && monetaryCol && !loading) ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: (customerCol && dateCol && monetaryCol && !loading) ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
            {loading ? 'Running...' : 'Run RFM'}
          </button>
        </div>
        {previewLoading && <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#6b7280' }}>Loading columns...</div>}
        {!files.length && <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#9ca3af' }}>No files found. Upload a CSV or Excel file via My Files first.</div>}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, color: '#dc2626', fontSize: '0.875rem', marginBottom: 20 }}>{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #f3f4f6', borderTop: '4px solid #e91e8c', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#6b7280' }}>Computing RFM scores...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {results && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 16, marginBottom: 28 }}>
            {SEGMENTS.map(function(s) {
              return (
                <div key={s.name} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid ' + s.color, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{segmentCounts[s.name] || 0}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0c1446', marginTop: 4 }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>{s.desc}</div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0c1446', marginBottom: 16 }}>Segment Distribution</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {chartData.map(function(entry, i) { return <Cell key={i} fill={entry.color} /> })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0c1446', marginBottom: 16 }}>Segment Summary</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>Segment</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>Customers</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {SEGMENTS.map(function(s) {
                    var count = segmentCounts[s.name] || 0
                    var pct = results.length ? ((count / results.length) * 100).toFixed(1) : '0'
                    return (
                      <tr key={s.name}>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          {s.name}
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #f9fafb', fontWeight: 600 }}>{count}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #f9fafb', color: '#6b7280' }}>{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0c1446', marginBottom: 16 }}>Customer Scores (top 50)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Customer</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Recency (days)</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Frequency</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Monetary</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>R/F/M</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 50).map(function(c, i) {
                    var seg = SEGMENTS.find(function(s) { return s.name === c.segment })
                    var segColor = seg ? seg.color : '#6b7280'
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}>{c.id}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{c.recency}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{c.frequency}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{Number(c.monetary).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontFamily: 'monospace' }}>{c.rScore}/{c.fScore}/{c.mScore}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                          <span style={{ background: segColor + '22', color: segColor, padding: '2px 10px', borderRadius: 20, fontWeight: 600, fontSize: '0.78rem' }}>{c.segment}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {results.length > 50 && <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#9ca3af' }}>Showing 50 of {results.length} customers</div>}
          </div>
        </div>
      )}

      {!results && !loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12, color: '#d1d5db', fontWeight: 300 }}>[ RFM ]</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Map your columns to get started</div>
          <div style={{ fontSize: '0.875rem', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>Select a file and map the Customer ID, Date and Monetary columns to automatically compute RFM scores and segment your customers.</div>
        </div>
      )}
    </div>
  )
}
