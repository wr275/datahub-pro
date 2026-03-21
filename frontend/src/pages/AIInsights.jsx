import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

function generateInsights(summary) {
  const out = { key: [], quality: [], highlights: [], recs: [] }
  if (!summary) return out
  const nc = summary.numeric_columns || []
  const tc = summary.text_columns || []
  const rows = summary.total_rows || 0
  const cols = summary.total_columns || 0

  out.key.push('Dataset has ' + rows.toLocaleString() + ' records and ' + cols + ' columns.')
  if (nc.length) out.key.push(nc.length + ' numeric column' + (nc.length > 1 ? 's' : '') + ' ready for quantitative analysis.')
  if (tc.length) out.key.push(tc.length + ' categorical column' + (tc.length > 1 ? 's' : '') + ' available for grouping and segmentation.')
  const ws = nc.filter(function(c) { return c.mean != null })
  if (ws.length) {
    const top = ws.reduce(function(a, b) { return a.mean > b.mean ? a : b })
    out.key.push('"' + top.column + '" has the highest average: ' + Number(top.mean).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '.')
  }

  const miss = nc.filter(function(c) { return c.missing > 0 })
  if (!miss.length) {
    out.quality.push('All numeric columns are complete - no missing values detected.')
  } else {
    miss.forEach(function(c) {
      out.quality.push('"' + c.column + '": ' + c.missing + ' missing values (' + ((c.missing / rows) * 100).toFixed(1) + '%).')
    })
  }
  const tmiss = tc.filter(function(c) { return c.missing > 0 })
  if (tmiss.length) out.quality.push(tmiss.length + ' categorical column' + (tmiss.length > 1 ? 's' : '') + ' have missing values.')
  else if (tc.length) out.quality.push('All categorical columns are complete with no missing values.')
  if (rows < 100) out.quality.push('Small dataset - statistical conclusions may have limited reliability.')
  else if (rows > 10000) out.quality.push('Large dataset (' + rows.toLocaleString() + ' rows) - results are statistically robust.')

  nc.forEach(function(c) {
    if (c.std != null && c.mean != null && c.mean !== 0) {
      const cv = Math.abs(c.std / c.mean)
      if (cv > 1.5) out.highlights.push('"' + c.column + '" shows high variability (CV=' + cv.toFixed(2) + ') - wide range across records.')
    }
    if (c.min != null && c.min < 0) out.highlights.push('"' + c.column + '" contains negative values (min: ' + Number(c.min).toLocaleString() + ').')
  })
  if (!out.highlights.length) {
    nc.slice(0, 3).forEach(function(c) {
      if (c.mean != null) out.highlights.push('"' + c.column + '": avg=' + Number(c.mean).toFixed(2) + ', range ' + Number(c.min).toFixed(2) + ' to ' + Number(c.max).toFixed(2) + '.')
    })
  }
  if (!out.highlights.length) out.highlights.push('No notable anomalies detected in numeric distributions.')

  if (nc.length >= 2) out.recs.push('Use the Analytics page to visualise and compare your numeric columns.')
  if (tc.length && nc.length) out.recs.push('Run RFM Analysis to segment customers if you have transaction or order data.')
  if (rows >= 30) out.recs.push('Try the Trends page to identify patterns over time if you have a date column.')
  out.recs.push('Share insights with teammates via the Team page for collaborative review.')

  return out
}

function InsightCard(props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid ' + props.color }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0c1446', marginBottom: 14 }}>{props.title}</div>
      {props.items.map(function(t, i) {
        return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: props.color, marginTop: 6, flexShrink: 0 }} />
            <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{t}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function AIInsights() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(function() {
    filesApi.list().then(function(r) { setFiles(r.data || []) }).catch(function() {})
  }, [])

  function run() {
    if (!fileId) return
    setLoading(true); setError(''); setSummary(null)
    analyticsApi.summary(fileId)
      .then(function(r) { setSummary(r.data) })
      .catch(function() { setError('Analysis failed. Please check the file and try again.') })
      .finally(function() { setLoading(false) })
  }

  const ins = generateInsights(summary)

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>AI Insights</h1>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: '0.95rem' }}>Auto-generated findings, quality checks and recommendations from your data</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Select file to analyse</div>
            <select value={fileId} onChange={function(e) { setFileId(e.target.value); setSummary(null) }}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', background: '#fff' }}>
              <option value="">-- Choose a file --</option>
              {files.map(function(f) { return <option key={f.id} value={f.id}>{f.filename}</option> })}
            </select>
          </div>
          <button onClick={run} disabled={!fileId || loading}
            style={{ padding: '10px 28px', background: (fileId && !loading) ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: (fileId && !loading) ? 'pointer' : 'default' }}>
            {loading ? 'Analysing...' : 'Generate Insights'}
          </button>
        </div>
        {!files.length && <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#9ca3af' }}>No files found. Upload a CSV or Excel file via My Files first.</div>}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, color: '#dc2626', fontSize: '0.875rem', marginBottom: 20 }}>{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #f3f4f6', borderTop: '4px solid #e91e8c', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#6b7280' }}>Generating insights...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {summary && (
        <div>
          <div style={{ background: 'linear-gradient(135deg,#0c1446,#0097b2)', borderRadius: 12, padding: 18, marginBottom: 24, color: '#fff', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: '0.8rem', opacity: 0.7 }}>File</div><div style={{ fontWeight: 700 }}>{summary.filename}</div></div>
            <div><div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Rows</div><div style={{ fontWeight: 700 }}>{(summary.total_rows || 0).toLocaleString()}</div></div>
            <div><div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Columns</div><div style={{ fontWeight: 700 }}>{summary.total_columns || 0}</div></div>
            <div><div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Numeric</div><div style={{ fontWeight: 700 }}>{(summary.numeric_columns || []).length}</div></div>
            <div><div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Categorical</div><div style={{ fontWeight: 700 }}>{(summary.text_columns || []).length}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
            <InsightCard title="Key Findings" items={ins.key} color="#e91e8c" />
            <InsightCard title="Data Quality" items={ins.quality} color="#0097b2" />
            <InsightCard title="Column Highlights" items={ins.highlights} color="#10b981" />
            <InsightCard title="Recommendations" items={ins.recs} color="#f59e0b" />
          </div>
        </div>
      )}

      {!summary && !loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12, color: '#d1d5db', fontWeight: 300 }}>[ ? ]</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Select a file to get started</div>
          <div style={{ fontSize: '0.875rem', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>AI Insights will automatically analyse your dataset and surface key findings, data quality issues, and actionable recommendations.</div>
        </div>
      )}
    </div>
  )
}
