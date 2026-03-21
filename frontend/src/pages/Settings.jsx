import React, { useState } from 'react'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user } = useAuth()
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await authApi.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password })
      toast.success('Password updated successfully')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446' }}>Settings</h1>
        <p style={{ color: '#4a5280', marginTop: 4 }}>Manage your account preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
        {/* Profile */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 20, color: '#0c1446' }}>Profile Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" defaultValue={user?.full_name} disabled style={{ background: '#f8f9fc' }} /></div>
            <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" defaultValue={user?.email} disabled style={{ background: '#f8f9fc' }} /></div>
            <div className="form-group"><label className="form-label">Organisation</label><input className="form-input" defaultValue={user?.organisation?.name} disabled style={{ background: '#f8f9fc' }} /></div>
            <div className="form-group"><label className="form-label">Role</label><input className="form-input" defaultValue={user?.role} disabled style={{ background: '#f8f9fc', textTransform: 'capitalize' }} /></div>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#8b92b3', marginTop: 12 }}>To update your profile details, contact your workspace owner.</p>
        </div>

        {/* Password */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 20, color: '#0c1446' }}>Change Password</h2>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" placeholder="••••••••" value={pwForm.current_password} onChange={e => setPwForm({...pwForm, current_password: e.target.value})} required /></div>
            <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" placeholder="Min. 8 characters" value={pwForm.new_password} onChange={e => setPwForm({...pwForm, new_password: e.target.value})} required /></div>
            <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" placeholder="••••••••" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} required /></div>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Updating...' : 'Update Password'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
