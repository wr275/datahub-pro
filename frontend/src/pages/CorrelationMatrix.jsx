import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonChart } from '../components/ui/Skeleton'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'

export default function CorrelationMatrix() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [matrix, setMatrix] = useState(null)
  const [cols, setCols] = useState([])
  const [loading, setLoading] = useState(false)
  const matrixRef = useRef(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function run() {
    if (!fileId) return
    setLoading(true)
    analyticsApi.preview(fileId).then(r => {
      const rows = r.data.rows || []; const headers = r.data.headers || []
      const numCols = headers.filter(h => rows.slice(0, 10).some(row => !isNaN(parseFloat(row[h]))))
      const data = {}
      numCols.forEach(col => { data[col] = rows.map(row => parseFloat(row[col]) || 0) })
      const n = rows.length
      const corr = {}
      numCols.forEach(a => {
        corr[a] = {}
        const ma = data[a].reduce((s, v) => s + v, 0) / n
        numCols.forEach(b => {
          const mb = data[b].reduce((s, v) => s + v, 0) / n
          let num = 0, da = 0, db = 0
          for (let i = 0; i < n; i++) {
            num += (data[a][i] - ma) * (data[b][i] - mb)
            da += (data[a][i] - ma) ** 2
            db += (data[b][i] - mb) ** 2
          }
          corr[a][b] = da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db)
        })
      })
      setCols(numCols)
      setMatrix(corr)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  const color = v => {
    const abs = Math.abs(v)
    if (v > 0.7) return '#10b981'
    if (v > 0.3) return '#34d399'
    if (v < -0.7) return '#ef4444'
    if (v < -0.3) return '#f87171'
    return '#e5e7eb'
  }
  const textColor = v => Math.abs(v) > 0.5 ? '#fff' : '#374151'

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Correlation Matrix</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Pearson correlation between all numeric columns — green = positive, red = negative</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
            <option value="">-- Choose a file --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <button onClick={run} disabled={!fileId || loading} style={{ padding: '9px 24px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>
          {loading ? 'Computing...' : 'Compute Correlation'}
        </button>
      </div>

      {loading && (
        <SkeletonChart height={300} />
      )}

      {matrix && cols.length > 0 && (
        <div ref={matrixRef} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: '#0c1446' }}>Correlation Matrix ({cols.length} numeric columns)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <OpenInAskYourData
                fileId={fileId}
                prompt={`Look at my correlation matrix across ${cols.length} numeric columns. Which pairs show the strongest unexpected relationships, and what business hypotheses do they suggest?`}
              />
              <ExportMenu
                data={cols.flatMap(a => cols.map(b => ({ a, b, r: matrix[a][b] })))}
                filename={`correlation-matrix`}
                containerRef={matrixRef}
                title="Correlation Matrix"
              />
            </div>
          </div>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 10px' }}></th>
                {cols.map(c => <th key={c} style={{ padding: '8px 6px', textAlign: 'center', color: '#374151', fontWeight: 600, maxWidth: 80, overflow: 'hidden' }}>{c.length > 10 ? c.slice(0, 10) + '…' : c}</th>)}
              </tr>
            </thead>
            <tbody>
              {cols.map(r => (
                <tr key={r}>
                  <td style={{ padding: '6px 10px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{r.length > 12 ? r.slice(0, 12) + '…' : r}</td>
                  {cols.map(c => {
                    const v = matrix[r][c]
                    return (
                      <td key={c} style={{ padding: 3 }}>
                        <div style={{ width: 60, height: 40, background: color(v), borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor(v), fontWeight: 700, fontSize: '0.8rem' }}>
                          {v.toFixed(2)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: '0.8rem', color: '#6b7280', flexWrap: 'wrap' }}>
            {[['#10b981', 'Strong +ve (>0.7)'], ['#34d399', 'Moderate +ve (0.3–0.7)'], ['#e5e7eb', 'Weak (−0.3–0.3)'], ['#f87171', 'Moderate −ve (−0.7–−0.3)'], ['#ef4444', 'Strong −ve (<−0.7)']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, background: c, borderRadius: 3, display: 'inline-block' }} />{l}</span>
            ))}
          </div>
        </div>
      )}

      {!matrix && !loading && (
        <EmptyState
          icon="🔗"
          title="Pick a file to compute correlations"
          body="Pearson r between every pair of numeric columns. Green = positive, red = negative, with strength shading. Use it to spot drivers and surprising co-movers."
        />
      )}
    </div>
  )
}
