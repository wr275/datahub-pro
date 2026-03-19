import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { filesApi } from '../api'
import { useAuth } from '../context/AuthContext'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: '0.75rem', color: '#8b92b3', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: color || '#0c1446' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#4a5280', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    filesApi.list().then(res => setFiles(res.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const org = user?.organisation || {}
  const isTrialing = user?.subscription === 'trialing'

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446' }}>Welcome, {user?.full_name?.split(' ')[0] || 'there'}</h1>
        <p style={{ color: '#4a5280', marginTop: 4 }}>Here's your workspace overview</p>
      </div>

      {/* Trial banner */}
      {isTrialing && (
        <div style={{ background: 'linear-gradient(135deg, #e91e8c, #0097b2)', borderRadius: 12, padding: 20, marginBottom: 24, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>You're on a free trial</div>
            <div style={{ opacity: 0.9, fontSize: '0.88rem' }}>Upgrade to keep full access after your trial ends</div>
          </div>
          <Link to="/billing" style={{ background: '#fff', color: '#e91e8c', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', flexShrink: 0 }}>Upgrade now</Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Files Uploaded" value={files.length} sub="Total in workspace" />
        <StatCard label="Total Rows" value={files.reduce((s, f) => s + (f.rows || 0), 0).toLocaleString()} sub="Across all files" />
        <StatCard label="Plan" value={user?.organisation?.subscription_tier || 'Trial'} color="#e91e8c" sub="Current subscription" />
        <StatCard label="Team Members" value="—" sub="See team page" />
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Link to="/files" className="card" style={{ padding: 24, display: 'block', textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📁</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0c1446', marginBottom: 6 }}>Upload Data</h3>
          <p style={{ fontSize: '0.85rem', color: '#4a5280' }}>Upload Excel or CSV files to start analysing</p>
        </Link>
        <Link to="/analytics" className="card" style={{ padding: 24, display: 'block', textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', borderLeft: '4px solid #e91e8c' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0c1446', marginBottom: 6 }}>Open Analytics</h3>
          <p style={{ fontSize: '0.85rem', color: '#4a5280' }}>30+ analytics tools including AI, forecasting, and RFM</p>
        </Link>
      </div>

      {/* Recent files */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0c1446' }}>Recent Files</h2>
          <Link to="/files" style={{ fontSize: '0.82rem', color: '#e91e8c', fontWeight: 600 }}>View all →</Link>
        </div>
        {loading ? <p style={{ color: '#8b92b3' }}>Loading...</p> :
          files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#8b92b3' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📂</div>
              <p>No files yet. <Link to="/files" style={{ color: '#e91e8c', fontWeight: 600 }}>Upload your first file →</Link></p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e5f1' }}>
                  {['File', 'Rows', 'Columns', 'Uploaded'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#4a5280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.slice(0, 5).map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #e2e5f1' }}>
                    <td style={{ padding: '10px 12px', color: '#0c1446', fontWeight: 500 }}>📄 {f.filename}</td>
                    <td style={{ padding: '10px 12px', color: '#4a5280' }}>{f.rows?.toLocaleString() || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#4a5280' }}>{f.columns || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#4a5280' }}>{new Date(f.uploaded_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}
