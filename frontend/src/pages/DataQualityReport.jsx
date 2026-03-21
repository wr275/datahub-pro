import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function DataQualityReport() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function run() {
    if (!fileId) return
    setLoading(true)
    Promise.all([analyticsApi.summary(fileId), analyticsApi.preview(fileId)]).then(([sr, pr]) => {
      const s = sr.data; const p = pr.data
      const totalRows = s.rows || 0
      const cols = []
      Object.entries(s.summary || {}).forEach(([col, stats]) => {
        const filled = stats.count || 0
        const missing = totalRows - filled
        const missingPct = totalRows > 0 ? ((missing / totalRows) * 100).toFixed(1) : 0
        const quality = missingPct > 20 ? 'Poor' : missingPct > 5 ? 'Fair' : 'Good'
        cols.push({ col, type: stats.type, filled, missing, missingPct, quality, unique: stats.unique || null, min: stats.min || null, max: stats.max || null })
      })
      const overallScore = Math.round(cols.reduce((a, c) => a + (c.quality === 'Good' ? 100 : c.quality === 'Fair' ? 60 : 30), 0) / (cols.length || 1))
      setReport({ filename: s.filename, totalRows, totalCols: s.columns, cols, overallScore })
    }).catch(() => {}).finally(() => setLoading(false))
  }

  const qualityColor = q => q === 'Good' ? '#10b981' : q === 'Fair' ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Data Quality Report</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Assess completeness, consistency and quality of your data</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
            <option value="">-- Choose a file --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <button onClick={run} disabled={!fileId || loading} style={{ padding: '9px 24px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>
          {loading ? 'Analysing...' : 'Run Quality Check'}
        </button>
      </div>

      {report && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[['Overall Score', report.overallScore + '%', report.overallScore >= 80 ? '#10b981' : report.overallScore >= 60 ? '#f59e0b' : '#ef4444'],
              ['Total Rows', report.totalRows.toLocaleString(), '#0097b2'],
              ['Total Columns', report.totalCols, '#0c1446'],
              ['Quality Issues', report.cols.filter(c => c.quality !== 'Good').length, '#e91e8c']
            ].map(([k, v, c]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 6 }}>{k}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Column Quality Analysis</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Column', 'Type', 'Filled', 'Missing', 'Missing %', 'Quality'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.cols.map((c, i) => (
                    <tr key={c.col} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600, color: '#0c1446' }}>{c.col}</td>
                      <td style={{ padding: '9px 14px' }}><span style={{ background: c.type === 'numeric' ? '#dbeafe' : '#fce7f3', color: c.type === 'numeric' ? '#1d4ed8' : '#be185d', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>{c.type}</span></td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{c.filled.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', color: c.missing > 0 ? '#ef4444' : '#10b981' }}>{c.missing.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                            <div style={{ width: `${c.missingPct}%`, height: '100%', background: qualityColor(c.quality), borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: '0.8rem', color: '#6b7280', minWidth: 35 }}>{c.missingPct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px' }}><span style={{ background: qualityColor(c.quality) + '20', color: qualityColor(c.quality), borderRadius: 4, padding: '3px 10px', fontSize: '0.8rem', fontWeight: 700 }}>{c.quality}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!report && !loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</div><div>Select a file to run the data quality report</div></div>}
    </div>
  )
}
