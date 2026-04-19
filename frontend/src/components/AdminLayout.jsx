import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Guards the /admin/* subtree. Non-superusers get bounced to /hub silently
// — mirroring how the backend returns 404 for these endpoints, we want
// zero hint that this dashboard exists for regular tenants.
//
// The visible chrome (sidebar + topbar) comes from <Layout>; this component
// only wraps the inner content with a compact "PLATFORM ADMIN" strip and
// an optional page title so every admin page gets consistent framing
// without each page having to re-implement it.
export default function AdminLayout({ title, subtitle, right, children }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_superuser) return <Navigate to="/hub" replace />

  return (
    <div style={{ padding: '24px 32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
        paddingBottom: 14, borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          padding: '3px 10px', background: '#ede9fe', color: '#6d28d9',
          borderRadius: 12, fontSize: '0.68rem', fontWeight: 800,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          🛡️ Platform Admin
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0c1446' }}>
            {title}
          </h1>
          {subtitle && (
            <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}
