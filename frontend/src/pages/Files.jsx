import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi, sheetsApi } from '../api'
import toast from 'react-hot-toast'

export default function Files() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(null)
  const [showSheetPanel, setShowSheetPanel] = useState(false)
  const navigate = useNavigate()

  const loadFiles = () => {
    filesApi.list().then(res => {
      setFiles(res.data || [])
    }).catch(() => {
      toast.error('Failed to load files')
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadFiles() }, [])

  const uploadFile = async (file) => {
    // Snapshot the pre-upload file count. If this upload takes the user from
    // zero to one file, we redirect them to a populated Executive Dashboard
    // so the first thing they see after ingesting data is a live view of it,
    // not a file list. Subsequent uploads stay on this page (power-user
    // workflow — bulk uploading shouldn't keep yanking you away).
    const wasEmpty = files.length === 0
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const uploadRes = await filesApi.upload(formData)
      const uploaded = uploadRes?.data
      if (uploaded && uploaded.id) {
        try {
          localStorage.setItem('ai_pending_file', JSON.stringify({
            id: uploaded.id,
            name: uploaded.filename || file.name,
            rows: uploaded.row_count || 0,
            cols: uploaded.column_count || 0,
            cols_list: uploaded.columns || []
          }))
        } catch (_) {}
      }
      toast.success(file.name + ' uploaded successfully!')
      if (wasEmpty && uploaded?.id) {
        navigate(`/executive-dashboard?fileId=${uploaded.id}&first_run=true`)
        return
      }
      loadFiles()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const connectSheet = async () => {
    if (!sheetUrl.trim()) return toast.error('Please enter a Google Sheets URL')
    setConnecting(true)
    try {
      await sheetsApi.connect(sheetUrl.trim(), sheetName.trim())
      toast.success('Google Sheet connected!')
      setSheetUrl('')
      setSheetName('')
      setShowSheetPanel(false)
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
      toast.success('Sheet synced!')
      loadFiles()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [])

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true) }, [])
  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) uploadFile(file)
    e.target.value = ''
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

  const headers = ['Filename', 'Rows', 'Columns', 'Uploaded', 'Actions']

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a2342', margin: 0 }}>My Files</h1>
        <p style={{ color: '#6b7db5', marginTop: 6, fontSize: 14 }}>
          Upload CSV or Excel files to analyze with AI
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById('fileInputHidden').click()}
        style={{
          border: `2px dashed ${dragOver ? '#4f8ef7' : '#c5cde8'}`,
          borderRadius: 14,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#eef4ff' : '#f8f9ff',
          marginBottom: 16,
          transition: 'all 0.2s'
        }}
      >
        <input id="fileInputHidden" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileSelect} />
        {uploading ? (
          <div>
            <div style={{ fontSize: 32, marginBottom: 10 }}>hourglass</div>
            <div style={{ color: '#4f8ef7', fontWeight: 600 }}>Uploading</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 10 }}>folder</div>
            <div style={{ color: '#1e2a5e', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              Drop a file here or click to browse
            </div>
            <div style={{ color: '#7a8ab5', fontSize: 13 }}>Supports .csv, .xlsx, .xls</div>
          </div>
        )}
      </div>

      {/* Google Sheets connector */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => setShowSheetPanel(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1.5px solid #c5cde8',
            borderRadius: 10, padding: '9px 16px',
            fontSize: 14, fontWeight: 600, color: '#1e2a5e',
            cursor: 'pointer'
          }}
        >
          Connect Google Sheet {showSheetPanel ? 'collapse' : 'expand'}
        </button>

        {showSheetPanel && (
          <div style={{ marginTop: 10, background: '#f8f9ff', border: '1.5px solid #c5cde8', borderRadius: 12, padding: '20px 24px' }}>
            <p style={{ margin: '0 0 14px', color: '#4a5280', fontSize: 13 }}>
              Share your Google Sheet with Anyone with the link can view, then paste the URL below.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                style={{
                  flex: 2, minWidth: 280, padding: '8px 12px',
                  border: '1.5px solid #c5cde8', borderRadius: 8,
                  fontSize: 13, color: '#1e2a5e', background: '#fff', outline: 'none'
                }}
              />
              <input
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                placeholder="Display name (optional)"
                style={{
                  flex: 1, minWidth: 160, padding: '8px 12px',
                  border: '1.5px solid #c5cde8', borderRadius: 8,
                  fontSize: 13, color: '#1e2a5e', background: '#fff', outline: 'none'
                }}
              />
              <button
                onClick={connectSheet}
                disabled={connecting}
                style={{
                  background: '#4f8ef7', color: '#fff', border: 'none',
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
        <div style={{ textAlign: 'center', color: '#7a8ab5', padding: 40 }}>Loading files</div>
      ) : files.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#7a8ab5', padding: '48px 24px', background: '#fff', borderRadius: 14, border: '1px solid #eaecf5' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>clipboard</div>
          <div style={{ fontWeight: 600, color: '#1e2a5e', marginBottom: 6 }}>No files yet</div>
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
                    <td style={{ padding: '12px 16px', color: '#1a2342', fontWeight: 500, fontSize: 14 }}>
                      {isSheet ? '[sheet]' : '[file]'} {f.filename || f.name}
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
                    <td style={{ padding: '12px 16px', color: '#4a5280', fontSize: 13 }}>
                      {f.uploaded_at || f.created_at ? new Date(f.uploaded_at || f.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => navigate('/analytics/' + f.id)} style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Analyze</button>
                        {isSheet && (
                          <button
                            onClick={() => syncSheet(f.id)}
                            disabled={syncing === f.id}
                            style={{ background: '#fff', color: '#4f8ef7', border: '1px solid #93c5fd', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: syncing === f.id ? 'not-allowed' : 'pointer', opacity: syncing === f.id ? 0.7 : 1 }}
                          >
                            {syncing === f.id ? '...' : 'Sync'}
                          </button>
                        )}
                        <button onClick={() => deleteFile(f.id)} style={{ background: '#fff', color: '#f87171', border: '1px solid #fca5a5', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
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
