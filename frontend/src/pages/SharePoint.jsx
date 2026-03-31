/**
 * SharePoint / OneDrive Integration Page
 *
 * Flow:
 *  1. Check /api/sharepoint/status on mount
 *  2. If not connected → show "Connect SharePoint" button
 *  3. Button calls /api/sharepoint/auth-url, opens the URL in the same tab
 *  4. Microsoft redirects back to backend /callback, which stores tokens
 *     and redirects to /sharepoint?connected=true
 *  5. On ?connected=true we reload status and show the file browser
 *  6. File browser: drives → folders → files, with "Import" on .xlsx/.xls/.csv
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'https://splendid-wholeness-production.up.railway.app'

function fmt_size(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmt_date(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SharePoint() {
  const { token } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [status, setStatus]           = useState(null)   // null = loading
  const [drives, setDrives]           = useState([])
  const [selectedDrive, setSelDrive]  = useState(null)
  const [folderStack, setFolderStack] = useState([])     // [{id, name}]
  const [items, setItems]             = useState([])
  const [loadingDrives, setLoadingDrives] = useState(false)
  const [loadingFiles, setLoadingFiles]   = useState(false)
  const [importing, setImporting]     = useState(null)   // item id being imported
  const [connectBusy, setConnectBusy] = useState(false)
  const [tenantInput, setTenantInput] = useState('')     // optional tenant domain

  const authHeaders = { Authorization: `Bearer ${token}` }

  // ── Status check ────────────────────────────────────────────────────────────
  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/sharepoint/status`, { headers: authHeaders })
      const d = await r.json()
      setStatus(d)
      if (d.connected) loadDrives()
    } catch {
      setStatus({ connected: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    // Handle ?connected=true or ?error=... from OAuth callback redirect
    const connected = searchParams.get('connected')
    const error     = searchParams.get('error')
    if (connected === 'true') {
      toast.success('SharePoint connected successfully!')
      navigate('/sharepoint', { replace: true })
    } else if (error) {
      const msg = error === 'invalid_state' ? 'Connection failed: invalid state. Please try again.'
                : error === 'state_expired'  ? 'Connection timed out. Please try again.'
                : 'SharePoint connection failed. Please try again.'
      toast.error(msg)
      navigate('/sharepoint', { replace: true })
    }
    checkStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Connect ──────────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnectBusy(true)
    try {
      const params = new URLSearchParams()
      if (tenantInput.trim()) params.set('tenant', tenantInput.trim())
      const r = await fetch(`${API}/api/sharepoint/auth-url?${params}`, { headers: authHeaders })
      const d = await r.json()
      if (d.url) {
        window.location.href = d.url
      } else {
        toast.error(d.detail || 'Could not start OAuth flow')
        setConnectBusy(false)
      }
    } catch {
      toast.error('Failed to get auth URL')
      setConnectBusy(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect SharePoint? This will not delete any already-imported files.')) return
    await fetch(`${API}/api/sharepoint/disconnect`, { method: 'DELETE', headers: authHeaders })
    setStatus({ connected: false })
    setDrives([])
    setSelDrive(null)
    setFolderStack([])
    setItems([])
    toast('SharePoint disconnected')
  }

  // ── Drives ───────────────────────────────────────────────────────────────────
  const loadDrives = async () => {
    setLoadingDrives(true)
    try {
      const r = await fetch(`${API}/api/sharepoint/drives`, { headers: authHeaders })
      const d = await r.json()
      setDrives(d.drives || [])
    } catch {
      toast.error('Failed to load drives')
    } finally {
      setLoadingDrives(false)
    }
  }

  // ── File browser ─────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (driveId, folderId = null) => {
    setLoadingFiles(true)
    setItems([])
    try {
      const params = new URLSearchParams({ drive_id: driveId })
      if (folderId) params.set('folder_id', folderId)
      const r = await fetch(`${API}/api/sharepoint/files?${params}`, { headers: authHeaders })
      const d = await r.json()
      setItems(d.items || [])
    } catch {
      toast.error('Failed to list files')
    } finally {
      setLoadingFiles(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const selectDrive = (drive) => {
    setSelDrive(drive)
    setFolderStack([])
    loadFiles(drive.id)
  }

  const openFolder = (item) => {
    setFolderStack(prev => [...prev, { id: item.id, name: item.name }])
    loadFiles(selectedDrive.id, item.id)
  }

  const breadcrumbNav = (index) => {
    if (index === -1) {
      setFolderStack([])
      loadFiles(selectedDrive.id)
    } else {
      const newStack = folderStack.slice(0, index + 1)
      setFolderStack(newStack)
      loadFiles(selectedDrive.id, newStack[newStack.length - 1].id)
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────────
  const importFile = async (item) => {
    setImporting(item.id)
    try {
      const r = await fetch(`${API}/api/sharepoint/import`, {
        method:  'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          drive_id: selectedDrive.id,
          item_id:  item.id,
          filename: item.name,
        }),
      })
      const d = await r.json()
      if (r.ok) {
        toast.success(`✅ '${item.name}' imported — ${d.row_count?.toLocaleString() || 0} rows`)
      } else {
        toast.error(d.detail || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const accent = '#e91e8c'

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0078D4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
          📁
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary, #0c1446)' }}>
            SharePoint & OneDrive
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary, #6b7280)', fontSize: '0.9rem' }}>
            Connect your Microsoft account to import files directly — no manual uploading
          </p>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border, #e5e7eb)', margin: '20px 0' }} />

      {/* Loading */}
      {status === null && (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
          Checking connection…
        </div>
      )}

      {/* Not connected */}
      {status !== null && !status.connected && (
        <div style={{
          background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f0fe 100%)',
          borderRadius: 16, padding: '48px 40px', textAlign: 'center',
          border: '1px solid #c7d9f8', maxWidth: 520, margin: '0 auto',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🔗</div>
          <h2 style={{ margin: '0 0 8px', color: '#1a1a2e', fontSize: '1.3rem' }}>
            Connect SharePoint / OneDrive
          </h2>
          <p style={{ color: '#4b5563', margin: '0 0 28px', lineHeight: 1.6 }}>
            Sign in with your Microsoft account to browse and import Excel and CSV
            files directly from SharePoint sites and OneDrive — no manual downloading.
          </p>
          {/* Optional tenant input */}
          <div style={{ width: '100%', marginBottom: 20, textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 6 }}>
              Organisation tenant domain
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>(optional — for enterprise accounts)</span>
            </label>
            <input
              type="text"
              value={tenantInput}
              onChange={e => setTenantInput(e.target.value)}
              placeholder="e.g. contoso.com or your-company.onmicrosoft.com"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: '0.88rem',
                outline: 'none', boxSizing: 'border-box',
                background: tenantInput ? '#f0f7ff' : '#fff',
              }}
            />
            <p style={{ margin: '5px 0 0', fontSize: '0.76rem', color: '#9ca3af' }}>
              Leave blank for personal Microsoft accounts or if you're unsure.
              Enter your domain to scope sign-in to your company's Azure AD only.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <button
              onClick={handleConnect}
              disabled={connectBusy}
              style={{
                background: '#0078D4', color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px 32px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: connectBusy ? 0.6 : 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 23 23" fill="none">
                <rect x="1"  y="1"  width="10" height="10" fill="#F35325"/>
                <rect x="12" y="1"  width="10" height="10" fill="#81BC06"/>
                <rect x="1"  y="12" width="10" height="10" fill="#05A6F0"/>
                <rect x="12" y="12" width="10" height="10" fill="#FFBA08"/>
              </svg>
              {connectBusy ? 'Redirecting to Microsoft…' : 'Connect with Microsoft'}
            </button>
            <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: 0 }}>
              You'll be redirected to Microsoft to sign in. We never store your password.
            </p>
          </div>

          {/* What we ask for */}
          <div style={{ marginTop: 28, textAlign: 'left', background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 10 }}>
              PERMISSIONS REQUESTED
            </div>
            {[
              ['📂', 'Read files from your OneDrive'],
              ['🏢', 'Read files from SharePoint sites you have access to'],
              ['🔄', 'Offline access to refresh the connection automatically'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '0.85rem', color: '#4b5563' }}>
                <span>{icon}</span> {text}
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#9ca3af' }}>
              We only read files. We never write to your SharePoint or delete anything.
            </div>
          </div>
        </div>
      )}

      {/* Connected */}
      {status !== null && status.connected && (
        <div>
          {/* Connected banner */}
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12,
            padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.4rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.95rem' }}>
                  Connected to Microsoft
                </div>
                {status.email && (
                  <div style={{ color: '#15803d', fontSize: '0.82rem' }}>
                    {status.display_name ? `${status.display_name} · ` : ''}{status.email}
                  </div>
                )}
                {status.tenant && (
                  <div style={{ color: '#166534', fontSize: '0.76rem', marginTop: 2 }}>
                    🏢 Tenant-scoped: <strong>{status.tenant}</strong>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              style={{
                background: 'none', border: '1px solid #fca5a5', color: '#dc2626',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              }}
            >
              Disconnect
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
            {/* Drive list */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', marginBottom: 10 }}>
                DRIVES & SITES
              </div>
              {loadingDrives ? (
                <div style={{ color: '#9ca3af', fontSize: '0.85rem', padding: '12px 0' }}>Loading drives…</div>
              ) : drives.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '0.85rem', padding: '12px 0' }}>No drives found</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {drives.map(drive => (
                    <button
                      key={drive.id}
                      onClick={() => selectDrive(drive)}
                      style={{
                        background: selectedDrive?.id === drive.id ? 'rgba(0,120,212,0.12)' : 'transparent',
                        border: selectedDrive?.id === drive.id ? '1px solid rgba(0,120,212,0.3)' : '1px solid transparent',
                        borderRadius: 8, padding: '9px 12px', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                      }}
                    >
                      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>
                        {drive.type === 'onedrive' ? '☁️' : '🏢'}
                      </span>
                      <span style={{
                        fontSize: '0.83rem', fontWeight: selectedDrive?.id === drive.id ? 700 : 400,
                        color: selectedDrive?.id === drive.id ? '#0078D4' : 'var(--text-primary, #374151)',
                        wordBreak: 'break-word', lineHeight: 1.4,
                      }}>
                        {drive.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* File browser pane */}
            <div>
              {!selectedDrive ? (
                <div style={{
                  height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', color: '#9ca3af',
                  border: '2px dashed #e5e7eb', borderRadius: 12,
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👈</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Select a drive</div>
                  <div style={{ fontSize: '0.85rem' }}>Choose a drive or SharePoint site on the left</div>
                </div>
              ) : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  {/* Breadcrumb */}
                  <div style={{
                    padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: '0.83rem',
                  }}>
                    <button
                      onClick={() => { setFolderStack([]); loadFiles(selectedDrive.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0078D4', fontWeight: 600, padding: '0 2px' }}
                    >
                      {selectedDrive.name}
                    </button>
                    {folderStack.map((f, i) => (
                      <React.Fragment key={f.id}>
                        <span style={{ color: '#9ca3af' }}>›</span>
                        <button
                          onClick={() => breadcrumbNav(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === folderStack.length - 1 ? '#374151' : '#0078D4', fontWeight: i === folderStack.length - 1 ? 700 : 400, padding: '0 2px' }}
                        >
                          {f.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* File list */}
                  {loadingFiles ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                      <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>⏳</div>
                      Loading files…
                    </div>
                  ) : items.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                      <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📭</div>
                      This folder is empty
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          {['Name', 'Modified', 'Size', ''].map(h => (
                            <th key={h} style={{
                              padding: '10px 16px', textAlign: 'left', fontSize: '0.78rem',
                              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr
                            key={item.id}
                            style={{
                              borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                              background: 'white',
                            }}
                          >
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1.1rem' }}>
                                  {item.type === 'folder' ? '📁'
                                   : item.extension === '.xlsx' || item.extension === '.xls' ? '📊'
                                   : item.extension === '.csv' ? '📋' : '📄'}
                                </span>
                                {item.type === 'folder' ? (
                                  <button
                                    onClick={() => openFolder(item)}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: '#0078D4', fontWeight: 600, fontSize: '0.9rem', padding: 0, textAlign: 'left',
                                    }}
                                  >
                                    {item.name}
                                  </button>
                                ) : (
                                  <span style={{
                                    fontSize: '0.9rem',
                                    color: item.importable ? 'var(--text-primary, #111827)' : '#9ca3af',
                                  }}>
                                    {item.name}
                                    {!item.importable && (
                                      <span style={{ fontSize: '0.72rem', marginLeft: 6, color: '#d1d5db' }}>
                                        not supported
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: '0.83rem' }}>
                              {fmt_date(item.modified)}
                            </td>
                            <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: '0.83rem' }}>
                              {item.type === 'file' ? fmt_size(item.size) : '—'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              {item.type === 'file' && item.importable && (
                                <button
                                  onClick={() => importFile(item)}
                                  disabled={importing === item.id}
                                  style={{
                                    background: accent, color: '#fff', border: 'none', borderRadius: 7,
                                    padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                    opacity: importing === item.id ? 0.6 : 1,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {importing === item.id ? 'Importing…' : '⬇ Import'}
                                </button>
                              )}
                              {item.type === 'folder' && (
                                <button
                                  onClick={() => openFolder(item)}
                                  style={{
                                    background: 'none', border: '1px solid #e5e7eb', borderRadius: 7,
                                    padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                    color: '#374151',
                                  }}
                                >
                                  Open →
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Helper tip */}
              {selectedDrive && !loadingFiles && (
                <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>💡</span>
                  Only .xlsx, .xls, and .csv files can be imported. Imported files appear in
                  <a href="/files" style={{ color: accent, marginLeft: 4 }}>My Files</a>.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
