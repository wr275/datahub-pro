import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

function generateInsights(data) {
  const out = { key: [], quality: [], highlights: [] }
  if (!data) return out

  const rows = data.rows || 0
  const cols = data.columns || 0
  const summaryObj = data.summary || {}

  // Build numeric and text column arrays from the summary object
  const nc = Object.entries(summaryObj).filter(([, v]) => v.type === 'numeric').map(([col, v]) => ({ column: col, ...v }))
  const tc = Object.entries(summaryObj).filter(([, v]) => v.type === 'text').map(([col, v]) => ({ column: col, ...v }))

  // Key findings
  out.key.push('Dataset has ' + rows.toLocaleString() + ' records and ' + cols + ' columns.')
  if (nc.length) out.key.push(nc.length + ' numeric column' + (nc.length > 1 ? 's' : '') + ' ready for quantitative analysis.')
  if (tc.length) out.key.push(tc.length + ' categorical column' + (tc.length > 1 ? 's' : '') + ' available for grouping and segmentation.')

  // Highest average numeric column
  if (nc.length) {
    const top = nc.reduce((a, b) => (b.mean > a.mean ? b : a), nc[0])
    if (top && top.mean) out.key.push('"' + top.column + '" has the highest average: ' + Number(top.mean).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '.')
  }

  // Data quality
  const nmiss = nc.filter(c => (c.count || 0) < rows)
  const tmiss = tc.filter(c => (c.count || 0) < rows)
  if (!nmiss.length && nc.length) out.quality.push('All numeric columns are complete - no missing values detected.')
  nmiss.forEach(c => {
    const missing = rows - (c.count || 0)
    out.quality.push('"' + c.column + '": ' + missing + ' missing values (' + ((missing / rows) * 100).toFixed(1) + '%).')
  })
  if (!tmiss.length && tc.length) out.quality.push('All categorical columns are complete with no missing values.')
  else if (tmiss.length) out.quality.push(tmiss.length + ' categorical column' + (tmiss.length > 1 ? 's' : '') + ' have missing values.')
  if (rows < 100) out.quality.push('Small dataset - statistical conclusions may have limited reliability.')
  else if (rows > 10000) out.quality.push('Large dataset (' + rows.toLocaleString() + ' rows) - results are statistically robust.')

  // Column highlights
  nc.forEach(c => {
    if (c.min !== undefined && c.max !== undefined) {
      const range = c.max - c.min
      if (range === 0) out.highlights.push('"' + c.column + '" has no variance (all values are identical).')
      else out.highlights.push('"' + c.column + '" ranges from ' + Number(c.min).toLocaleString() + ' to ' + Number(c.max).toLocaleString() + '.')
    }
  })
  tc.forEach(c => {
    if (c.unique) out.highlights.push('"' + c.column + '" has ' + c.unique + ' unique value' + (c.unique > 1 ? 's' : '') + (c.top_values?.length ? ': ' + c.top_values.slice(0, 3).join(', ') : '') + '.')
  })
  if (!out.highlights.length) out.highlights.push('No notable anomalies detected in numeric distributions.')

  return out
}

export default function AIInsights() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [insights, setInsights] = useState(null)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
  }, [])

  const handleGenerate = async () => {
    if (!selectedFile) return
    setLoading(true)
    setData(null)
    setInsights(null)
    try {
      const res = await analyticsApi.summary(selectedFile)
      const d = res.data || res
      setData(d)
      setInsights(generateInsights(d))
    } catch (e) {
      console.error('AI Insights error', e)
    } finally {
      setLoading(false)
    }
  }

  const numericCount = data ? Object.values(data.summary || {}).filter(v => v.type === 'numeric').length : 0
  const categoricalCount = data ? Object.values(data.summary || {}).filter(v => v.type === 'text').length : 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0c1446', margin: '0 0 4px' }}>AI Insights</h1>
      <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: '0.9rem' }}>Auto-generated findings, quality checks and recommendations from your data</p>

      <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Select file to analyse</label>
          <select
            value={selectedFile}
            onChange={e => setSelectedFile(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', background: '#fff' }}
          >
            <option value=''>-- Choose a file --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedFile || loading}
          style={{ marginTop: 22, padding: '10px 24px', background: selectedFile && !loading ? 'linear-gradient(135deg,#e91e8c,#c4166e)' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: selectedFile && !loading ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
        >
          {loading ? 'Generating...' : 'Generate Insights'}
        </button>
      </div>

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>[ ? ]</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>Select a file to get started</div>
          <div style={{ fontSize: '0.85rem' }}>AI Insights will automatically analyse your dataset and surface key findings, data quality issues, and actionable recommendations.</div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>⏳</div>
          <div>Analysing your data...</div>
        </div>
      )}

      {data && insights && (
        <>
          <div style={{ background: 'linear-gradient(135deg,#0c1446,#0097b2)', borderRadius: 12, padding: '16px 24px', marginBottom: 24, display: 'flex', gap: 32, color: '#fff' }}>
            <div><div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 2 }}>File</div><div style={{ fontWeight: 700 }}>{data.filename}</div></div>
            <div><div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 2 }}>Rows</div><div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{(data.rows || 0).toLocaleString()}</div></div>
            <div><div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 2 }}>Columns</div><div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{data.columns || 0}</div></div>
            <div><div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 2 }}>Numeric</div><div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{numericCount}</div></div>
            <div><div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 2 }}>Categorical</div><div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{categoricalCount}</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontWeight: 800, color: '#0c1446', marginBottom: 12, fontSize: '0.95rem' }}>🔍 Key Findings</div>
              {insights.key.map((t, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.85rem', color: '#374151' }}><span>•</span><span>{t}</span></div>)}
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontWeight: 800, color: '#0c1446', marginBottom: 12, fontSize: '0.95rem' }}>✅ Data Quality</div>
              {insights.quality.map((t, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.85rem', color: '#374151' }}><span>•</span><span>{t}</span></div>)}
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontWeight: 800, color: '#0c1446', marginBottom: 12, fontSize: '0.95rem' }}>📊 Column Highlights</div>
              {insights.highlights.map((t, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.85rem', color: '#374151' }}><span>•</span><span>{t}</span></div>)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
