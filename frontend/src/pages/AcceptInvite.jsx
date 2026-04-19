import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { login } = useAuth()

  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [form, setForm] = useState({ password: '', confirm: '', full_name: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setPreviewError('No invite token in the URL. Please use the link from your invite email.')
      return
    }
    authApi.invitePreview(token)
      .then(res => {
        setPreview(res.data)
        setForm(f => ({ ...f, full_name: res.data.full_name || '' }))
      })
      .catch(err => {
        setPreviewError(err.response?.data?.detail || 'This invite link is invalid or has expired.')
      })
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    setSubmitting(true)
    try {
      const res = await authApi.acceptInvite({
        token,
        password: form.password,
        full_name: form.full_name,
      })
      login(res.data)
      toast.success(`Welcome to ${preview?.organisation || 'DataHub Pro'}!`)
      navigate('/hub')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not accept invite')
    } finally {
      setSubmitting(false)
    }
  }

  const pageShell = (content) => (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c1446 0%, #1a2a6c 50%, #0c1446 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: '#e91e8c', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.3rem', marginBottom: 12 }}>D</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446' }}>DataHub Pro</h1>
        </div>
        {content}
      </div>
    </div>
  )

  if (previewError) {
    return pageShell(
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0c1446', marginBottom: 10 }}>Invite unavailable</div>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 20 }}>{previewError}</p>
        <a href="/login" style={{ color: '#e91e8c', fontWeight: 600, fontSize: '0.9rem' }}>Go to sign in</a>
      </div>
    )
  }

  if (!preview) {
    return pageShell(
      <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading invite...</p>
    )
  }

  return pageShell(
    <>
      <p style={{ textAlign: 'center', color: '#4a5280', fontSize: '0.9rem', marginBottom: 24 }}>
        You've been invited to join <strong>{preview.organisation}</strong> as a <strong>{preview.role}</strong>.
        Set a password to activate your account.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={preview.email} disabled style={{ background: '#f9fafb' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Full name</label>
          <input className="form-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Smith" />
        </div>
        <div className="form-group">
          <label className="form-label">Create password</label>
          <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} placeholder="At least 8 characters" />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm password</label>
          <input className="form-input" type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required minLength={8} />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', padding: 12, marginTop: 6 }}>
          {submitting ? 'Activating...' : 'Activate account'}
        </button>
      </form>
    </>
  )
}
