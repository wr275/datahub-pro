import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectorsApi } from '../api'

const CONNECTOR_TYPES = [
  {
    id: 'shopify',
    name: 'Shopify',
    icon: '🛒',
    color: '#96bf48',
    description: 'Pull orders, products, and customers from your Shopify store',
    available: true,
    tooltip: 'Connect your Shopify store using a private app access token to automatically import live data.',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    icon: '💼',
    color: '#2ca01c',
    description: 'Import invoices, expenses, and P&L data',
    available: false,
    tooltip: 'QuickBooks integration coming soon — will sync invoices, expenses, and profit & loss reports.',
  },
  {
    id: 'xero',
    name: 'Xero',
    icon: '📘',
    color: '#1ab4d7',
    description: 'Sync accounts, invoices, and contacts',
    available: false,
    tooltip: 'Xero integration coming soon — will sync accounting data and contacts automatically.',
  },
]

const RESOURCE_OPTIONS = [
  { value: 'orders', label: 'Orders', tooltip: 'Pull all sales orders including status, totals, and customer info' },
  { value: 'products', label: 'Products', tooltip: 'Pull product catalogue with variants, SKUs, and inventory levels' },
  { value: 'customers', label: 'Customers', tooltip: 'Pull customer list with spend history and contact details' },
]

function Tooltip({ text }) {
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
      background: '#0c1446', color: '#fff', fontSize: '0.75rem', padding: '6px 10px',
      borderRadius: 6, whiteSpace: 'nowrap', zIndex: 100, pointerEvents: 'none',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', marginBottom: 6,
      maxWidth: 240, whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.4,
    }}>
      {text}
      <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0c1446' }} />
    </div>
  )
}

export default function ConnectData() {
  const navigate = useNavigate()
  const [connectors, setConnectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [syncing, setSyncing] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [form, setForm] = useState({ name: '', shop_domain: '', access_token: '', resource: 'orders' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadConnectors()
  }, [])

  const loadConnectors = () => {
    setLoading(true)
    connectorsApi.list()
      .then(r => setConnectors(r.data || []))
      .catch(() => setConnectors([]))
      .finally(() => setLoading(false))
  }

  const handleConnect = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      const resp = await connectorsApi.connectShopify(form)
      setMessage({ type: 'success', text: `✅ ${resp.data.message}` })
      setShowModal(false)
      setForm({ name: '', shop_domain: '', access_token: '', resource: 'orders' })
      loadConnectors()
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.response?.data?.detail || 'Connection failed'}` })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSync = async (connectorId) => {
    setSyncing(connectorId)
    setMessage(null)
    try {
      const resp = await connectorsApi.sync(connectorId)
      setMessage({ type: 'success', text: `✅ ${resp.data.message}` })
      loadConnectors()
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.response?.data?.detail || 'Sync failed'}` })
    } finally {
      setSyncing(null)
    }
  }

  const handleRemove = async (connectorId) => {
    if (!window.confirm('Remove this connector?')) return
    try {
      await connectorsApi.remove(connectorId)
      loadConnectors()
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove connector' })
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0c1446' }}>🔌 Connect Data</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Pull live data from external platforms directly into DataHub Pro
          </p>
        </div>
        <button onClick={() => navigate('/hub')} style={{ padding: '8px 16px', background: '#f8f9ff', border: '1px solid #e8eaf4', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280' }}>
          ← Back to Hub
        </button>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`, color: message.type === 'success' ? '#166534' : '#991b1b', fontSize: '0.9rem' }}>
          {message.text}
          {message.type === 'success' && <button onClick={() => navigate('/files')} style={{ marginLeft: 12, padding: '4px 10px', background: '#0c1446', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>View in Files →</button>}
        </div>
      )}

      {/* Available Connectors */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Available Connectors</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {CONNECTOR_TYPES.map(ct => (
            <div key={ct.id} style={{ position: 'relative' }}
              onMouseEnter={() => setTooltip(ct.id)}
              onMouseLeave={() => setTooltip(null)}>
              {tooltip === ct.id && <Tooltip text={ct.tooltip} />}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf4', padding: '20px 22px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: ct.available ? 1 : 0.65 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, background: ct.color + '18', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>{ct.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0c1446', fontSize: '1rem' }}>{ct.name}</div>
                    <div style={{ fontSize: '0.75rem', color: ct.available ? ct.color : '#9ca3af', fontWeight: 600 }}>{ct.available ? '● Active' : '◌ Coming Soon'}</div>
                  </div>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5 }}>{ct.description}</p>
                {ct.available ? (
                  <button onClick={() => setShowModal(true)} style={{ width: '100%', padding: '10px', background: '#0c1446', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                    + Connect {ct.name}
                  </button>
                ) : (
                  <button disabled style={{ width: '100%', padding: '10px', background: '#f3f4f6', color: '#9ca3af', border: 'none', borderRadius: 8, cursor: 'not-allowed', fontWeight: 600, fontSize: '0.85rem' }}>
                    Notify Me When Available
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Connections */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Active Connections ({loading ? '…' : connectors.length})
        </div>
        {!loading && connectors.length === 0 ? (
          <div style={{ background: '#f8f9ff', borderRadius: 12, border: '1px dashed #d1d5db', padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
            No connectors yet. Connect a data source above to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {connectors.map(c => (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8eaf4', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 38, height: 38, background: '#96bf4818', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🛒</div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '0.9rem' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {c.config?.shop_domain} · {c.config?.resource || 'orders'}
                      {c.last_sync_at && ` · Last sync: ${new Date(c.last_sync_at).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleSync(c.id)} disabled={syncing === c.id}
                    style={{ padding: '7px 14px', background: syncing === c.id ? '#f3f4f6' : '#0097b2', color: syncing === c.id ? '#9ca3af' : '#fff', border: 'none', borderRadius: 7, cursor: syncing === c.id ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                    {syncing === c.id ? '⟳ Syncing…' : '⟳ Sync Now'}
                  </button>
                  {c.last_file_id && (
                    <button onClick={() => navigate(`/analytics/${c.last_file_id}`)}
                      style={{ padding: '7px 14px', background: '#f8f9ff', color: '#0c1446', border: '1px solid #e8eaf4', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                      📊 Analyse
                    </button>
                  )}
                  <button onClick={() => handleRemove(c.id)}
                    style={{ padding: '7px 12px', background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shopify Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ fontSize: '1.4rem' }}>🛒</div>
              <div>
                <div style={{ fontWeight: 900, color: '#0c1446', fontSize: '1.1rem' }}>Connect Shopify</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Enter your store credentials to pull live data</div>
              </div>
            </div>
            <form onSubmit={handleConnect}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>Connection Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. My Shopify Store"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8eaf4', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Shop Domain
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>e.g. mystore.myshopify.com</span>
                </label>
                <input value={form.shop_domain} onChange={e => setForm(f => ({ ...f, shop_domain: e.target.value }))} required placeholder="mystore.myshopify.com"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8eaf4', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Access Token
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>Private app token from Shopify Admin → Apps → Private apps</span>
                </label>
                <input type="password" value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} required placeholder="shpat_xxxxxxxxxx"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8eaf4', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>Data to Import</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {RESOURCE_OPTIONS.map(r => (
                    <div key={r.value} style={{ position: 'relative', flex: 1 }}
                      onMouseEnter={() => setTooltip('res_' + r.value)}
                      onMouseLeave={() => setTooltip(null)}>
                      {tooltip === 'res_' + r.value && <Tooltip text={r.tooltip} />}
                      <button type="button" onClick={() => setForm(f => ({ ...f, resource: r.value }))}
                        style={{ width: '100%', padding: '10px 4px', background: form.resource === r.value ? '#0c1446' : '#f8f9ff', color: form.resource === r.value ? '#fff' : '#374151', border: `1px solid ${form.resource === r.value ? '#0c1446' : '#e8eaf4'}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                        {r.label}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setShowModal(false); setMessage(null) }}
                  style={{ flex: 1, padding: '11px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ flex: 2, padding: '11px', background: submitting ? '#9ca3af' : '#0c1446', color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'wait' : 'pointer', fontWeight: 700 }}>
                  {submitting ? 'Connecting…' : 'Connect & Import Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
