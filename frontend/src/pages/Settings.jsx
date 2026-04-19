import React, { useState } from 'react'
import { authApi, organisationApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)

  const aiEnabled = !!(user?.organisation?.ai_enabled ?? user?.ai_enabled)
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin'

  const handleAiToggle = async () => {
    setAiSaving(true)
    try {
      await organisationApi.setAiEnabled(!aiEnabled)
      await refreshUser()
      toast.success(aiEnabled ? 'AI features disabled' : 'AI features enabled')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update AI access')
    } finally {
      setAiSaving(false)
    }
  }

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
            <div className="form-group"><label className="form-label">Organisation</label><input className="form-input" defaultValue={user?.organisation} disabled style={{ background: '#f8f9fc' }} /></div>
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

        {/* AI add-on — owner/admin only */}
        <div className="card" style={{ padding: 24, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 360px' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6, color: '#0c1446' }}>
                AI Add-on
                <span style={{
                  marginLeft: 10, padding: '2px 10px', borderRadius: 20,
                  fontSize: '0.72rem', fontWeight: 600,
                  background: aiEnabled ? '#dcfce7' : '#f3f4f6',
                  color: aiEnabled ? '#166534' : '#6b7280',
                }}>{aiEnabled ? 'Enabled' : 'Disabled'}</span>
              </h2>
              <p style={{ color: '#4a5280', fontSize: '0.85rem', lineHeight: 1.55, marginTop: 8 }}>
                Grants this workspace access to the AI section — Ask Your Data, AI Insights,
                AI Narrative, Auto Report, Formula Builder AI, and AI Settings.
                All non-AI tools (charts, pivots, forecasts, dashboards) work regardless of this setting.
              </p>
            </div>
            {isOwnerOrAdmin ? (
              <button
                onClick={handleAiToggle}
                disabled={aiSaving}
                className={aiEnabled ? '' : 'btn-primary'}
                style={{
                  padding: '10px 20px', fontSize: '0.88rem', fontWeight: 700,
                  borderRadius: 8, cursor: 'pointer', minWidth: 180,
                  border: aiEnabled ? '1px solid #e2e5f1' : 'none',
                  background: aiEnabled ? '#fff' : undefined,
                  color: aiEnabled ? '#0c1446' : undefined,
                }}
              >
                {aiSaving ? 'Saving…' : (aiEnabled ? 'Disable AI' : 'Enable AI')}
              </button>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#6b7280', maxWidth: 240, textAlign: 'right' }}>
                Only workspace owners and admins can change this.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
