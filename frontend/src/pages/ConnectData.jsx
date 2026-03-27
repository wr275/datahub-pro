import { useState, useEffect } from 'react'
import { connectorsApi } from '../api'

const SHOPIFY_ICON = (
  <svg viewBox="0 0 109.5 124.5" width="32" height="32" fill="#96BF48">
    <path d="M74.7 14.8s-.3.9-.8 2.5c-.8-.2-1.8-.4-2.8-.4-3.4 0-5 1.6-5 1.6s-2.2-1.5-6.2-1.5c-8 0-11.9 5.8-13 11.6-3.7 1.2-6.3 2-6.3 2l-.1.1c-.2.8-.2 1.6-.2 2.4 0 0-3.3 24.2-3.3 37.7C37 84.5 62 95 62 95s24-10.5 24-26.2c0-13.5-3.3-37.7-3.3-37.7l-.1-.1s-2.6-.8-6.3-2c-.4-3.8-2-7.8-5.2-10.7 1.5-3 3.6-3.5 3.6-3.5z"/>
  </svg>
)

function Modal({ onClose, onSave }) {
  const [form, setForm] = useState({ shop_domain: '', access_token: '', data_type: 'orders', name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.shop_domain || !form.access_token) { setError('Shop domain and access token are required'); return }
    setLoading(true); setError('')
    try {
      await connectorsApi.connectShopify(form)
      onSave()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to connect')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:12, padding:32, width:460, maxWidth:'90vw' }}>
        <h3 style={{ margin:'0 0 20px', color:'#fff', fontSize:18 }}>Connect Shopify Store</h3>
        {error && <div style={{ background:'#ff4444', color:'#fff', padding:'8px 12px', borderRadius:6, marginBottom:16, fontSize:13 }}>{error}</div>}
        <label style={{ display:'block', marginBottom:16 }}>
          <span style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:6 }}>Connector Name (optional)</span>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Shopify Store" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'8px 12px', color:'#fff', boxSizing:'border-box' }} />
        </label>
        <label style={{ display:'block', marginBottom:16 }}>
          <span style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:6 }}>Shop Domain *</span>
          <input value={form.shop_domain} onChange={e => setForm(f => ({ ...f, shop_domain: e.target.value }))} placeholder="mystore.myshopify.com" style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'8px 12px', color:'#fff', boxSizing:'border-box' }} />
        </label>
        <label style={{ display:'block', marginBottom:16 }}>
          <span style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:6 }}>Access Token *</span>
          <input type="password" value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} placeholder="shpat_..." style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'8px 12px', color:'#fff', boxSizing:'border-box' }} />
          <span style={{ fontSize:11, color:'#666', marginTop:4, display:'block' }}>Find this in Shopify Admin → Apps → Private apps</span>
        </label>
        <label style={{ display:'block', marginBottom:24 }}>
          <span style={{ display:'block', color:'#aaa', fontSize:12, marginBottom:6 }}>Data Type</span>
          <select value={form.data_type} onChange={e => setForm(f => ({ ...f, data_type: e.target.value }))} style={{ width:'100%', background:'#2a2a3e', border:'1px solid #444', borderRadius:6, padding:'8px 12px', color:'#fff', boxSizing:'border-box' }}>
            <option value="orders">Orders</option>
            <option value="products">Products</option>
            <option value="customers">Customers</option>
          </select>
        </label>
        <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 20px', borderRadius:6, border:'1px solid #444', background:'transparent', color:'#aaa', cursor:'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ padding:'8px 20px', borderRadius:6, border:'none', background:'#96BF48', color:'#fff', cursor:'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConnectData() {
  const [connectors, setConnectors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [syncing, setSyncing] = useState({})
  const [message, setMessage] = useState('')

  const load = async () => {
    try { const r = await connectorsApi.list(); setConnectors(r.data) } catch {}
  }

  useEffect(() => { load() }, [])

  const handleSync = async (id) => {
    setSyncing(s => ({ ...s, [id]: true }))
    try {
      await connectorsApi.sync(id)
      setMessage('Sync complete!'); load()
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Sync failed')
      setTimeout(() => setMessage(''), 3000)
    } finally { setSyncing(s => ({ ...s, [id]: false })) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this connector?')) return
    try { await connectorsApi.remove(id); load() } catch {}
  }

  return (
    <div style={{ padding:32, maxWidth:900, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32 }}>
        <div>
          <h1 style={{ color:'#fff', margin:0, fontSize:24 }}>Data Connectors</h1>
          <p style={{ color:'#888', margin:'8px 0 0', fontSize:14 }}>Connect live data sources. Data is pulled and saved as a dataset you can use in dashboards and pipelines.</p>
        </div>
      </div>

      {message && <div style={{ background: message.includes('fail') || message.includes('Sync failed') ? '#ff4444' : '#22c55e', color:'#fff', padding:'10px 16px', borderRadius:8, marginBottom:20, fontSize:14 }}>{message}</div>}

      {/* Available connectors */}
      <h2 style={{ color:'#ccc', fontSize:15, marginBottom:16, fontWeight:500 }}>Available Connectors</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16, marginBottom:40 }}>
        {/* Shopify */}
        <div style={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:12, padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:48, height:48, background:'#f6f0e8', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🛒</div>
            <div>
              <div style={{ color:'#fff', fontWeight:600, fontSize:15 }}>Shopify</div>
              <div style={{ color:'#888', fontSize:12 }}>Orders, Products, Customers</div>
            </div>
          </div>
          <p style={{ color:'#aaa', fontSize:13, margin:'0 0 16px', lineHeight:1.5 }}>Pull live Shopify data using a private app access token. Auto-saves as a CSV dataset.</p>
          <button onClick={() => setShowModal(true)} style={{ width:'100%', padding:'8px 16px', borderRadius:6, border:'1px solid #96BF48', background:'transparent', color:'#96BF48', cursor:'pointer', fontSize:13, fontWeight:500 }}>+ Connect Shopify</button>
        </div>

        {/* QuickBooks - coming soon */}
        <div style={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:12, padding:24, opacity:0.6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:48, height:48, background:'#e8f5e8', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>📊</div>
            <div>
              <div style={{ color:'#fff', fontWeight:600, fontSize:15 }}>QuickBooks</div>
              <div style={{ color:'#888', fontSize:12 }}>P&L, Balance Sheet, Invoices</div>
            </div>
          </div>
          <p style={{ color:'#aaa', fontSize:13, margin:'0 0 16px', lineHeight:1.5 }}>Connect QuickBooks Online to pull financial reports directly into DataHub Pro.</p>
          <button disabled style={{ width:'100%', padding:'8px 16px', borderRadius:6, border:'1px solid #555', background:'transparent', color:'#666', cursor:'not-allowed', fontSize:13 }}>Coming Soon</button>
        </div>

        {/* Xero - coming soon */}
        <div style={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:12, padding:24, opacity:0.6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:48, height:48, background:'#e8f0f8', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>💼</div>
            <div>
              <div style={{ color:'#fff', fontWeight:600, fontSize:15 }}>Xero</div>
              <div style={{ color:'#888', fontSize:12 }}>Accounting & Payroll data</div>
            </div>
          </div>
          <p style={{ color:'#aaa', fontSize:13, margin:'0 0 16px', lineHeight:1.5 }}>Sync accounting data from Xero including transactions, invoices, and reporting.</p>
          <button disabled style={{ width:'100%', padding:'8px 16px', borderRadius:6, border:'1px solid #555', background:'transparent', color:'#666', cursor:'not-allowed', fontSize:13 }}>Coming Soon</button>
        </div>
      </div>

      {/* Active connectors */}
      {connectors.length > 0 && (
        <>
          <h2 style={{ color:'#ccc', fontSize:15, marginBottom:16, fontWeight:500 }}>Active Connections ({connectors.length})</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {connectors.map(c => (
              <div key={c.id} style={{ background:'#1e1e2e', border:'1px solid #333', borderRadius:10, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ width:36, height:36, background:'#f6f0e8', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🛒</div>
                  <div>
                    <div style={{ color:'#fff', fontWeight:500, fontSize:14 }}>{c.name}</div>
                    <div style={{ color:'#888', fontSize:12 }}>
                      {c.connector_type} · {c.status} · {c.last_sync_at ? 'Synced ' + new Date(c.last_sync_at).toLocaleDateString() : 'Never synced'}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => handleSync(c.id)} disabled={syncing[c.id]} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #444', background:'transparent', color:'#ccc', cursor:'pointer', fontSize:12 }}>
                    {syncing[c.id] ? 'Syncing...' : '⟳ Sync'}
                  </button>
                  <button onClick={() => handleDelete(c.id)} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #ff4444', background:'transparent', color:'#ff4444', cursor:'pointer', fontSize:12 }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && <Modal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); setMessage('Connector added and data synced!'); setTimeout(() => setMessage(''), 3000) }} />}
    </div>
  )
}
