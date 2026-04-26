/**
 * EmptyState — shared component for "no data here yet" surfaces.
 *
 * Use on any page that has nothing to render — no files uploaded, no rows
 * matching the active filter, no insights yet, etc. Replaces the various
 * ad-hoc "📭 nothing yet" divs scattered across pages.
 *
 * Props:
 *   icon     {ReactNode|string}   — emoji, lucide-react icon, or any node
 *   title    {string}             — main heading line
 *   body     {string|ReactNode?}  — optional supporting text
 *   action   {{label, onClick, href, primary?}}  — optional CTA button
 *   tone     {'neutral'|'info'|'warn'} — accent colour (default 'neutral')
 *   compact  {bool}               — smaller padding for in-card empty states
 *
 * Examples:
 *   <EmptyState icon="📁" title="No files yet" body="Upload a CSV or Excel file to get started." action={{label: 'Upload', onClick: ...}} />
 *   <EmptyState icon="🔍" title="No results" body="No rows match the current filter." />
 *   <EmptyState icon="✨" title="Run an analysis" tone="info" />
 */

import React from 'react'

const TONES = {
  neutral: { bg: '#f9fafb',  border: '#e5e7eb', icon: '#9ca3af', title: '#111827', body: '#6b7280', accent: '#0c1446' },
  info:    { bg: '#eff6ff',  border: '#bfdbfe', icon: '#2563eb', title: '#1e3a8a', body: '#1e40af', accent: '#2563eb' },
  warn:    { bg: '#fff7ed',  border: '#fed7aa', icon: '#ea580c', title: '#7c2d12', body: '#9a3412', accent: '#ea580c' },
}

export default function EmptyState({
  icon = '📭',
  title = 'Nothing here yet',
  body = null,
  action = null,
  tone = 'neutral',
  compact = false,
}) {
  const t = TONES[tone] || TONES.neutral
  const padY = compact ? 28 : 56
  const padX = compact ? 18 : 32

  return (
    <div style={{
      background: t.bg,
      border: `1px dashed ${t.border}`,
      borderRadius: 14,
      padding: `${padY}px ${padX}px`,
      textAlign: 'center',
      color: t.body,
    }}>
      <div style={{
        fontSize: compact ? '2rem' : '2.6rem',
        color: t.icon,
        marginBottom: compact ? 6 : 12,
        lineHeight: 1,
      }}>
        {icon}
      </div>
      <div style={{
        fontWeight: 700,
        color: t.title,
        fontSize: compact ? '0.95rem' : '1.05rem',
        marginBottom: body ? (compact ? 4 : 8) : 0,
      }}>
        {title}
      </div>
      {body && (
        <div style={{
          fontSize: compact ? '0.82rem' : '0.88rem',
          maxWidth: 460,
          margin: '0 auto',
          lineHeight: 1.5,
        }}>
          {body}
        </div>
      )}
      {action && (
        <div style={{ marginTop: compact ? 12 : 18 }}>
          {action.href ? (
            <a
              href={action.href}
              style={{
                display: 'inline-block',
                background: action.primary === false ? '#fff' : t.accent,
                color: action.primary === false ? t.accent : '#fff',
                border: action.primary === false ? `1px solid ${t.accent}` : 'none',
                padding: '8px 18px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.85rem',
                textDecoration: 'none',
              }}
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              style={{
                background: action.primary === false ? '#fff' : t.accent,
                color: action.primary === false ? t.accent : '#fff',
                border: action.primary === false ? `1px solid ${t.accent}` : 'none',
                padding: '8px 18px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
