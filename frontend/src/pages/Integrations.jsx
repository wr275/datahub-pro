import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''

const INTEGRATIONS = [
  { id: 'sharepoint', name: 'SharePoint / OneDrive', icon: '🏢', category: 'Microsoft', desc: 'Browse and import files directly from SharePoint or OneDrive using enterprise SSO', connected: false, color: '#0078d4', isOAuth: true, path: '/sharepoint' },
  { id: 'google-sheets', name: 'Google Sheets', icon: '📊', category: 'Data Sources', desc: 'Import data directly from Google Sheets', connected: false, color: '#34a853' },
  { id: 'excel', name: 'Microsoft Excel', icon: '📗', category: 'Data Sources', desc: 'Connect to Excel files via OneDrive', connected: false, color: '#217346' },
  { id: 'salesforce', name: 'Salesforce', icon: '☁️', category: 'CRM', desc: 'Sync CRM data for sales analytics', connected: false, color: '#00a1e0' },
  { id: 'hubspot', name: 'HubSpot', icon: '🧡', category: 'CRM', desc: 'Import marketing and sales data', connected: false, color: '#ff7a59' },
  { id: 'postgres', name: 'PostgreSQL', icon: '🐘', category: 'Databases', desc: 'Connect to your PostgreSQL database', connected: true, color: '#336791' },
  { id: 'mysql', name: 'MySQL', icon: '🐬', category: 'Databases', desc: 'Import data from MySQL databases', connected: false, color: '#00758f' },
  { id: 'bigquery', name: 'Google BigQuery', icon: '🔭', category: 'Cloud', desc: 'Query large datasets from BigQuery', connected: false, color: '#4285f4' },
  { id: 'aws-s3', name: 'AWS S3', icon: '🪣', category: 'Cloud', desc: 'Load CSV/JSON files from S3 buckets', connected: false, color: '#ff9900' },
  { id: 'slack', name: 'Slack', icon: '💬', category: 'Notifications', desc: 'Send report alerts to Slack channels', connected: false, color: '#4a154b' },
  { id: 'email', name: 'Email / SMTP', icon: '📧', category: 'Notifications', desc: 'Send scheduled reports via email', connected: true, color: '#e91e8c' },
  { id: 'zapier', name: 'Zapier', icon: '⚡', category: 'Automation', desc: 'Connect to 5000+ apps via Zapier', connected: false, color: '#ff4a00' },
  { id: 'webhook', name: 'Webhook', icon: '🔗', category: 'Automation', desc: 'Send data to any URL endpoint', connected: false, color: '#6366f1' },
]

export default function Integrations() {
  const navigate = useNavigate()
  const [integrations, setIntegrations] = useState(INTEGRATIONS)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [configuring, setConfiguring] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [spStatus, setSpStatus] = useState(null)

  // Check SharePoint connection status on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/sharepoint/status`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const connected = data.connected === true
        setSpStatus(data)
        setIntegrations(prev => prev.map(i =>
          i.id === 'sharepoint' ? { ...i, connected } : i
        ))
      })
      .catch(() => {})
  }, [])

  function toggle(integration) {
    if (integration.isOAuth) {
      navigate(integration.path)
      return
    }
    if (!integration.connected) {
      setConfiguring(integration.id)
    } else {
      setIntegrations(integrations.map(i => i.id === integration.id ? { ...i, connected: false } : i))
    }
  }

  function connect() {
    setIntegrations(integrations.map(i => i.id === configuring ? { ...i, connected: true } : i))
    setConfiguring(null); setApiKey('')
  }

  const categories = ['All', ...new Set(INTEGRATIONS.map(i => i.category))]
  const filtered = selectedCategory === 'All' ? integrations : integrations.filter(i => i.category === selectedCategory)
  const connectedCount = integrations.filter(i => i.connected).length

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Integrations</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Connect DataHub Pro to your data sources and business tools</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24, display: 'flex', gap: 24 }}>
        <div><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Connected: </span><span style={{ fontWeight: 800, color: '#10b981', fontSize: '1.2rem' }}>{connectedCount}</span></div>
        <div><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Available: </span><span style={{ fontWeight: 800, color: '#0c1446', fontSize: '1.2rem' }}>{integrations.length}</span></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {categories.map(c => <button key={c} onClick={() => setSelectedCategory(c)} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', background: selectedCategory === c ? '#0c1446' : '#f3f4f6', color: selectedCategory === c ? '#fff' : '#374151', fontWeight: 600, fontSize: '0.85rem' }}>{c}</button>)}
      </div>

      {configuring && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24, border: '2px solid #e91e8c30' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Connect {integrations.find(i => i.id === configuring)?.name}</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>API Key / Connection String</div>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter your credentials..." style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={connect} style={{ padding: '9px 20px', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Connect</button>
            <button onClick={() => setConfiguring(null)} style={{ padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map(integration => (
          <div key={integration.id} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: integration.connected ? `2px solid ${integration.color}40` : '2px solid transparent', position: 'relative' }}>
            {/* Enterprise SSO badge for SharePoint */}
            {integration.id === 'sharepoint' && (
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'linear-gradient(135deg, #0078d4, #005a9e)', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                ENTERPRISE SSO
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: integration.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>{integration.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.95rem', paddingRight: integration.id === 'sharepoint' ? 90 : 0 }}>{integration.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{integration.category}</div>
                </div>
              </div>
              {integration.connected && <span style={{ padding: '3px 8px', background: '#dcfce7', color: '#166534', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>Connected</span>}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: integration.id === 'sharepoint' && spStatus?.connected && spStatus?.user_display_name ? 10 : 14 }}>{integration.desc}</div>
            {/* SharePoint connected user info */}
            {integration.id === 'sharepoint' && spStatus?.connected && spStatus?.user_display_name && (
              <div style={{ marginBottom: 10, padding: '8px 10px', background: '#eff6ff', borderRadius: 8, fontSize: '0.8rem', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span> Signed in as <strong>{spStatus.user_display_name}</strong>
              </div>
            )}
            <button onClick={() => toggle(integration)} style={{ width: '100%', padding: '8px', background: integration.connected ? '#fee2e2' : integration.color, color: integration.connected ? '#ef4444' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              {integration.isOAuth
                ? (integration.connected ? 'Manage Connection →' : 'Connect with Microsoft →')
                : (integration.connected ? 'Disconnect' : 'Connect')
              }
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
