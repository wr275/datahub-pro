import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { organisationApi } from '../api'
import toast from 'react-hot-toast'

/**
 * AIGate wraps any AI-powered page. If the caller's organisation has the
 * AI add-on enabled, the wrapped content is rendered untouched. Otherwise
 * an upgrade screen is shown — owners/admins get a one-click "Enable AI"
 * button; members get a nudge to ask their owner.
 *
 * Usage:
 *   <AIGate><AskYourData /></AIGate>
 *
 * The gate reads `organisation.ai_enabled` from the auth context, which is
 * populated by /auth/me on boot. Toggling the add-on calls
 * PATCH /api/organisation/ai-enabled and then refreshes auth state.
 */
export default function AIGate({ children, featureName = 'AI features' }) {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const aiEnabled = !!(user?.organisation?.ai_enabled ?? user?.ai_enabled)
  if (aiEnabled) return children

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin'

  const handleEnable = async () => {
    setSubmitting(true)
    try {
      await organisationApi.setAiEnabled(true)
      await refreshUser()
      toast.success('AI features are now enabled for your workspace')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not enable AI')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
      <div style={{
        maxWidth: 560, width: '100%', background: '#fff',
        border: '1px solid #e2e5f1', borderRadius: 16,
        padding: 40, textAlign: 'center',
        boxShadow: '0 4px 24px rgba(12,20,70,0.06)',
      }}>
        <div style={{
          width: 72, height: 72, margin: '0 auto 20px',
          background: 'linear-gradient(135deg,#0c1446,#1a2a6c)',
          borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem',
        }}>🤖</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1446', marginBottom: 10 }}>
          {featureName} require the AI add-on
        </h1>
        <p style={{ color: '#4a5280', fontSize: '0.95rem', lineHeight: 1.55, marginBottom: 8 }}>
          The <strong>AI</strong> section of DataHub Pro is a separately granted add-on —
          Ask Your Data, AI Insights, AI Narrative, Auto Report, Formula Builder AI
          and AI Settings all live behind this toggle.
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 28 }}>
          Everything else — data analysis, charts, pivots, forecasting, dashboards — works exactly as before.
        </p>

        {isOwnerOrAdmin ? (
          <>
            <button
              onClick={handleEnable}
              disabled={submitting}
              className="btn-primary"
              style={{ padding: '12px 32px', fontSize: '0.95rem', fontWeight: 700, minWidth: 220 }}
            >
              {submitting ? 'Enabling…' : 'Enable AI for this workspace'}
            </button>
            <div style={{ marginTop: 16, fontSize: '0.78rem', color: '#6b7280' }}>
              You can turn it back off any time from Organisation Settings.
            </div>
          </>
        ) : (
          <>
            <div style={{
              padding: 16, background: '#f3f4f6', borderRadius: 10,
              fontSize: '0.88rem', color: '#374151', marginBottom: 20,
            }}>
              Ask the workspace owner to enable the AI add-on.
              Owners and admins can flip it on from Organisation Settings.
            </div>
            <button
              onClick={() => navigate('/hub')}
              className="btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.9rem' }}
            >
              Back to Hub
            </button>
          </>
        )}
      </div>
    </div>
  )
}
