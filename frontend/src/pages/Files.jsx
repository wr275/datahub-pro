import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi, sheetsApi } from '../api'
import toast from 'react-hot-toast'

// -----------------------------------------------------------------------------
// Files 2.0 — upload progress, duplicate detection, encoding warnings, preview
// -----------------------------------------------------------------------------

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

export default function Files() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadState, setUploadState] = useState(null)
  // uploadState shape: { phase: 'checking' | 'uploading' | 'parsing', progress, filename, size }
  const [dragOver, setDragOver] = useState(false)
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(null)
  const [showSheetPanel, setShowSheetPanel] = useState(false)
  const [postUpload, setPostUpload] = useState(null)   // { id, filename, rows, cols, warnings, previewRows }
  const [dupePrompt, setDupePrompt] = useState(null)   // { file (pending File), match (existing DataFile) }
  const navigate = useNavigate()

  const loadFiles = () => {
    filesApi.list().then(res => {
      setFiles(res.data || [])
    }).catch(() => {
      toast.error('Failed to load files')
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadFiles() }, [])

  // -------- Upload pipeline -------------------------------------------------

  async function startUpload(file) {
    setPostUpload(null)
    // 1) Check for duplicate (same filename + size in this org)
    setUploadState({ phase: 'checking', progress: 0, filename: file.name, size: file.size })
    try {
      const r = await filesApi.checkDuplicate(file.name, file.size)
      if (r.data?.match) {
        setUploadState(null)
        setDupePrompt({ file, match: r.data.match })
        return
      }
    } catch (_) {
      // Non-fatal — fall through to upload
    }
    await doUpload(file)
  }

  async function doUpload(file) {
    const wasEmpty = files.length === 0
    setUploadState({ phase: 'uploading', progress: 0, filename: file.name, size: file.size })
    const formData = new FormData()
    formData.append('file', file)
    try {
      const uploadRes = await filesApi.upload(formData, (pct) => {
        setUploadState(s => s ? {
          ...s,
          phase: pct >= 100 ? 'parsing' : 'uploading',
          progress: pct,
        } : s)
      })
      const uploaded = uploadRes?.data
      if (uploaded && uploaded.id) {
        try {
          localStorage.setItem('ai_pending_file', JSON.stringify({
            id: uploaded.id,
            name: uploaded.filename || file.name,
            rows: uploaded.rows || 0,
            cols: uploaded.columns || 0,
            cols_list: uploaded.column_names || []
          }))
        } catch (_) {}
      }

      // Surface warnings + preview right on the page (no toast for warnings —
      // they can be multi-line and need explanation).
      const warnings = uploaded?.warnings || []
      const previewRows = uploaded?.preview_rows || []
      if (warnings.length === 0) {
        toast.success(file.name + ' uploaded')
      } else {
        toast(file.name + ' uploaded with ' + warnings.length + ' warning' + (warnings.length > 1 ? 's' : ''), { icon: '⚠️' })
      }

      setPostUpload({
        id: uploaded.id,
        filename: uploaded.filename || file.name,
        rows: uploaded.rows,
        cols: uploaded.columns,
        columnNames: uploaded.column_names || [],
        warnings,
        previewRows,
        wasEmpty,
      })
      loadFiles()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploadState(null)
    }
  }

  // -------- Drag / click handlers -------------------------------------------

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) startUpload(file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length])

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true) }, [])
  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) startUpload(file)
    e.target.value = ''
  }

  // -------- Sheet + delete helpers ------------------------------------------

  const connectSheet = async () => {
    if (!sheetUrl.trim()) return toast.error('Please enter a Google Sheets URL')
    setConnecting(true)
    try {
      await sheetsApi.connect(sheetUrl.trim(), sheetName.trim())
      toast.success('Google Sheet connected')
      setSheetUrl(''); setSheetName(''); setShowSheetPanel(false)
      loadFiles()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to connect sheet')
    } finally {
      setConnecting(false)
    }
  }

  const syncSheet = async (fileId) => {
    setSyncing(fileId)
    try {
      await sheetsApi.sync(fileId)
      toast.success('Sheet synced')
      loadFiles()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  const deleteFile = async (id) => {
    try {
      await filesApi.delete(id)
      toast.success('File deleted')
      loadFiles()
    } catch (err) {
      toast.error('Delete failed')
    }
  }

  // -------- UI components ---------------------------------------------------

  const headers = ['Filename', 'Rows', 'Columns', 'Size', 'Uploaded', 'Actions']

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0c1446', margin: 0 }}>My Files</h1>
        <p style={{ color: '#6b7280', marginTop: 6, fontSize: 14 }}>
          Upload CSV or Excel files to analyse — we'll preview and flag anything unusual.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploadState && document.getElementById('fileInputHidden').click()}
        style={{
          border: `2px dashed ${dragOver ? '#e91e8c' : '#c5cde8'}`,
          borderRadius: 14,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: uploadState ? 'default' : 'pointer',
          background: dragOver ? '#fdf2f8' : '#f8f9ff',
          marginBottom: 16,
          transition: 'all 0.15s'
        }}
      >
        <input id="fileInputHidden" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileSelect} />
        {uploadState ? <UploadIndicator state={uploadState} /> : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 10, color: '#0c1446' }}>⬆</div>
            <div style={{ color: '#0c1446', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              Drop a file here or click to browse
            </div>
            <div style={{ color: '#7a8ab5', fontSize: 13 }}>Supports .csv, .xlsx, .xls · up to 500MB</div>
          </div>
        )}
      </div>

      {/* Duplicate prompt */}
      {dupePrompt && (
        <DuplicateModal
          pending={dupePrompt.file}
          match={dupePrompt.match}
          onCancel={() => setDupePrompt(null)}
          onUseExisting={() => {
            const id = dupePrompt.match.id
            setDupePrompt(null)
            navigate('/analytics/' + id)
          }}
          onUploadAnyway={() => {
            const f = dupePrompt.file
            setDupePrompt(null)
            doUpload(f)
          }}
        />
      )}

      {/* Post-upload preview card */}
      {postUpload && (
        <PostUploadCard
          result={postUpload}
          onClose={() => setPostUpload(null)}
          onContinue={() => {
            const id = postUpload.id
            const wasEmpty = postUpload.wasEmpty
            setPostUpload(null)
            if (wasEmpty) {
              navigate(`/executive-dashboard?fileId=${id}&first_run=true`)
            } else {
              navigate('/analytics/' + id)
            }
          }}
        />
      )}

      {/* Google Sheets connector */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => setShowSheetPanel(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1.5px solid #c5cde8',
            borderRadius: 10, padding: '9px 16px',
            fontSize: 14, fontWeight: 600, color: '#0c1446',
            cursor: 'pointer'
          }}
        >
          {showSheetPanel ? '▾' : '▸'} Connect Google Sheet
        </button>

        {showSheetPanel && (
          <div style={{ marginTop: 10, background: '#f8f9ff', border: '1.5px solid #c5cde8', borderRadius: 12, padding: '20px 24px' }}>
            <p style={{ margin: '0 0 14px', color: '#4a5280', fontSize: 13 }}>
              Share your Google Sheet with "anyone with the link can view", then paste the URL below.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                style={{
                  flex: 2, minWidth: 280, padding: '8px 12px',
                  border: '1.5px solid #c5cde8', borderRadius: 8,
                  fontSize: 13, color: '#0c1446', background: '#fff', outline: 'none'
                }}
              />
              <input
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                placeholder="Display name (optional)"
                style={{
                  flex: 1, minWidth: 160, padding: '8px 12px',
                  border: '1.5px solid #c5cde8', borderRadius: 8,
                  fontSize: 13, color: '#0c1446', background: '#fff', outline: 'none'
                }}
              />
              <button
                onClick={connectSheet}
                disabled={connecting}
                style={{
                  background: '#e91e8c', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 20px', fontSize: 14,
                  fontWeight: 600, cursor: connecting ? 'not-allowed' : 'pointer',
                  opacity: connecting ? 0.7 : 1
                }}
              >
                {connecting ? 'Connecting' : 'Connect'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Files table */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#7a8ab5', padding: 40 }}>Loading files…</div>
      ) : files.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#7a8ab5', padding: '48px 24px', background: '#fff', borderRadius: 14, border: '1px solid #eaecf5' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>◎</div>
          <div style={{ fontWeight: 600, color: '#0c1446', marginBottom: 6 }}>No files yet</div>
          <div style={{ fontSize: 13 }}>Upload your first file to get started</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #eaecf5', overflow: 'hidden', boxShadow: '0 2px 8px rgba(30,42,94,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f4f6fb' }}>
                {headers.map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#4a5280', fontWeight: 600, fontSize: 13, borderBottom: '1px solid #eaecf5' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => {
                const isSheet = f.storage_type === 'google_sheets'
                return (
                  <tr key={f.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                    <td style={{ padding: '12px 16px', color: '#0c1446', fontWeight: 500, fontSize: 14 }}>
                      {isSheet ? '📊 ' : '📄 '} {f.filename || f.name}
                      {isSheet && f.last_synced_at && (
                        <span style={{ marginLeft: 8, color: '#7a8ab5', fontSize: 11, fontWeight: 400 }}>
                          synced {new Date(f.last_synced_at).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4a5280', fontSize: 14 }}>
                      {f.row_count != null ? f.row_count.toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4a5280', fontSize: 14 }}>
                      {f.column_count ?? '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4a5280', fontSize: 14 }}>
                      {humanSize(f.size)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4a5280', fontSize: 13 }}>
                      {f.uploaded_at || f.created_at ? new Date(f.uploaded_at || f.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => navigate('/analytics/' + f.id)}
                          style={{ background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Analyse
                        </button>
                        {isSheet && (
                          <button
                            onClick={() => syncSheet(f.id)}
                            disabled={syncing === f.id}
                            style={{ background: '#fff', color: '#0097b2', border: '1px solid #a7d8dc', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: syncing === f.id ? 'not-allowed' : 'pointer', opacity: syncing === f.id ? 0.7 : 1 }}
                          >
                            {syncing === f.id ? '…' : 'Sync'}
                          </button>
                        )}
                        <button onClick={() => deleteFile(f.id)} style={{ background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function UploadIndicator({ state }) {
  const pct = state.progress || 0
  const phaseLabel =
    state.phase === 'checking' ? 'Checking for duplicates…'
    : state.phase === 'parsing' ? 'Parsing file on server…'
    : `Uploading… ${pct}%`
  return (
    <div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0c1446', marginBottom: 4 }}>
        {state.filename}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 12 }}>
        {humanSize(state.size)} · {phaseLabel}
      </div>
      <div style={{
        width: '100%', maxWidth: 400, margin: '0 auto',
        height: 10, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden',
      }}>
        <div style={{
          width: (state.phase === 'uploading' ? pct : 100) + '%',
          height: '100%',
          background: 'linear-gradient(90deg,#e91e8c,#0097b2)',
          transition: 'width 0.2s',
          animation: state.phase !== 'uploading' ? 'pulse 1.3s ease-in-out infinite' : 'none',
        }} />
      </div>
    </div>
  )
}

function DuplicateModal({ pending, match, onCancel, onUseExisting, onUploadAnyway }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(12,20,70,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 520, maxWidth: '94vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0c1446', marginBottom: 8 }}>
          This file already exists
        </div>
        <div style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 14, lineHeight: 1.5 }}>
          A file called <strong>{match.filename}</strong> ({humanSize(match.size)}) was already uploaded on {new Date(match.uploaded_at).toLocaleDateString()}.
          {' '}Uploading again will create a duplicate.
        </div>
        <div style={{
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '10px 14px', fontSize: '0.82rem', color: '#4b5563', marginBottom: 18,
        }}>
          Existing: {match.row_count?.toLocaleString?.() ?? '—'} rows · {match.column_count ?? '—'} cols
          <br />
          New file: {humanSize(pending.size)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={btnGhost}>Cancel</button>
          <button onClick={onUploadAnyway} style={btnSecondary}>Upload anyway</button>
          <button onClick={onUseExisting} style={btnPrimary}>Use existing</button>
        </div>
      </div>
    </div>
  )
}

function PostUploadCard({ result, onClose, onContinue }) {
  const { filename, rows, cols, columnNames, warnings, previewRows } = result
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12,
      padding: 20, marginBottom: 20,
      boxShadow: '0 2px 14px rgba(12,20,70,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            ✓ Uploaded
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0c1446', marginTop: 2 }}>
            {filename}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 2 }}>
            {rows?.toLocaleString?.() ?? rows} rows · {cols} columns
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>Dismiss</button>
          <button onClick={onContinue} style={btnPrimary}>Open analysis →</button>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
          padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Parse warnings</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {warnings.map((w, i) => <li key={i} style={{ lineHeight: 1.5 }}>{w}</li>)}
          </ul>
        </div>
      )}

      {previewRows && previewRows.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                {(columnNames.length ? columnNames : Object.keys(previewRows[0] || {})).slice(0, 10).map(c => (
                  <th key={c} style={{ padding: '7px 10px', textAlign: 'left', color: '#4b5563', fontWeight: 700, borderBottom: '1px solid #e5e7eb' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                  {(columnNames.length ? columnNames : Object.keys(row)).slice(0, 10).map(c => (
                    <td key={c} style={{ padding: '7px 10px', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                      {row[c] == null || row[c] === '' ? '—' : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const btnPrimary = { padding: '8px 16px', background: 'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { padding: '8px 16px', background: '#fff', color: '#0c1446', border: '1px solid #0c1446', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhost = { padding: '8px 14px', background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
