import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', organisation_name: '' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await authApi.register(form)
      login(res.data)
      toast.success('Account created! Welcome to DataHub Pro')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c1446 0%, #1a2a6c 50%, #0c1446 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: '#e91e8c', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.3rem', marginBottom: 12 }}>D</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1446' }}>Start your free 14-day trial</h1>
          <p style={{ color: '#4a5280', fontSize: '0.85rem', marginTop: 4 }}>No credit card required</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" type="text" placeholder="Jane Smith" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Company name</label>
            <input className="form-input" type="text" placeholder="Acme Ltd" value={form.organisation_name} onChange={e => setForm({...form, organisation_name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Work email</label>
            <input className="form-input" type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}>
            {loading ? 'Creating account...' : 'Start free trial →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.82rem', color: '#8b92b3' }}>
          By signing up you agree to our <a href="#" style={{ color: '#e91e8c' }}>Terms of Service</a> and <a href="#" style={{ color: '#e91e8c' }}>Privacy Policy</a>
        </p>
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.85rem', color: '#4a5280' }}>
          Already have an account? <Link to="/login" style={{ color: '#e91e8c', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
