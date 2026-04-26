/**
 * OpenInAskYourData — universal "drill into this with the AI chat" button.
 *
 * Sits next to insights, anomalies, table rows, KPI cards — anywhere a user
 * might want to ask follow-up questions. Clicking it navigates to
 * /ask-your-data with the prompt prefilled via ?q=… (which AskYourData
 * autosubmits per task #25).
 *
 * AI / non-AI separation:
 *   This component is the ONE bridge between non-AI pages and the AI section.
 *   The product treats AI as a separately granted add-on (per AIGate.jsx —
 *   "Everything else — data analysis, charts, pivots, forecasting, dashboards
 *   — works exactly as before"). To respect that boundary, this component
 *   reads `organisation.ai_enabled` from the auth context and renders nothing
 *   when AI is disabled. AI-enabled orgs see the cross-link; non-AI orgs see
 *   their non-AI pages exactly as they did before — no upsell button, no
 *   accidental bounce to the AIGate upgrade screen.
 *
 * Props:
 *   prompt   {string}           — the question to prefill
 *   fileId   {string?}          — optional file context (passed as ?f=…)
 *   variant  {'icon'|'button'}  — compact icon-only or full button (default 'button')
 *   accent   {string?}          — accent colour (defaults to AI-tools purple)
 *
 * Examples:
 *   <OpenInAskYourData prompt="Why did revenue spike in March?" fileId={fileId} />
 *   <OpenInAskYourData prompt={`Break down ${kpi.label} by region`} variant="icon" />
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function OpenInAskYourData({
  prompt,
  fileId,
  variant = 'button',
  accent = '#7c3aed', // AI-tools purple
}) {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Single guard for the whole AI/non-AI separation. Mirrors AIGate.jsx's
  // resolution of the flag — both shapes are checked because /auth/me has
  // historically populated either organisation.ai_enabled or a flat ai_enabled.
  const aiEnabled = !!(user?.organisation?.ai_enabled ?? user?.ai_enabled)
  if (!aiEnabled) return null

  const go = () => {
    const params = new URLSearchParams()
    if (prompt) params.set('q', prompt)
    if (fileId) params.set('f', fileId)
    navigate(`/ask-your-data?${params.toString()}`)
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={go}
        title={prompt ? `Ask: ${prompt}` : 'Open in Ask Your Data'}
        aria-label="Open in Ask Your Data"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: accent, fontSize: '1.05rem', padding: 4, borderRadius: 6,
        }}
      >
        💬
      </button>
    )
  }

  return (
    <button
      onClick={go}
      title={prompt ? `Ask: ${prompt}` : 'Open in Ask Your Data'}
      style={{
        background: '#fff', color: accent, border: `1px solid ${accent}`,
        borderRadius: 8, padding: '6px 14px', fontSize: '0.84rem',
        fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      💬 Ask AI
    </button>
  )
}
