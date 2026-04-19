import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import AdminLayout from '../../components/AdminLayout'
import { adminApi } from '../../api'
import { formatCents, formatInt, planBadge } from './adminFormat'

export default function AdminBilling() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    adminApi.billing()
      .then(res => setData(res.data))
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load billing data'))
  }, [])

  if (err) {
    return (
      <AdminLayout title="Billing & Revenue" subtitle="MRR, churn, and subscription mix">
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 16, borderRadius: 10 }}>{err}</div>
      </AdminLayout>
    )
  }
  if (!data) {
    return <AdminLayout title="Billing & Revenue" subtitle="MRR, churn, and subscription mix"><div style={{ color: '#6b7280' }}>Loading…</div></AdminLayout>
  }

  // Backend returns by_plan as an object: { starter: {count, mrr_pence}, ... }.
  // Recharts wants an array — normalise here so the page logic stays flat.
  const byPlan = Object.entries(data.by_plan || {}).map(([plan, v]) => ({
    plan,
    count: v.count || 0,
    mrr_pence: v.mrr_pence || 0,
    mrr_gbp: (v.mrr_pence || 0) / 100,
  }))

  // Churn comes as a fraction (0.0–1.0). Multiply at render time — keeps
  // the backend value format-agnostic.
  const churnPct = (data.churn_rate_30d || 0) * 100

  return (
    <AdminLayout
      title="Billing & Revenue"
      subtitle="MRR, churn and subscription mix"
      right={
        data.stripe_dashboard_url && (
          <a href={data.stripe_dashboard_url} target="_blank" rel="noopener noreferrer" style={{
            padding: '8px 14px', background: '#635bff', color: '#fff', borderRadius: 8,
            fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none'
          }}>
            Open Stripe →
          </a>
        )
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricCard label="MRR"                  value={formatCents(data.total_mrr_pence)}        hint={`${byPlan.length} plans active`} accent="#16a34a" />
        <MetricCard label="ARR (estimated)"       value={formatCents(data.annualised_revenue_pence)} hint="MRR × 12" accent="#6d28d9" />
        <MetricCard label="Active subscriptions"  value={formatInt(data.active_count)}             accent="#2563eb" />
        <MetricCard label="On trial"              value={formatInt(data.trialing_count)}           accent="#f59e0b" />
        <MetricCard label="Cancelled"             value={formatInt(data.cancelled_count)}          hint={`${data.cancelled_30d || 0} in last 30d`} accent="#dc2626" />
        <MetricCard label="30d churn rate"        value={churnPct.toFixed(1) + '%'}                accent="#db2777" />
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', padding: 20, marginBottom: 22 }}>
        <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 14 }}>MRR by plan</div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPlan} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="plan" tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={v => v[0].toUpperCase() + v.slice(1)} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => '£' + v} />
              <Tooltip formatter={(v) => '£' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2 })} />
              <Bar dataKey="mrr_gbp" radius={[6, 6, 0, 0]}>
                {byPlan.map((p, i) => <Cell key={i} fill={planBadge(p.plan).fg} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Plan breakdown</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={thStyle}>Plan</th>
              <th style={thStyle}>Organisations</th>
              <th style={thStyle}>MRR</th>
            </tr>
          </thead>
          <tbody>
            {byPlan.map(p => {
              const pb = planBadge(p.plan)
              return (
                <tr key={p.plan} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}><span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', background: pb.bg, color: pb.fg }}>{p.plan}</span></td>
                  <td style={tdStyle}>{formatInt(p.count)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{formatCents(p.mrr_pence)}</td>
                </tr>
              )
            })}
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

const thStyle = { padding: '11px 16px', fontWeight: 700 }
const tdStyle = { padding: '11px 16px', color: '#0c1446' }
