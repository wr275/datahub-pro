import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import DateRangePicker, { applyDateFilter } from '../components/ui/DateRangePicker'

export default function AnomalyDetection() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [col, setCol] = useState('')
  const [method, setMethod] = useState('zscore')
  const [threshold, setThreshold] = useState(2.5)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResults(null); setDateRange(null)
    if (!id) return
    analyticsApi.preview(id).then(r => {
      const hs = r.data.headers || []; const rs = r.data.rows || []
      setHeaders(hs); setRows(rs)
      const numCol = hs.find(h => rs.slice(0, 5).some(row => !isNaN(parseFloat(row[h]))))
      if (numCol) setCol(numCol)
    }).catch(() => {})
  }

  function run() {
    if (!col || !rows.length) return
    setLoading(true)
    setTimeout(() => {
      const scoped = applyDateFilter(rows, dateRange)
      if (!scoped.length) { setResults(null); setLoading(false); return }
      const vals = scoped.map((r, i) => ({ i, v: parseFloat(r[col]) || 0, row: r }))
      const nums = vals.map(x => x.v)
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length
      const std = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length)
      const sorted = [...nums].sort((a, b) => a - b)
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const iqr = q3 - q1

      const anomalies = []
      const normal = []
      vals.forEach(({ i, v, row }) => {
        let isAnomaly = false
        if (method === 'zscore') { const z = Math.abs((v - mean) / (std || 1)); isAnomaly = z > threshold }
        else { isAnomaly = v < q1 - threshold * iqr || v > q3 + threshold * iqr }
        const point = { index: i, value: v, label: String(i + 1) };
        (isAnomaly ? anomalies : normal).push(point)
      })

      setResults({ anomalies, normal, mean, std, q1, q3, iqr, total: vals.length })
      setLoading(false)
    }, 300)
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Anomaly Detection</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Identify outliers and unusual data points using statistical methods</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Column</div>
            <select value={col} onChange={e => setCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Column --</option>
              {numericCols.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Method</div>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="zscore">Z-Score</option>
              <option value="iqr">IQR (Tukey)</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Threshold: {threshold}</div>
            <input type="range" min="1" max="4" step="0.1" value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} style={{ width: '100%', marginTop: 8 }} />
          </div>
        </div>

        {headers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <DateRangePicker
              columns={headers}
              value={dateRange}
              onChange={setDateRange}
              storageKey="anomaly-detection.dateRange"
            />
          </div>
        )}

        <button onClick={run} disabled={!col} style={{ padding: '9px 24px', background: col ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: col ? 'pointer' : 'default' }}>
          {loading ? 'Detecting...' : 'Detect Anomalies'}
        </button>
      </div>

      {results && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[['Total Points', results.total, '#0c1446'], ['Anomalies Found', results.anomalies.length, '#ef4444'], ['Normal Points', results.normal.length, '#10b981'], ['Anomaly Rate', (results.anomalies.length / results.total * 100).toFixed(1) + '%', '#f59e0b']].map(([k, v, c]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Value Distribution with Anomalies</div>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="index" name="Index" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="value" name="Value" tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <ReferenceLine y={results.mean} stroke="#0097b2" strokeDasharray="4 4" label={{ value: 'Mean', position: 'right', fontSize: 11 }} />
                  <Scatter name="Normal" data={results.normal} fill="#10b981" opacity={0.6} r={3} />
                  <Scatter name="Anomaly" data={results.anomalies} fill="#ef4444" r={5} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Statistics</div>
              {[['Mean', results.mean?.toFixed(3)], ['Std Dev', results.std?.toFixed(3)], ['Q1', results.q1?.toFixed(3)], ['Q3', results.q3?.toFixed(3)], ['IQR', results.iqr?.toFixed(3)]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{k}</span>
                  <span style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.875rem' }}>{v}</span>
                </div>
              ))}
              {results.anomalies.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ef4444', marginBottom: 8 }}>Top Anomalies (by value):</div>
                  {results.anomalies.slice(0, 5).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).map(a => (
                    <div key={a.index} style={{ fontSize: '0.8rem', color: '#374151', padding: '3px 0' }}>Row {a.index + 1}: {a.value}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!results && !loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</div><div>Select a file and column to detect anomalies</div></div>}
    </div>
  )
}
