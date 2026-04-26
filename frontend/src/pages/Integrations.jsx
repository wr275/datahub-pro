import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Integrations hub — static catalogue. Cards with a `route` navigate to a
// dedicated page that handles its own OAuth / connection flow. Cards without
// one are still stubs (marked "Coming soon") until the integration is built.
const INTEGRATIONS = [
  { id: 'google-sheets', name: 'Google Sheets',    icon: '📊', category: 'Data Sources',  desc: 'Import private sheets + schedule hourly/daily auto-sync', color: '#34a853', route: '/google-sheets' },
  { id: 'sharepoint',    name: 'SharePoint / OneDrive', icon: '📁', category: 'Data Sources', desc: 'Browse SharePoint + OneDrive files and import .xlsx / .csv', color: '#0078D4', route: '/sharepoint' },
  { id: 'excel',         name: 'Microsoft Excel',  icon: '📗', category: 'Data Sources',  desc: 'Import Excel files from OneDrive (via SharePoint integration)', color: '#217346', route: '/sharepoint' },
  { id: 'salesforce',    name: 'Salesforce',       icon: '☁️', category: 'CRM',            desc: 'Sync CRM data for sales analytics', color: '#00a1e0' },
  { id: 'hubspot',       name: 'HubSpot',          icon: '🧡', category: 'CRM',            desc: 'Import marketing and sales data', color: '#ff7a59' },
  { id: 'postgres',      name: 'PostgreSQL',       icon: '🐘', category: 'Databases',      desc: 'Connect to your PostgreSQL database', color: '#336791' },
  { id: 'mysql',         name: 'MySQL',            icon: '🐬', category: 'Databases',      desc: 'Import data from MySQL databases', color: '#00758f' },
  { id: 'bigquery',      name: 'Google BigQuery',  icon: '🔭', category: 'Cloud',          desc: 'Query large datasets from BigQuery', color: '#4285f4' },
  { id: 'aws-s3',        name: 'AWS S3',           icon: '🪣', category: 'Cloud',          desc: 'Load CSV/JSON files from S3 buckets', color: '#ff9900' },
  { id: 'slack',         name: 'Slack',            icon: '💬', category: 'Notifications',  desc: 'Send report alerts to Slack channels', color: '#4a154b' },
  { id: 'email',         name: 'Email / SMTP',     icon: '📧', category: 'Notifications',  desc: 'Send scheduled reports via email (built-in)', color: '#e91e8c', builtIn: true },
  { id: 'zapier',        name: 'Zapier',           icon: '⚡', category: 'Automation',     desc: 'Connect to 5000+ apps via Zapier', color: '#ff4a00' },
  { id: 'webhook',       name: 'Webhook',          icon: '🔗', category: 'Automation',     desc: 'Send data to any URL endpoint', color: '#6366f1' },
]

export default function Integrations() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = ['All', ...new Set(INTEGRATIONS.map(i => i.category))]
  const filtered = selectedCategory === 'All' ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === selectedCategory)

  const handleConnect = (integration) => {
    if (integration.route) {
      navigate(integration.route)
    } else {
      alert(`${integration.name} is coming soon — let us know if you'd like to prioritise it.`)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Integrations</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>
        Connect DataHub Pro to your data sources and business tools
      </p>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setSelectedCategory(c)}
            style={{
              padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: selectedCategory === c ? '#0c1446' : '#f3f4f6',
              color: selectedCategory === c ? '#fff' : '#374151',
              fontWeight: 600, fontSize: '0.85rem',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map(integration => {
          const actionable = !!integration.route
          return (
            <div
              key={integration.id}
              style={{
                background: '#fff', borderRadius: 12, padding: 20,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: integration.builtIn ? `2px solid ${integration.color}30` : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: integration.color + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem',
                  }}>
                    {integration.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.95rem' }}>{integration.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{integration.category}</div>
                  </div>
                </div>
                {integration.builtIn && (
                  <span style={{
                    padding: '3px 8px', background: '#dcfce7', color: '#166534',
                    borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
                  }}>
                    Built-in
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 14, minHeight: 30 }}>
                {integration.desc}
              </div>
              <button
                onClick={() => handleConnect(integration)}
                disabled={!actionable && !integration.builtIn}
                style={{
                  width: '100%', padding: '8px',
                  background: actionable ? integration.color : '#f3f4f6',
                  color: actionable ? '#fff' : '#9ca3af',
                  border: 'none', borderRadius: 8, fontWeight: 700,
                  cursor: actionable ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem',
                }}
              >
                {integration.builtIn ? 'Already enabled' : actionable ? 'Open' : 'Coming soon'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
