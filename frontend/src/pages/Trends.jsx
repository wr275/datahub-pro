import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

var COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#6366f1']

function movingAverage(data, key, window) {
  return data.map(function(d, i) {
    var start = Math.max(0, i - window + 1)
    var slice = data.slice(start, i + 1)
    var avg = slice.reduce(function(sum, x) { return sum + (parseFloat(x[key]) || 0) }, 0) / slice.length
    var out = Object.assign({}, d)
    out['_ma_' + key] = parseFloat(avg.toFixed(2))
    return out
  })
}

function parseDate(str) {
  if (!str) return null
  var d = new Date(str)
  if (!isNaN(d.getTime())) return d
  var parts = str.split(/[-\/]/)
  if (parts.length >= 3) {
    var d2 = new Date(parts[2], parts[1] - 1, parts[0])
    if (!isNaN(d2.getTime())) return d2
  }
  return null
}

function buildChartData(rows, dateCol, valueCols) {
  var grouped = {}
  rows.forEach(function(row) {
    var d = parseDate(row[dateCol])
    if (!d) return
    var key = d.toISOString().substring(0, 10)
    if (!grouped[key]) grouped[key] = { date: key, _count: 0 }
    valueCols.forEach(function(col) {
      var v = parseFloat(row[col])
      if (!isNaN(v)) {
        grouped[key][col] = (grouped[key][col] || 0) + v
        grouped[key]['_count']++
      }
    })
  })

  var sorted = Object.values(grouped).sort(function(a, b) { return a.date > b.date ? 1 : -1 })

  if (sorted.length > 60) {
    var step = Math.ceil(sorted.length / 60)
    sorted = sorted.filter(function(_, i) { return i % step === 0 })
  }

  return sorted
}

export default function Trends() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [dateCol, setDateCol] = useState('')
  const [valueCols, setValueCols] = useState([])
  const [showMA, setShowMA] = useState(true)
  const [chartData, setChartData] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(function() {
    filesApi.list().then(function(r) { setFiles(r.data || []) }).catch(function() {})
  }, [])

  function onFileChange(id) {
    setFileId(id); setHeaders([]); setChartData(null); setStats(null); setError('')
    setDateCol(''); setValueCols([])
    if (!id) return
    setPreviewLoading(true)
    analyticsApi.preview(id)
      .then(function(r) { setHeaders(r.data.headers || []) })
      .catch(function() { setError('Could not load file columns.') })
      .finally(function() { setPreviewLoading(false) })
  }

  function toggleValueCol(col) {
    setValueCols(function(prev) {
      if (prev.includes(col)) return prev.filter(function(c) { return c !== col })
      if (prev.length >= 4) return prev
      return prev.concat([col])
    })
  }

  function run() {
    if (!fileId || !dateCol || valueCols.length === 0) return
    setLoading(true); setError(''); setChartData(null); setStats(null)
    analyticsApi.preview(fileId)
      .then(function(r) {
        var rows = r.data.rows || []
        if (rows.length < 3) { setError('Not enough data points to draw a trend.'); return }
        var data = buildChartData(rows, dateCol, valueCols)
        if (data.length < 2) { setError('Could not parse dates. Please check the date column format (YYYY-MM-DD recommended).'); return }

        var maData = data
        valueCols.forEach(function(col) {
          maData = movingAverage(maData, col, 3)
        })

        setChartData(maData)

        var statsOut = {}
        valueCols.forEach(function(col) {
          var vals = data.map(function(d) { return d[col] }).filter(function(v) { return v != null && !isNaN(v) })
          if (vals.length === 0) return
          var sum = vals.reduce(function(a, b) { return a + b }, 0)
          var min = Math.min.apply(null, vals)
          var max = Math.max.apply(null, vals)
          var avg = sum / vals.length
          var first = vals[0]; var last = vals[vals.length - 1]
          var pctChange = first !== 0 ? ((last - first) / first * 100) : 0
          statsOut[col] = { sum: sum, min: min, max: max, avg: avg, pctChange: pctChange, count: vals.length }
        })
        setStats(statsOut)
      })
      .catch(function() { setError('Analysis failed. Please check the file and column selections.') })
      .finally(function() { setLoading(false) })
  }

  var canRun = fileId && dateCol && valueCols.length > 0 && !loading

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Trends</h1>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: '0.95rem' }}>Visualise time-series data, identify patterns and track performance over time</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={function(e) { onFileChange(e.target.value) }}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', background: '#fff' }}>
              <option value="">-- Choose a file --</option>
              {files.map(function(f) { return <option key={f.id} value={f.id}>{f.filename}</option> })}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Date column</div>
            <select value={dateCol} onChange={function(e) { setDateCol(e.target.value) }}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', background: '#fff' }} disabled={!headers.length}>
              <option value="">-- Select --</option>
              {headers.map(function(h) { return <option key={h} value={h}>{h}</option> })}
            </select>
          </div>
        </div>

        {headers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Value columns to plot (select up to 4)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {headers.filter(function(h) { return h !== dateCol }).map(function(h, i) {
                var selected = valueCols.includes(h)
                var colIdx = valueCols.indexOf(h)
                return (
                  <button key={h} onClick={function() { toggleValueCol(h) }}
                    style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid ' + (selected ? COLORS[colIdx] : '#d1d5db'), background: selected ? COLORS[colIdx] + '18' : '#fff', color: selected ? COLORS[colIdx] : '#6b7280', fontWeight: selected ? 700 : 400, fontSize: '0.82rem', cursor: 'pointer' }}>
                    {h}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={run} disabled={!canRun}
            style={{ padding: '10px 28px', background: canRun ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: canRun ? 'pointer' : 'default' }}>
            {loading ? 'Loading...' : 'Plot Trends'}
          </button>
          {chartData && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={showMA} onChange={function(e) { setShowMA(e.target.checked) }} />
              Show 3-point moving average
            </label>
          )}
        </div>
        {previewLoading && <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#6b7280' }}>Loading columns...</div>}
        {!files.length && <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#9ca3af' }}>No files found. Upload a CSV via My Files first.</div>}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, color: '#dc2626', fontSize: '0.875rem', marginBottom: 20 }}>{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #f3f4f6', borderTop: '4px solid #e91e8c', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#6b7280' }}>Building trend chart...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {chartData && stats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
            {valueCols.map(function(col, i) {
              var s = stats[col]
              if (!s) return null
              var up = s.pctChange >= 0
              return (
                <div key={col} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid ' + COLORS[i] }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1446' }}>{Number(s.avg).toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    <span style={{ color: '#6b7280' }}>avg </span>
                    <span style={{ color: up ? '#10b981' : '#ef4444', fontWeight: 600 }}>{up ? '+' : ''}{s.pctChange.toFixed(1)}%</span>
                    <span style={{ color: '#9ca3af' }}> overall</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
                    min {Number(s.min).toLocaleString(undefined, { maximumFractionDigits: 1 })} / max {Number(s.max).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0c1446', marginBottom: 16 }}>
              Trend Chart ({chartData.length} data points)
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.ceil(chartData.length / 8)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: '0.82rem' }} />
                <Legend wrapperStyle={{ fontSize: '0.82rem' }} />
                {valueCols.map(function(col, i) {
                  return (
                    <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i]} strokeWidth={2} dot={false} name={col} />
                  )
                })}
                {showMA && valueCols.map(function(col, i) {
                  return (
                    <Line key={'_ma_' + col} type="monotone" dataKey={'_ma_' + col} stroke={COLORS[i]} strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={col + ' (3-pt MA)'} />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#9ca3af' }}>Note: Values are summed per date. Dashed lines show 3-point moving average. Data limited to first 100 rows from file.</div>
          </div>
        </div>
      )}

      {!chartData && !loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12, color: '#d1d5db', fontWeight: 300 }}>[ ~ ]</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Select columns to plot</div>
          <div style={{ fontSize: '0.875rem', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>Choose a file with a date column and one or more numeric value columns to visualise trends over time with moving average overlays.</div>
        </div>
      )}
    </div>
  )
}
