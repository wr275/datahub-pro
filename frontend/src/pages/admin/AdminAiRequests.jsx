import React, { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { adminApi } from '../../api'
import { formatDateTime, statusBadge } from './adminFormat'

const TABS = [
  { key: 'pending',  label: 'Pending',  colour: '#f59e0b' },
  { key: 'approved', label: 'Approved', colour: '#16a34a' },
  { key: 'denied',   label: 'Denied',   colour: '#dc2626' },
]

export default function AdminAiRequests() {
  const [tab, setTab] = useState('pending')
  const [data, setData] = useState({ requests: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [decision, setDecision] = useState(null) // { request, kind: 'approve'|'deny' }
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await adminApi.listAiRequests({ status: tab })
      setData(res.data || { requests: [], counts: {} })
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load AI requests')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { reload() }, [reload])

  const submit = async () => {
    if (!decision) return
    setSubmitting(true)
    try {
      if (decision.kind === 'approve') {
        await adminApi.approveAiRequest(decision.request.id, note)
      } else {
        await adminApi.denyAiRequest(decision.request.id, note)
      }
      setDecision(null)
      setNote('')
      reload()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const counts = data.counts || {}

  return (
    <AdminLayout
      title="AI Access Requests"
      subtitle="Workspaces waiting for the AI add-on — one-click approve or deny, with an optional note to the requester"
    >
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            borderBottom: tab === t.key ? `2px solid ${t.colour}` : '2px solid transparent',
            color: tab === t.key ? t.colour : '#6b7280',
            fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
            fontSize: '0.9rem'
          }}>
            {t.label}
            {counts[t.key] != null && (
              <span style={{ marginLeft: 8, padding: '1px 8px', background: tab === t.key ? t.colour + '22' : '#f3f4f6', color: tab === t.key ? t.colour : '#6b7280', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 12 }}>{err}</div>}

      {loading && <div style={{ color: '#9ca3af' }}>Loading…</div>}

      {!loading && data.requests.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #f3f4f6', padding: 40, textAlign: 'center', color: '#9ca3af', borderRadius: 12 }}>
          {tab === 'pending' ? "No pending requests — you're all caught up." : `No ${tab} requests yet.`}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {data.requests.map(r => (
          <RequestCard
            key={r.id}
            request={r}
            tab={tab}
            onApprove={() => { setDecision({ request: r, kind: 'approve' }); setNote('') }}
            onDeny={() => { setDecision({ request: r, kind: 'deny' }); setNote('') }}
          />
        ))}
      </div>

      {decision && (
        <DecisionModal
          decision={decision}
          note={note}
          setNote={setNote}
          submitting={submitting}
          onCancel={() => { setDecision(null); setNote('') }}
          onSubmit={submit}
        />
      )}
    </AdminLayout>
  )
}

function RequestCard({ request, tab, onApprove, onDeny }) {
  const sb = statusBadge(request.status)
  // Backend shape: { id, status, created_at, reviewed_at, review_note,
  //   organisation: {name, plan, ai_enabled}, requester: {email, full_name, role} }
  const org = request.organisation || {}
  const who = request.requester || {}

  return (
    <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, color: '#0c1446' }}>{org.name || '(unknown workspace)'}</div>
          <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, background: sb.bg, color: sb.fg, textTransform: 'uppercase' }}>{request.status}</span>
          {org.plan && (
            <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>· {org.plan}</span>
          )}
          {org.ai_enabled && (
            <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, background: '#dcfce7', color: '#166534' }}>AI ACTIVE</span>
          )}
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
          Requested by <strong style={{ color: '#0c1446' }}>{who.full_name || who.email || 'unknown'}</strong>
          {who.email && who.full_name && <> · {who.email}</>}
          {who.role && <> · {who.role}</>}
        </div>
        <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 2 }}>
          {formatDateTime(request.created_at)}
        </div>
        {request.review_note && (
          <div style={{ marginTop: 8, padding: 10, background: '#f9fafb', borderLeft: '3px solid #6d28d9', fontSize: '0.85rem', color: '#374151' }}>
            <strong style={{ color: '#6d28d9' }}>Your note:</strong> {request.review_note}
          </div>
        )}
      </div>
      {tab === 'pending' && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onDeny} style={{ padding: '9px 16px', background: '#fff', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Deny</button>
          <button onClick={onApprove} style={{ padding: '9px 18px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
        </div>
      )}
    </div>
  )
}

function DecisionModal({ decision, note, setNote, submitting, onCancel, onSubmit }) {
  const approving = decision.kind === 'approve'
  const orgName = decision.request.organisation?.name || 'this workspace'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ width: 500, maxWidth: '92vw', background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0c1446' }}>
          {approving ? 'Approve AI access' : 'Deny AI access'}
        </h3>
        <p style={{ color: '#374151', fontSize: '0.92rem', marginTop: 8, lineHeight: 1.5 }}>
          {approving
            ? <>This will enable AI features for <strong>{orgName}</strong> immediately and email the requester.</>
            : <>The request from <strong>{orgName}</strong> will be closed and the requester will be emailed.</>
          }
        </p>
        <label style={{ display: 'block', marginTop: 14, color: '#374151', fontWeight: 600, fontSize: '0.85rem' }}>
          Optional note to the requester
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={approving ? 'e.g. "You\'re all set — let us know if you run into any rate limits."' : 'e.g. "We\'ll revisit this after your workspace upgrades to Growth."'}
          rows={3}
          style={{ width: '100%', marginTop: 6, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onCancel} disabled={submitting} style={{ padding: '9px 18px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onSubmit} disabled={submitting} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: approving ? '#16a34a' : '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Submitting…' : (approving ? 'Approve & email' : 'Deny & email')}
          </button>
        </div>
      </div>
    </div>
  )
}
