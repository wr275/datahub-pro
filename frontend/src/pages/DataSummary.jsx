import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function DataSummary() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function run() {
    if (!fileId) return
    setLoading(true)
    analyticsApi.summary(fileId).then(r => setSummary(r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  const numericCols = summary ? Object.entries(summary.summary || {}).filter(([, s]) => s.type === 'numeric') : []
  const textCols = summary ? Object.entries(summary.summary || {}).filter(([, s]) => s.type === 'text') : []

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Data Summary</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Statistical summary of all columns in your dataset</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
            <option value="">-- Choose a file --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <button onClick={run} disabled={!fileId || loading} style={{ padding: '9px 24px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>
          {loading ? 'Analysing...' : 'Summarise'}
        </button>
      </div>

      {summary && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[['File', summary.filename], ['Rows', summary.rows?.toLocaleString()], ['Columns', summary.columns], ['Numeric Cols', numericCols.length]].map(([k, v]) => (
              <div key={k} style={{ background: 'linear-gradient(135deg,#0c1446,#0097b2)', borderRadius: 12, padding: 16, color: '#fff' }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{k}</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>

          {numericCols.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Numeric Columns ({numericCols.length})</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Column', 'Count', 'Sum', 'Mean', 'Min', 'Max'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {numericCols.map(([col, stats], i) => (
                      <tr key={col} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#0c1446' }}>{col}</td>
                        {[stats.count, stats.sum, stats.mean, stats.min, stats.max].map((v, j) => (
                          <td key={j} style={{ padding: '9px 14px', color: '#374151' }}>{Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {textCols.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Categorical Columns ({textCols.length})</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Column', 'Count', 'Unique Values', 'Top Values'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {textCols.map(([col, stats], i) => (
                      <tr key={col} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#0c1446' }}>{col}</td>
                        <td style={{ padding: '9px 14px', color: '#374151' }}>{stats.count}</td>
                        <td style={{ padding: '9px 14px', color: '#374151' }}>{stats.unique}</td>
                        <td style={{ padding: '9px 14px', color: '#6b7280', fontSize: '0.8rem' }}>{(stats.top_values || []).slice(0, 5).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!summary && !loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div><div>Select a file to see its statistical summary</div></div>}
    </div>
  )
}
