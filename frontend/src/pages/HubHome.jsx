import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi } from '../api'

const tiles = [
  { section: 'GATHER', color: '#0c1446', items: [
    { path: '/data-table', icon: '📋', label: 'Data View' },
    { path: '/data-summary', icon: '📊', label: 'Data Summary' },
    { path: '/formula-engine', icon: '⚡', label: 'Formula Engine' },
    { path: '/kpi-dashboard', icon: '🎯', label: 'KPI Dashboard' },
    { path: '/period-comparison', icon: '📅', label: 'Period Comparison' },
  ]},
  { section: 'ANALYZE', color: '#0097b2', items: [
    { path: '/pivot-table', icon: '🔄', label: 'Pivot Table' },
    { path: '/what-if', icon: '🤔', label: 'What-If' },
    { path: '/anomaly-detection', icon: '🔍', label: 'Anomaly Detection' },
    { path: '/forecasting', icon: '📈', label: 'Forecasting' },
    { path: '/rfm', icon: '👥', label: 'RFM Analysis' },
  ]},
  { section: 'VISUALIZE', color: '#e91e8c', items: [
    { path: '/bar-chart', icon: '📊', label: 'Bar Chart' },
    { path: '/line-chart', icon: '📉', label: 'Line Chart' },
    { path: '/pie-chart', icon: '🥧', label: 'Pie Chart' },
    { path: '/heatmap', icon: '🌡️', label: 'Heatmap' },
    { path: '/scatter-plot', icon: '✦', label: 'Scatter Plot' },
  ]},
  { section: 'ACT', color: '#10b981', items: [
    { path: '/ask-your-data', icon: '💬', label: 'Ask Your Data' },
    { path: '/formula-builder', icon: '🔧', label: 'Formula Builder' },
    { path: '/auto-report', icon: '📄', label: 'Auto Report' },
    { path: '/scheduled-reports', icon: '⏰', label: 'Scheduled Reports' },
  ]},
]

export default function HubHome() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ files: 0, rows: 0 })

  useEffect(() => {
    filesApi.list().then(r => {
      const files = r.data || []
      setStats({ files: files.length, rows: files.reduce((a, f) => a + (f.rows || 0), 0) })
    }).catch(() => {})
  }, [])

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#e91e8c,#0097b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>DH</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0c1446' }}>DataHub Pro</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>Analytics & Intelligence Platform</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
          {[['Files Loaded', stats.files], ['Total Rows', stats.rows.toLocaleString()]].map(([k, v]) => (
            <div key={k} style={{ background: '#fff', borderRadius: 10, padding: '10px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1446' }}>{v}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
        {tiles.map(({ section, color, items }) => (
          <div key={section} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ background: color, padding: '12px 18px', color: '#fff', fontWeight: 700, fontSize: '0.8rem', letterSpacing: 1 }}>{section}</div>
            <div style={{ padding: 12 }}>
              {items.map(({ path, icon, label }) => (
                <button key={path} onClick={() => navigate(path)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                  <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 16px', color: '#0c1446', fontWeight: 700 }}>Quick Access</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[['📂 My Files', '/files'], ['📊 Analytics', '/analytics'], ['🧠 AI Insights', '/ai-insights'], ['💰 NPV Calculator', '/npv'], ['👥 RFM Analysis', '/rfm'], ['📈 Trends', '/trends']].map(([label, path]) => (
            <button key={path} onClick={() => navigate(path)} style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#0c1446,#0097b2)', color: '#fff', border: 'none', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
