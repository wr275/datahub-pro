// Formatting helpers shared across every admin page. Keeps the pages
// themselves focused on layout/data-flow and makes sure we present money,
// tokens, and dates identically everywhere — important for a dashboard
// that's literally Waqas's single pane of glass over the business.

// Integer cents → display string. Backend stores everything in integer
// cents to avoid float drift on margins/taxes; here we convert to dollars
// only at the render edge.
export function formatCents(cents) {
  if (cents == null) return '$0.00'
  const n = Number(cents) / 100
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 })
}

// Big token counts compress nicely to K/M — a 50M row file's analysis
// will show as "12.4M tokens" rather than a 9-digit blur.
export function formatNumber(n) {
  if (n == null) return '0'
  const num = Number(n)
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return num.toLocaleString()
}

// Absolute tokens, no compression — for the usage detail table where the
// exact number matters for audit.
export function formatInt(n) {
  return (Number(n) || 0).toLocaleString()
}

// ISO date/datetime → short human form. Admin users are looking at lots
// of rows — "Apr 19, 2:14pm" is faster to scan than an ISO string.
export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Plan-colour mapping so every page uses the same badge style — keeps
// the dashboard feel coherent and lets operators pattern-match on colour.
export function planBadge(plan) {
  const map = {
    starter:    { bg: '#dbeafe', fg: '#1e40af' },
    growth:     { bg: '#e0e7ff', fg: '#3730a3' },
    enterprise: { bg: '#fae8ff', fg: '#86198f' },
    trial:      { bg: '#fef3c7', fg: '#92400e' },
  }
  const key = (plan || 'trial').toLowerCase()
  return map[key] || map.trial
}

export function statusBadge(status) {
  const map = {
    active:     { bg: '#dcfce7', fg: '#166534' },
    trialing:   { bg: '#fef3c7', fg: '#92400e' },
    cancelled:  { bg: '#fee2e2', fg: '#991b1b' },
    suspended:  { bg: '#e5e7eb', fg: '#374151' },
    pending:    { bg: '#fef3c7', fg: '#92400e' },
    approved:   { bg: '#dcfce7', fg: '#166534' },
    denied:     { bg: '#fee2e2', fg: '#991b1b' },
  }
  const key = (status || 'active').toLowerCase()
  return map[key] || { bg: '#e5e7eb', fg: '#374151' }
}
