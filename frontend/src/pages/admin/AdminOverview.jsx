import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts'
import AdminLayout from '../../components/AdminLayout'
import { adminApi } from '../../api'
import { formatCents, formatNumber, formatDate, planBadge } from './adminFormat'

// KPI card — deliberately heavyweight visually so at-a-glance scanning
// of the dashboard is effortless. Every number on this screen is a leading
// indicator of either platform health or revenue.
function KpiCard({ icon, label, value, hint, accent = '#6d28d9' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f3f4f6',
      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 118,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: accent + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem'
        }}>{icon}</div>
        <div style={{ color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0c1446', lineHeight: 1 }}>
        {value}
      </div>
      {hint && <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{hint}</div>}
    </div>
  )
}

export default function AdminOverview() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    adminApi.overview()
      .then(res => setData(res.data))
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load overview'))
  }, [])

  if (err) {
    return (
      <AdminLayout title="Overview" subtitle="Platform health at a glance">
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 16, borderRadius: 10 }}>{err}</div>
      </AdminLayout>
    )
  }

  if (!data) {
    return (
      <AdminLayout title="Overview" subtitle="Platform health at a glance">
        <div style={{ color: '#6b7280' }}>Loading…</div>
      </AdminLayout>
    )
  }

  const t = data.totals || {}
  // Backend returns plan_distribution as { starter: N, growth: N, enterprise: N }.
  // Normalise to array for recharts.
  const planDist = Object.entries(data.plan_distribution || {})
    .map(([plan, count]) => ({ plan, count }))
  const signups = data.daily_signups || []
  const recent = data.recent_users || []

  return (
    <AdminLayout title="Overview" subtitle="Signups, revenue, AI adoption and platform usage">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard icon="🏢" label="Organisations" value={formatNumber(t.organisations)} hint={`${t.paying || 0} paying · ${t.trialing || 0} trial`} accent="#6d28d9" />
        <KpiCard icon="👤" label="Users"         value={formatNumber(t.users)}         hint={`${t.new_users_7d || 0} new in 7 days`} accent="#2563eb" />
        <KpiCard icon="🤖" label="AI-enabled orgs" value={formatNumber(t.ai_enabled)}  hint={`${t.pending_ai_requests || 0} pending requests`} accent="#0ea5e9" />
        <KpiCard icon="💷" label="MRR"           value={formatCents(t.mrr_pence)}      hint={`${t.paying || 0} active subscriptions`} accent="#16a34a" />
        <KpiCard icon="📈" label="Signups (30d)" value={formatNumber(t.new_users_30d)} hint={`${t.new_users_7d || 0} this week`} accent="#ea580c" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card title="Signups — last 30 days" subtitle={`${signups.reduce((a, b) => a + (b.count || 0), 0)} total`}>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signups} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatDate} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip labelFormatter={formatDate} />
                <Line type="monotone" dataKey="count" stroke="#6d28d9" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Plan distribution" subtitle="Active subscriptions">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planDist} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="plan" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {planDist.map((p, i) => <Cell key={i} fill={planBadge(p.plan).fg} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Recent signups" subtitle={`${recent.length} newest users`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#9ca3af', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '8px 4px' }}>User</th>
                <th style={{ padding: '8px 4px' }}>Workspace</th>
                <th style={{ padding: '8px 4px' }}>Role</th>
                <th style={{ padding: '8px 4px' }}>Signed up</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 4px' }}>
                    <div style={{ fontWeight: 600, color: '#0c1446' }}>{u.full_name || u.email}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '8px 4px', color: '#6b7280' }}>{u.organisation_name || '—'}</td>
                  <td style={{ padding: '8px 4px', color: '#6b7280' }}>{u.role}</td>
                  <td style={{ padding: '8px 4px', color: '#6b7280' }}>{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminLayout>
  )
}

function Card({ title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: '#0c1446' }}>{title}</div>
        {subtitle && <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}
