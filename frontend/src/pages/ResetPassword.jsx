import React, { useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // Token comes straight from the email link — it's a random string, not a
  // JWT — and gets sha256'd on the server for lookup.
  const token = useMemo(() => params.get('token') || '', [params])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const missingToken = !token
  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = !missingToken && password.length >= 8 && password === confirm && !loading

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      toast.success('Password reset — you can now sign in.')
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c1446 0%, #1a2a6c 50%, #0c1446 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: '#e91e8c', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.3rem', marginBottom: 12 }}>D</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1446' }}>Choose a new password</h1>
          <p style={{ color: '#4a5280', fontSize: '0.88rem', marginTop: 6 }}>
            {missingToken
              ? "This reset link is missing its token. Please request a new one."
              : "Pick something at least 8 characters long."}
          </p>
        </div>

        {!missingToken && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">New password</label>
              <input
                className="form-input"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
              />
              {tooShort && <div style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: 4 }}>Must be at least 8 characters.</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
              {mismatch && <div style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: 4 }}>Passwords don't match.</div>}
            </div>
            <button type="submit" className="btn-primary" disabled={!canSubmit} style={{ width: '100%', justifyContent: 'center', padding: '12px', opacity: canSubmit ? 1 : 0.6 }}>
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        )}

        {missingToken && (
          <Link to="/forgot-password" style={{ display: 'block', textAlign: 'center', padding: '12px', background: '#e91e8c', color: '#fff', fontWeight: 700, borderRadius: 8, textDecoration: 'none' }}>
            Request a new reset link
          </Link>
        )}

        <p style={{ textAlign: 'center', marginTop: 22, fontSize: '0.85rem', color: '#4a5280' }}>
          <Link to="/login" style={{ color: '#e91e8c', fontWeight: 600 }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
