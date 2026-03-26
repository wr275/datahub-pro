import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { filesApi } from '../api'

const ANALYSIS_TOOLS = [
  { path: '/executive-dashboard', icon: '📊', label: 'Executive Dashboard', desc: 'Auto-generate KPIs & charts', color: '#0097b2' },
  { path: '/data-table', icon: '📋', label: 'Data View', desc: 'Browse & explore your data', color: '#0c1446' },
  { path: '/data-summary', icon: '📈', label: 'Data Summary', desc: 'Column statistics & distributions', color: '#7c3aed' },
  { path: '/ai-insights', icon: '🧠', label: 'AI Insights', desc: 'Deep AI-powered analysis', color: '#e91e8c' },
  { path: '/pivot-table', icon: '🔄', label: 'Pivot Table', desc: 'Drag-drop pivot analysis', color: '#059669' },
  { path: '/rfm', icon: '🎯', label: 'RFM Analysis', desc: 'Customer segmentation', color: '#d97706' },
  { path: '/forecasting', icon: '🔮', label: 'Forecasting', desc: 'Predict future trends', color: '#7c3aed' },
  { path: '/correlation', icon: '🔗', label: 'Correlation Matrix', desc: 'Find hidden patterns', color: '#0097b2' },
  { path: '/anomaly-detection', icon: '⚠️', label: 'Anomaly Detection', desc: 'Flag outliers automatically', color: '#ef4444' },
  { path: '/auto-report', icon: '📄', label: 'Auto Report', desc: 'One-click PDF report', color: '#0c1446' },
  { path: '/ask-your-data', icon: '💬', label: 'Ask Your Data', desc: 'Plain English queries', color: '#059669' },
  { path: '/data-cleaner', icon: '🧹', label: 'Data Cleaner', desc: 'Fix & deduplicate data', color: '#d97706' },
]

export default function Analytics() {
  const { fileId } = useParams()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)

  useEffect(() => {
    if (fileId) {
      localStorage.setItem('lastFileId', fileId)
      filesApi.list().then(res => {
        const found = res.data.find(f => String(f.id) === String(fileId))
        if (found) setFile(found)
      }).catch(() => {})
    }
  }, [fileId])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate('/files')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.85rem', padding: 0, marginBottom: 12 }}
        >
          ← Back to files
        </button>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0c1446', margin: 0 }}>
          {file ? `📄 ${file.filename}` : '📊 Analyse Your Data'}
        </h1>
        {file && (
          <p style={{ color: '#6b7280', margin: '6px 0 0' }}>
            {(file.rows || 0).toLocaleString()} rows · {file.columns || 0} columns · Choose an analysis tool below
          </p>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {ANALYSIS_TOOLS.map(({ path, icon, label, desc, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              background: '#fff',
              border: '1px solid #e8eaf4',
              borderRadius: 14,
              padding: '20px 18px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ width: 40, height: 40, background: color + '18', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: 12 }}>
              {icon}
            </div>
            <div style={{ fontWeight: 800, color: '#0c1446', fontSize: '0.9rem', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
