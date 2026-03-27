import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { filesApi } from '../api'
import toast from 'react-hot-toast'

export default function Files() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
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
      loadFiles()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault(); setDragOver(true)
  }, [])

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
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a2342', margin: 0 }}>📁 My Files</h1>
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
          marginBottom: 28,
          transition: 'all 0.2s'
        }}
      >
        <input
          id="fileInputHidden"
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        {uploading ? (
          <div>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div style={{ color: '#4f8ef7', fontWeight: 600 }}>Uploading…</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
            <div style={{ color: '#1e2a5e', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              Drop a file here or click to browse
            </div>
            <div style={{ color: '#7a8ab5', fontSize: 13 }}>
              Supports .csv, .xlsx, .xls
            </div>
          </div>
        )}
      </div>

      {/* Files table */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#7a8ab5', padding: 40 }}>Loading files…</div>
      ) : files.length === 0 ? (
        <div style={{
          textAlign: 'center', color: '#7a8ab5', padding: '48px 24px',
          background: '#fff', borderRadius: 14, border: '1px solid #eaecf5'
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, color: '#1e2a5e', marginBottom: 6 }}>No files yet</div>
          <div style={{ fontSize: 13 }}>Upload your first file to get started</div>
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #eaecf5',
          overflow: 'hidden', boxShadow: '0 2px 8px rgba(30,42,94,0.06)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f4f6fb' }}>
                {headers.map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    color: '#4a5280', fontWeight: 600, fontSize: 13,
                    borderBottom: '1px solid #eaecf5'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                  <td style={{ padding: '12px 16px', color: '#1a2342', fontWeight: 500, fontSize: 14 }}>
                    📄 {f.filename || f.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4a5280', fontSize: 14 }}>
                    {f.row_count != null ? f.row_count.toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4a5280', fontSize: 14 }}>
                    {f.column_count ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4a5280', fontSize: 13 }}>
                    {f.uploaded_at || f.created_at
                      ? new Date(f.uploaded_at || f.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => navigate(`/analytics/${f.id}`)}
                        style={{
                          background: '#4f8ef7', color: '#fff', border: 'none',
                          borderRadius: 7, padding: '5px 12px', fontSize: 12,
                          fontWeight: 600, cursor: 'pointer'
                        }}
                      >Analyze</button>
                      <button
                        onClick={() => deleteFile(f.id)}
                        style={{
                          background: '#fff', color: '#f87171', border: '1px solid #fca5a5',
                          borderRadius: 7, padding: '5px 12px', fontSize: 12,
                          fontWeight: 600, cursor: 'pointer'
                        }}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
