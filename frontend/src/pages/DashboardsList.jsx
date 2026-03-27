import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardsApi } from '../api'

export default function DashboardsList() {
  const [dashboards, setDashboards] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    dashboardsApi.list()
      .then(r => { setDashboards(r.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await dashboardsApi.delete(id)
      setDashboards(prev => prev.filter(d => d.id !== id))
    } catch {}
    setDeleting(null)
  }

  function formatDate(iso) {
    if (!iso) return ''
    try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return '' }
  }

  const cardStyle = {
    background: '#fff', borderRadius: 14, padding: 20,
    boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #f3f4f6',
    display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: '1.7rem', color: '#0c1446', marginBottom: 4 }}>My Dashboards</h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {dashboards.length} saved dashboard{dashboards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard-builder')}
          style={{
            background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 22px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          + New Dashboard
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading dashboards...</div>
      )}

      {/* Empty state */}
      {!loading && dashboards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 24px', background: '#fff', borderRadius: 14, border: '2px dashed #e5e7eb' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>&#128202;</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0c1446', marginBottom: 6 }}>No dashboards yet</div>
          <div style={{ color: '#6b7280', marginBottom: 20, fontSize: '0.9rem' }}>Build your first dashboard from any uploaded dataset.</div>
          <button
            onClick={() => navigate('/dashboard-builder')}
            style={{ background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, cursor: 'pointer' }}
          >
            Build first dashboard &#8594;
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && dashboards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
          {dashboards.map(d => {
            let widgetCount = 0
            try { widgetCount = JSON.parse(d.config_json || '{}').widgets?.length || 0 } catch {}
            return (
              <div
                key={d.id}
                style={cardStyle}
                onClick={() => navigate('/dashboard-builder', { state: { loadId: d.id } })}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(233,30,140,0.12)'; e.currentTarget.style.borderColor = '#e91e8c' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.07)'; e.currentTarget.style.borderColor = '#f3f4f6' }}
              >
                {/* Preview bar */}
                <div style={{ height: 80, background: 'linear-gradient(135deg, #fdf2f8 0%, #e0f2fe 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '2rem' }}>&#128202;</span>
                </div>

                {/* Name + badges */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1446', flex: 1, lineHeight: 1.3 }}>{d.name}</div>
                  {d.is_public && (
                    <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                      &#128279; Shared
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#6b7280' }}>
                  <span>{widgetCount} widget{widgetCount !== 1 ? 's' : ''}</span>
                  {d.created_at && <span>{formatDate(d.created_at)}</span>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => navigate('/dashboard-builder', { state: { loadId: d.id } })}
                    style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: 7, padding: '7px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', color: '#374151' }}
                  >
                    Open
                  </button>
                  {d.is_public && d.share_token && (
                    <button
                      onClick={() => window.open(`/share/${d.share_token}`, '_blank')}
                      style={{ flex: 1, background: '#f0fdf4', border: 'none', borderRadius: 7, padding: '7px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', color: '#15803d' }}
                    >
                      View public
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(d.id, d.name)}
                    disabled={deleting === d.id}
                    style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '7px 12px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', color: '#dc2626' }}
                  >
                    {deleting === d.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
