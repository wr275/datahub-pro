/**
 * Google Sheets Integration Page (Google Sheets 2.0)
 *
 * Flow:
 *  1. On mount → /sheets/oauth/status
 *     - If not configured (no GOOGLE_CLIENT_ID env var) → show "Admin setup required"
 *     - If not connected → show "Connect Google" button
 *     - If connected → show Drive browser + scheduled-sync list
 *  2. "Connect" → /sheets/oauth/auth-url → window.location = url
 *  3. Google redirects to backend /callback, which stores tokens and
 *     redirects back here with ?connected=true (or ?error=...)
 *  4. Drive browser: search sheets → pick tab → import
 *  5. Per-imported-file: toggle hourly / daily / off auto-sync
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { sheetsApi } from '../api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const ACCENT = '#34a853'  // Google-green
const INK = '#0c1446'

export default function GoogleSheets() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [status, setStatus] = useState(null)    // null = loading
  const [sheets, setSheets] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingSheets, setLoadingSheets] = useState(false)
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [tabs, setTabs] = useState([])
  const [loadingTabs, setLoadingTabs] = useState(false)
  const [selectedTab, setSelectedTab] = useState(null)
  const [importing, setImporting] = useState(false)
  const [scheduled, setScheduled] = useState([])
  const [connectBusy, setConnectBusy] = useState(false)

  // ── Status ──────────────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const { data } = await sheetsApi.status()
      setStatus(data)
      if (data.connected) {
        loadSheets('')
        loadScheduled()
      }
    } catch {
      setStatus({ connected: false, configured: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Handle OAuth callback redirect params
    const connected = searchParams.get('connected')
    const err = searchParams.get('error')
    if (connected === 'true') {
      toast.success('Google Sheets connected!')
      navigate('/google-sheets', { replace: true })
    } else if (err) {
      const msg =
        err === 'invalid_state' ? 'Connection failed: invalid state. Please try again.' :
        err === 'state_expired' ? 'Connection timed out. Please try again.' :
        err === 'token_failed'  ? 'Could not exchange Google token. Please try again.' :
        err === 'access_denied' ? 'You denied access to Google. Please allow the requested permissions.' :
        'Google Sheets connection failed.'
      toast.error(msg)
      navigate('/google-sheets', { replace: true })
    }
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Connect / disconnect ────────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnectBusy(true)
    try {
      const { data } = await sheetsApi.authUrl()
      if (data.url) window.location.href = data.url
      else toast.error('Could not start OAuth flow')
    } catch (e) {
      if (e.response?.status === 501) {
        toast.error('Admin needs to configure Google OAuth credentials first.')
      } else {
        toast.error('Failed to get auth URL')
      }
    } finally {
      setConnectBusy(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Sheets? Imported files stay but will no longer auto-sync.')) return
    try {
      await sheetsApi.disconnect()
      setStatus({ connected: false, configured: status?.configured })
      setSheets([])
      setSelectedSheet(null)
      setTabs([])
      setScheduled([])
      toast('Google Sheets disconnected')
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  // ── Drive browser ───────────────────────────────────────────────────────────
  const loadSheets = async (q) => {
    setLoadingSheets(true)
    try {
      const { data } = await sheetsApi.listSheets(q)
      setSheets(data.items || [])
    } catch {
      toast.error('Failed to load sheets')
    } finally {
      setLoadingSheets(false)
    }
  }

  const openSheet = async (sheet) => {
    setSelectedSheet(sheet)
    setTabs([])
    setSelectedTab(null)
    setLoadingTabs(true)
    try {
      const { data } = await sheetsApi.sheetTabs(sheet.id)
      setTabs(data.tabs || [])
      if (data.tabs && data.tabs.length === 1) setSelectedTab(data.tabs[0])
    } catch {
      toast.error('Failed to load tabs')
    } finally {
      setLoadingTabs(false)
    }
  }

  const handleImport = async () => {
    if (!selectedSheet || !selectedTab) return
    setImporting(true)
    try {
      const { data } = await sheetsApi.connectPrivate({
        spreadsheet_id: selectedSheet.id,
        tab_title: selectedTab.title,
      })
      toast.success(`✅ Imported '${data.filename}' — ${data.rows?.toLocaleString() || 0} rows`)
      setSelectedSheet(null)
      setTabs([])
      setSelectedTab(null)
      loadScheduled()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Scheduled sync list ─────────────────────────────────────────────────────
  const loadScheduled = async () => {
    try {
      const { data } = await sheetsApi.scheduledSyncs()
      setScheduled(data.items || [])
    } catch {
      /* non-fatal */
    }
  }

  const setFreq = async (fileId, frequency) => {
    try {
      await sheetsApi.setSyncSchedule(fileId, frequency)
      toast.success(frequency === 'off' ? 'Auto-sync disabled' : `Auto-sync: ${frequency}`)
      loadScheduled()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not update schedule')
    }
  }

  const manualSync = async (fileId) => {
    try {
      const { data } = await sheetsApi.sync(fileId)
      toast.success(data.message || 'Synced')
      loadScheduled()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Sync failed')
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${ACCENT}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
          📊
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: `var(--text-primary, ${INK})` }}>
            Google Sheets
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary, #6b7280)', fontSize: '0.9rem' }}>
            Connect your Google account to import private sheets and schedule automatic updates
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

      {/* Not configured on this deployment */}
      {status !== null && status.configured === false && !status.connected && (
        <div style={{
          background: '#fffbeb', borderRadius: 12, padding: '20px 24px',
          border: '1px solid #fde68a', maxWidth: 640, margin: '0 auto',
        }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
            ⚠️ Admin setup required
          </div>
          <div style={{ color: '#78350f', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 12 }}>
            Google Sheets OAuth isn't configured on this deployment yet. An admin needs to:
          </div>
          <ol style={{ color: '#78350f', fontSize: '0.86rem', lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
            <li>Create a Google Cloud project at <code>console.cloud.google.com</code></li>
            <li>Enable <strong>Google Sheets API</strong> and <strong>Google Drive API</strong></li>
            <li>Create an OAuth 2.0 Client ID (Web application)</li>
            <li>Add <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and <code>GOOGLE_REDIRECT_URI</code> to Railway env vars</li>
          </ol>
        </div>
      )}

      {/* Not connected — Google connect card */}
      {status !== null && status.configured !== false && !status.connected && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          borderRadius: 16, padding: '48px 40px', textAlign: 'center',
          border: '1px solid #bbf7d0', maxWidth: 520, margin: '0 auto',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>📊</div>
          <h2 style={{ margin: '0 0 8px', color: INK, fontSize: '1.3rem' }}>
            Connect Google Sheets
          </h2>
          <p style={{ color: '#4b5563', margin: '0 0 28px', lineHeight: 1.6 }}>
            Sign in with Google to browse private spreadsheets, import them as datasets,
            and (optionally) schedule automatic hourly or daily updates.
          </p>
          <button
            onClick={handleConnect}
            disabled={connectBusy}
            style={{
              background: ACCENT, color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 32px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              opacity: connectBusy ? 0.6 : 1,
            }}
          >
            {connectBusy ? 'Redirecting to Google…' : 'Sign in with Google'}
          </button>

          {/* What we ask for */}
          <div style={{ marginTop: 28, textAlign: 'left', background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 10 }}>
              PERMISSIONS REQUESTED
            </div>
            {[
              ['📖', 'Read-only access to your Google Sheets'],
              ['🗂️', 'Read-only access to your Drive (to browse and search for sheets)'],
              ['🔄', 'Offline access to refresh the connection automatically'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '0.85rem', color: '#4b5563' }}>
                <span>{icon}</span> {text}
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#9ca3af' }}>
              We never write to your sheets and never share your data.
            </div>
          </div>
        </div>
      )}

      {/* Connected — full UI */}
      {status !== null && status.connected && (
        <>
          {/* Connected banner */}
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12,
            padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.4rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.95rem' }}>
                  Connected to Google
                </div>
                {status.email && (
                  <div style={{ color: '#15803d', fontSize: '0.82rem' }}>{status.email}</div>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* ─── Drive browser column ─── */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', marginBottom: 10 }}>
                IMPORT A SHEET
              </div>

              {/* Search */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadSheets(searchQuery)}
                  placeholder="Search your sheets by name…"
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                    fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => loadSheets(searchQuery)}
                  style={{
                    padding: '9px 14px', background: INK, color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Search
                </button>
              </div>

              {/* Sheet list */}
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: 12,
                maxHeight: 380, overflowY: 'auto', background: '#fff',
              }}>
                {loadingSheets ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>Loading…</div>
                ) : sheets.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>No sheets found</div>
                ) : (
                  sheets.map(s => (
                    <button
                      key={s.id}
                      onClick={() => openSheet(s)}
                      style={{
                        width: '100%', display: 'block', textAlign: 'left',
                        padding: '10px 14px',
                        background: selectedSheet?.id === s.id ? '#ecfdf5' : '#fff',
                        border: 'none', borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: INK, fontSize: '0.88rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.76rem', color: '#9ca3af', marginTop: 2 }}>
                        {s.owner ? `${s.owner} · ` : ''}Modified {fmtDate(s.modified)}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Tab picker + import */}
              {selectedSheet && (
                <div style={{
                  marginTop: 14, padding: 14, background: '#f9fafb',
                  borderRadius: 10, border: '1px solid #e5e7eb',
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700 }}>{selectedSheet.name}</span>
                  </div>
                  {loadingTabs ? (
                    <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Loading tabs…</div>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 6 }}>Pick a tab</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {tabs.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTab(t)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, fontSize: '0.78rem',
                              background: selectedTab?.id === t.id ? ACCENT : '#fff',
                              color: selectedTab?.id === t.id ? '#fff' : '#374151',
                              border: selectedTab?.id === t.id ? 'none' : '1px solid #d1d5db',
                              cursor: 'pointer', fontWeight: 600,
                            }}
                          >
                            {t.title}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleImport}
                        disabled={!selectedTab || importing}
                        style={{
                          width: '100%', padding: '9px', background: ACCENT, color: '#fff',
                          border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
                          cursor: selectedTab && !importing ? 'pointer' : 'not-allowed',
                          opacity: selectedTab && !importing ? 1 : 0.5,
                        }}
                      >
                        {importing ? 'Importing…' : '⬇ Import into DataHub'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ─── Scheduled sync column ─── */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280', marginBottom: 10 }}>
                CONNECTED SHEETS · AUTO-SYNC
              </div>

              {scheduled.length === 0 ? (
                <div style={{
                  border: '2px dashed #e5e7eb', borderRadius: 12, padding: 40,
                  textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem',
                }}>
                  No connected sheets yet.<br />
                  Import a sheet on the left to set up auto-sync.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {scheduled.map(s => (
                    <div key={s.file_id} style={{
                      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                      padding: 14,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: INK, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.filename}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#9ca3af', marginTop: 2 }}>
                            {s.mode === 'oauth' ? '🔒 Private' : '🌐 Public'} · Last sync {fmtDateTime(s.last_synced_at)}
                          </div>
                          {s.last_sync_error && (
                            <div style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: 4 }}>
                              ⚠ {s.last_sync_error.slice(0, 120)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => manualSync(s.file_id)}
                          style={{
                            padding: '4px 10px', background: '#f3f4f6', color: '#374151',
                            border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.75rem',
                            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          Sync now
                        </button>
                      </div>
                      {/* Frequency chips — OAuth-mode only */}
                      {s.mode === 'oauth' ? (
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          {['off', 'hourly', 'daily'].map(f => (
                            <button
                              key={f}
                              onClick={() => setFreq(s.file_id, f)}
                              style={{
                                flex: 1, padding: '5px', borderRadius: 6, fontSize: '0.74rem',
                                background: s.frequency === f ? ACCENT : '#fff',
                                color: s.frequency === f ? '#fff' : '#6b7280',
                                border: s.frequency === f ? 'none' : '1px solid #d1d5db',
                                cursor: 'pointer', fontWeight: 600,
                              }}
                            >
                              {f === 'off' ? 'Off' : f === 'hourly' ? 'Hourly' : 'Daily 06:00 UTC'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#9ca3af' }}>
                          Public sheets only support manual sync.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
