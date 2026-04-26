/**
 * PinToDashboard — universal one-click "pin this to my dashboard" button.
 *
 * Sits on every chart, KPI card, insight, anomaly, etc. Clicking it appends
 * a widget to the user's most recently touched dashboard. If the org has no
 * dashboards yet, the backend auto-creates a "Pinned widgets" dashboard.
 *
 * Props:
 *   widget   {object}        — { type, col, label, file_id, extra }
 *                              passed straight to POST /dashboards/{id}/pin-widget
 *   variant  {'icon'|'button'} — compact icon-only or full button (default 'button')
 *   accent   {string?}       — accent colour
 *   onPinned {fn?}           — optional callback after successful pin
 *
 * The widget shape mirrors the dashboard widget config:
 *   { type: 'kpi'|'bar'|'line'|'pie'|'table'|'insight',
 *     col: 'columnName', label: 'Display label', file_id: '...', extra: {...} }
 */

import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { dashboardsApi } from '../../api'

export default function PinToDashboard({
  widget,
  variant = 'button',
  accent = '#0c1446',
  onPinned,
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const pin = async () => {
    if (!widget || !widget.type) {
      toast.error('Widget config missing')
      return
    }
    setBusy(true)
    try {
      // Find target dashboard. If the user has any dashboard, use the most
      // recent. Otherwise pass 'auto' so the backend auto-creates one.
      let targetId = 'auto'
      try {
        const r = await dashboardsApi.mostRecent()
        if (r.data?.dashboard?.id) targetId = r.data.dashboard.id
      } catch {
        // fall through with 'auto'
      }

      const res = await dashboardsApi.pinWidget(targetId, widget)
      const name = res.data?.dashboard_name || 'dashboard'
      const dashId = res.data?.dashboard_id

      toast.success(
        (t) => (
          <span>
            Pinned to <strong>{name}</strong> ·{' '}
            <button
              onClick={() => {
                toast.dismiss(t.id)
                if (dashId) navigate(`/dashboard-builder?id=${dashId}`)
              }}
              style={{
                background: 'transparent', border: 'none', color: accent,
                fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              View
            </button>
          </span>
        ),
        { duration: 4000 }
      )
      onPinned?.(res.data)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to pin widget')
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={pin}
        disabled={busy}
        title="Pin to dashboard"
        aria-label="Pin to dashboard"
        style={{
          background: 'transparent', border: 'none', cursor: busy ? 'wait' : 'pointer',
          color: accent, fontSize: '1.05rem', padding: 4, borderRadius: 6,
          opacity: busy ? 0.5 : 1,
        }}
      >
        📌
      </button>
    )
  }

  return (
    <button
      onClick={pin}
      disabled={busy}
      style={{
        background: '#fff', color: accent, border: `1px solid ${accent}`,
        borderRadius: 8, padding: '6px 14px', fontSize: '0.84rem',
        fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      📌 {busy ? 'Pinning…' : 'Pin to dashboard'}
    </button>
  )
}
