import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#6366f1', '#ef4444']

export default function KPIDashboard() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [kpis, setKpis] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(false)
  const [filename, setFilename] = useState('')

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function run() {
    if (!fileId) return
    setLoading(true)
    analyticsApi.summary(fileId).then(r => {
      const raw = r.data
      setFilename(raw.filename)
      const ks = []
      const cd = []
      Object.entries(raw.summary || {}).forEach(([col, stats]) => {
        if (stats.type === 'numeric' && stats.count > 0) {
          ks.push({ col, sum: stats.sum, mean: stats.mean, min: stats.min, max: stats.max, count: stats.count })
          cd.push({ name: col.length > 12 ? col.slice(0, 12) + '…' : col, Sum: stats.sum, Avg: stats.mean })
        }
      })
      setKpis(ks.slice(0, 8))
      setChartData(cd.slice(0, 6))
    }).catch(() => {}).finally(() => setLoading(false))
  }

  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Number(n).toFixed(2)

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>KPI Dashboard</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Key performance indicators from your data</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
          <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
            <option value="">-- Choose a file --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <button onClick={run} disabled={!fileId || loading} style={{ padding: '9px 24px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>
          {loading ? 'Loading...' : 'Generate KPIs'}
        </button>
      </div>

      {kpis.length > 0 && (
        <>
          {filename && <div style={{ marginBottom: 16, fontSize: '0.875rem', color: '#6b7280' }}>📁 {filename}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {kpis.map(({ col, sum, mean, min, max }, i) => (
              <div key={col} style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>{col}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446', marginBottom: 8 }}>{fmt(sum)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af' }}>
                  <span>Avg: {fmt(mean)}</span><span>Min: {fmt(min)}</span><span>Max: {fmt(max)}</span>
                </div>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Column Sums</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="Sum" fill="#e91e8c" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Column Averages</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="Avg" fill="#0097b2" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {!kpis.length && !loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🎯</div><div>Select a file to generate your KPI dashboard</div></div>}
    </div>
  )
}
