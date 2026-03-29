import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filesApi, analyticsApi } from '../api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6']

export default function ExecutiveDashboard() {
  const [searchParams] = useSearchParams()
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const dashRef = useRef(null)

  useEffect(() => {
    filesApi.list().then(r => {
      const fs = r.data || []
      setFiles(fs)
      const paramId = searchParams.get('fileId')
      const target = paramId ? fs.find(f => f.id === paramId) : fs[0]
      if (target) load(target.id)
    }).catch(() => {})
  }, [])

  function load(id) {
    setFileId(id); setData(null)
    if (!id) return
    setLoading(true)
    Promise.all([analyticsApi.summary(id), analyticsApi.preview(id)]).then(([sRes, pRes]) => {
      const summary = sRes.data.summary || {}; const rows = pRes.data.rows || []; const headers = pRes.data.headers || []
      const numericCols = Object.entries(summary).filter(([, v]) => v.type === 'numeric').slice(0, 4)
      const textCols = Object.entries(summary).filter(([, v]) => v.type !== 'numeric')
      const kpis = numericCols.map(([col, stats]) => ({
        label: col, value: (stats.mean || 0).toFixed(2), subtext: `Total: ${((stats.mean || 0) * (stats.count || 0)).toFixed(0)}`, color: COLORS[Math.floor(Math.random() * COLORS.length)]
      }))
      // Smart column detection - works for any dataset
        const monthOrder = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}
        const timeCol = textCols.find(([col]) => /month|quarter|week/i.test(col)) ||
          textCols.find(([col]) => /date|time|period|year/i.test(col))
        const primaryMetric = numericCols.find(([col]) => /revenue|sales|amount|profit|income|total/i.test(col)) ||
          numericCols[0]
        let trendData, trendKey
        if (timeCol) {
          const [tcol] = timeCol; trendKey = 'name'
          const grp = {}
          rows.forEach(r => {
            const k = String(r[tcol] ?? '')
            if (!grp[k]) { grp[k] = { name: k }; numericCols.slice(0, 2).forEach(([col]) => { grp[k][col] = 0 }) }
            numericCols.slice(0, 2).forEach(([col]) => { grp[k][col] = +((grp[k][col] + (parseFloat(r[col]) || 0)).toFixed(2)) })
          })
          const mo = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}
          trendData = Object.values(grp).sort((a, b) => {
            const am = mo[a.name.toLowerCase().slice(0,3)] || 0
            const bm = mo[b.name.toLowerCase().slice(0,3)] || 0
            return am - bm || a.name.localeCompare(b.name)
          })
        } else {
          trendKey = 'index'
          trendData = rows.slice(0, 30).map((r, i) => {
            const pt = { index: i + 1 }
            numericCols.slice(0, 2).forEach(([col]) => { pt[col] = parseFloat(r[col]) || 0 })
            return pt
          })
        }
        let distData = []
        if (textCols.length) {
          const catCol = textCols.find(([col]) => /categ|product|type|class/i.test(col)) ||
            textCols.find(([col]) => /segment|region|channel|group|status/i.test(col)) ||
            textCols.reduce((best, cur) => {
              const bu = new Set(rows.map(r => String(r[best[0]] ?? ''))).size
              const cu = new Set(rows.map(r => String(r[cur[0]] ?? ''))).size
              return (cu >= 2 && cu <= 20 && (cu < bu || bu > 20)) ? cur : best
            }, textCols[0])
          const [col] = catCol; const freq = {}
          if (primaryMetric) {
            const [mc] = primaryMetric
            rows.forEach(r => { const v = String(r[col] ?? ''); if (v) freq[v] = +((( freq[v] || 0) + (parseFloat(r[mc]) || 0)).toFixed(2)) })
          } else {
            rows.forEach(r => { const v = String(r[col] ?? ''); if (v) freq[v] = (freq[v] || 0) + 1 })
          }
          distData = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }))
        }
        setData({ kpis, trendData, trendKey, distData, numericCols, totalRows: sRes.data.rows, filename: sRes.data.filename })
    }).catch(() => {}).finally(() => setLoading(false))
  }

  function handleExportPDF() {
    const style = document.createElement('style')
    style.id = 'print-override'
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        #exec-dashboard-print { display: block !important; position: static !important; }
        #exec-dashboard-print { padding: 20px !important; }
        .no-print { display: none !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `
    document.head.appendChild(style)
    const el = dashRef.current
    if (el) el.id = 'exec-dashboard-print'
    window.print()
    setTimeout(() => {
      document.head.removeChild(style)
      if (el) el.removeAttribute('id')
    }, 1000)
  }

  return (
    <div ref={dashRef} style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Print CSS */}
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flewWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Executive Dashboard</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>High-level KPI overview and trends</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flewWrap: 'wrap' }} className="no-print">
          {data && (
            <button onClick={handleExportPDF}
              style={{ padding: '9px 16px', background: '#0c1446', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a2a6c'}
              onMouseLeave={e => e.currentTarget.style.background = '#0c1446'}>
              📥 Export PDF
            </button>
          )}
          <select value={fileId} onChange={e => load(e.target.value)}
            style={{ padding: '9px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', minWidth: 200 }}>
            <option value="">-- Select Dataset --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>Loading dashboard...</div>}

      {data && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '4px solid #0c1446' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Total Records</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0c1446' }}>{data.totalRows?.toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 4 }}>{data.filename}</div>
            </div>
            {data.kpis.map((kpi, i) => (
              <div key={kpi.label} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${COLORS[i % COLORS.length]}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{kpi.label} (mean)</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: COLORS[i % COLORS.length] }}>{parseFloat(kpi.value).toLocaleString()}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 4 }}>{kpi.subtext}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Performance Trend</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey={data.trendKey || 'index'} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {data.numericCols.slice(0, 2).map(([col], i) => (
                    <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Category Breakdown</div>
              {data.distData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.distData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {data.distData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No categorical columns found</div>}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Column Averages Comparison</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.kpis.map(k => ({ name: k.label, value: parseFloat(k.value) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.kpis.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div>
          <div>Select a dataset to load the executive dashboard</div>
        </div>
      )}
    </div>
  )
}
