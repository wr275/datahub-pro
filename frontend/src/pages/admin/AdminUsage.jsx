import React, { useCallback, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import AdminLayout from '../../components/AdminLayout'
import { adminApi } from '../../api'
import { formatCents, formatDateTime, formatInt, formatNumber } from './adminFormat'

const WINDOWS = [
  { key: 'today', label: 'Today' },
  { key: '7d',    label: 'Last 7 days' },
  { key: 'mtd',   label: 'Month-to-date' },
  { key: '30d',   label: 'Last 30 days' },
  { key: 'all',   label: 'All time' },
]

export default function AdminUsage() {
  const [window_, setWindow] = useState('30d')
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await adminApi.usage(window_)
      setData(res.data)
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load usage data')
    } finally {
      setLoading(false)
    }
  }, [window_])

  useEffect(() => { reload() }, [reload])

  const totals = data?.totals || {}
  const perOrg = data?.per_org || []
  const topTen = perOrg.slice(0, 10)

  return (
    <AdminLayout
      title="Usage & Token Metering"
      subtitle="AI token consumption and cost per workspace — what's actually being spent"
      right={
        <select value={window_} onChange={e => setWindow(e.target.value)} style={{
          padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.88rem', background: '#fff'
        }}>
          {WINDOWS.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
        </select>
      }
    >
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricCard label="AI tokens consumed" value={formatNumber(totals.ai_tokens)} hint={`${formatInt(totals.ai_tokens)} tokens`} accent="#db2777" />
        <MetricCard label="AI cost"            value={formatCents(totals.ai_cost_cents)} hint="Anthropic API spend" accent="#6d28d9" />
        <MetricCard label="File uploads"       value={formatInt(totals.uploads)} accent="#2563eb" />
        <MetricCard label="Orgs with usage"    value={formatInt(perOrg.length)} hint={`window: ${windowLabel(window_)}`} accent="#16a34a" />
      </div>

      {topTen.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', padding: 20, marginBottom: 22 }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 14 }}>Top 10 workspaces by AI tokens</div>
          <div style={{ height: Math.max(240, topTen.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTen} layout="vertical" margin={{ top: 5, right: 24, bottom: 5, left: 10 }}>
                <CartesianGrid stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatNumber} />
                <YAxis type="category" dataKey="organisation_name" tick={{ fontSize: 11, fill: '#374151' }} width={140} />
                <Tooltip formatter={(v) => formatNumber(v) + ' tokens'} />
                <Bar dataKey="ai_tokens" fill="#db2777" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Per-workspace usage · {windowLabel(window_)}</span>
          <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 500 }}>{perOrg.length} workspaces</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={thStyle}>Workspace</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>AI tokens</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>AI cost</th>
              <th style={thStyle}>Last used</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>}
            {!loading && perOrg.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No AI usage in this window yet.</td></tr>}
            {perOrg.map(row => (
              <tr key={row.organisation_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: '#0c1446' }}>{row.organisation_name}</div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatInt(row.ai_tokens)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCents(row.ai_cost_cents)}
                </td>
                <td style={{ ...tdStyle, color: '#6b7280' }}>{formatDateTime(row.last_used_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}

function MetricCard({ label, value, hint, accent = '#6d28d9' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1446', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ color: '#9ca3af', fontSize: '0.78rem', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function windowLabel(key) {
  return WINDOWS.find(w => w.key === key)?.label || key
}

const thStyle = { padding: '11px 16px', fontWeight: 700 }
const tdStyle = { padding: '11px 16px', color: '#0c1446' }
