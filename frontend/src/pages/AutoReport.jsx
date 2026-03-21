import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function AutoReport() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function generate() {
    if (!fileId) return
    setLoading(true); setReport(null)
    analyticsApi.summary(fileId).then(r => {
      const raw = r.data
      const summary = raw.summary || {}
      const totalRows = raw.rows || 0
      const totalCols = raw.columns || 0
      const numericCols = Object.entries(summary).filter(([, v]) => v.type === 'numeric')
      const textCols = Object.entries(summary).filter(([, v]) => v.type !== 'numeric')

      const insights = []
      // Missing values
      const missingCols = Object.entries(summary).filter(([, v]) => (totalRows - (v.count || 0)) > 0)
      if (missingCols.length === 0) insights.push({ type: 'positive', text: 'Data completeness is excellent — no missing values detected across all columns.' })
      else insights.push({ type: 'warning', text: `Missing values found in ${missingCols.length} column(s): ${missingCols.map(([k]) => k).join(', ')}.` })

      // Numeric analysis
      if (numericCols.length > 0) {
        const [topCol, topStats] = [...numericCols].sort((a, b) => (b[1].mean || 0) - (a[1].mean || 0))[0]
        insights.push({ type: 'info', text: `Highest average numeric column: **${topCol}** with mean of ${(topStats.mean || 0).toFixed(2)}.` })
        numericCols.forEach(([col, stats]) => {
          if (stats.max && stats.min && stats.mean) {
            const range = stats.max - stats.min
            if (range / (stats.mean || 1) > 5) insights.push({ type: 'warning', text: `High variance detected in **${col}** — range is ${range.toFixed(2)}, which is ${(range / stats.mean).toFixed(1)}x the mean. Consider investigating outliers.` })
          }
        })
      }

      // Generate report sections
      const sections = [
        {
          title: '📊 Dataset Overview',
          content: `This dataset contains **${totalRows.toLocaleString()} rows** and **${totalCols} columns** (${numericCols.length} numeric, ${textCols.length} categorical).`
        },
        {
          title: '🔢 Numeric Columns Summary',
          rows: numericCols.map(([col, stats]) => ({
            Column: col,
            Count: (stats.count || 0).toLocaleString(),
            Mean: (stats.mean || 0).toFixed(2),
            Min: (stats.min || 0).toFixed(2),
            Max: (stats.max || 0).toFixed(2),
            Missing: totalRows - (stats.count || 0)
          }))
        },
        {
          title: '🏷️ Categorical Columns Summary',
          rows: textCols.map(([col, stats]) => ({
            Column: col,
            Count: (stats.count || 0).toLocaleString(),
            'Top Value': stats.top || '—',
            'Top Freq': stats.freq || '—',
            Missing: totalRows - (stats.count || 0)
          }))
        }
      ]

      setReport({ insights, sections, filename: raw.filename, generated: new Date().toLocaleString() })
    }).catch(() => {}).finally(() => setLoading(false))
  }

  const iconMap = { positive: '✅', warning: '⚠️', info: 'ℹ️' }
  const colorMap = { positive: '#10b981', warning: '#f59e0b', info: '#0097b2' }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Auto Report AI</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Automatically generate a comprehensive data analysis report</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Select Dataset</div>
            <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose a file --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <button onClick={generate} disabled={!fileId || loading} style={{ padding: '9px 24px', background: fileId && !loading ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId && !loading ? 'pointer' : 'default' }}>
            {loading ? '🔄 Generating...' : '✨ Generate Report'}
          </button>
        </div>
      </div>

      {report && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, color: '#0c1446', fontSize: '1.2rem' }}>Data Analysis Report</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{report.filename} — Generated {report.generated}</div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>🔍 Key Insights</div>
            {report.insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1rem', marginTop: 1 }}>{iconMap[ins.type]}</span>
                <span style={{ fontSize: '0.9rem', color: '#374151' }}>{ins.text.replace(/\*\*(.*?)\*\*/g, '$1')}</span>
              </div>
            ))}
          </div>

          {report.sections.map(sec => (
            <div key={sec.title} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>{sec.title}</div>
              {sec.content ? (
                <p style={{ color: '#374151', margin: 0, lineHeight: 1.6 }}>{sec.content.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
              ) : sec.rows && sec.rows.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead><tr style={{ background: '#f9fafb' }}>{Object.keys(sec.rows[0]).map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
                    <tbody>{sec.rows.map((r, i) => <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>{Object.values(r).map((v, vi) => <td key={vi} style={{ padding: '7px 12px', color: v === 0 ? '#9ca3af' : v > 0 && vi === Object.keys(r).length - 1 ? '#ef4444' : '#374151', borderBottom: '1px solid #f3f4f6' }}>{v}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              ) : <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No data available.</div>}
            </div>
          ))}
        </div>
      )}

      {!report && !loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div><div>Select a dataset and click Generate Report to get instant insights</div></div>}
    </div>
  )
}
