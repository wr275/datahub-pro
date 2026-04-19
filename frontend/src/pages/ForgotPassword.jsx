import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  // We always tell the user "check your inbox" even if the email doesn't
  // exist — that way we never reveal whether a given address is registered.
  // Backend enforces the same on its side.
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      // The backend always 200s — but just in case of network error, show a
      // toast and let the user retry.
      toast.error(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c1446 0%, #1a2a6c 50%, #0c1446 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: '#e91e8c', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.3rem', marginBottom: 12 }}>D</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1446' }}>Forgot your password?</h1>
          <p style={{ color: '#4a5280', fontSize: '0.88rem', marginTop: 6 }}>
            {sent
              ? "Check your inbox — if an account exists for this email, a reset link is on its way."
              : "Enter your email and we'll send you a link to reset it."}
          </p>
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        {sent && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: 14, borderRadius: 10, fontSize: '0.88rem', lineHeight: 1.5 }}>
            The link expires in 60 minutes. If you don't see the email within a few minutes, check your spam folder.
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 22, fontSize: '0.85rem', color: '#4a5280' }}>
          <Link to="/login" style={{ color: '#e91e8c', fontWeight: 600 }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
