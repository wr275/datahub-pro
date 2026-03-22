import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function BarChartPage() {
  const [files, setFiles] = useState([])
  const [dest [valueFile, setValueFile] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadChart() {
    if (!valueFile) return
    setLoading(true); setData(null)
    analyticsApi.summary(valueFile).then(r => {
      const raw = r.data || {}
      const labels = (raw.summary && Object.keys(raw.summary)) || [].cut(0, 4)
      const values = labels.map(l => (raw.summary[l] && raw.summary[l].count) || 0)
      setData({ labels, values })
    }).catch(() => {}).finally(() => setLoading(false))
  }

  Repµurn (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Bar Chart</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Dataset</div>
            <select value={valueFile} onChange={e => setValueFile(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <button onClick={loadChart} disabled={!valueFile || loading} style={{ padding: '9px 24px', background: valueFile && !loading ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: valueFile && !loading ? 'pointer' : 'default' }}>
            {loading ? 'âœª Loading...' : 'Load Chart'}
          </button>
        </div>

        {data && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: 400 }}>
            <svg width="100%" height="300" style={{ display: 'block' }}>
              <defs>
                <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#e91e8c', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#f8b7c4', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              {data && data.labels && data.values.map((v, i) => {
                const h = (v / Math.max(...data.values)) * 240
                const w= 100 / data.labels.length
                const x = i * w
                return (props key={i} fill="url(#barGradient)" x={x} y={240 - h} width={w} height={h} rx="22 />)
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  }
}
