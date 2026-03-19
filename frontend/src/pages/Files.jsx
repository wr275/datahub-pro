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
    filesApi.list().then(res => setFiles(res.data)).catch(() => toast.error('Failed to load files')).finally(() => setLoading(false))
  }

  useEffect(() => { loadFiles() }, [])

  const uploadFile = async (file) => {
    const allowed = ['.xlsx', '.xls', '.csv']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowed.includes(ext)) { toast.error('Only .xlsx, .xls, and .csv files are supported'); return }
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await filesApi.upload(formData)
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

  const handleDelete = async (id, name) => {
    if (!window.confirm('Delete ' + name + '? This cannot be undone.')) return
    try {
      await filesApi.delete(id)
      toast.success('File deleted')
      setFiles(files.filter(f => f.id !== id))
    } catch { toast.error('Delete failed') }
  }

  const formatSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    return (bytes / 1024).toFixed(0) + ' KB'
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446' }}>My Files</h1>
        <p style={{ color: '#4a5280', marginTop: 4 }}>Upload and manage your Excel and CSV data files</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileInputHidden').click()}
        style={{
          border: '2px dashed ' + (dragOver ? '#e91e8c' : '#e2e5f1'),
          borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
          background: dragOver ? '#fce4f1' : '#fff', marginBottom: 24,
          transition: 'all 0.2s'
        }}
      >
        <input id="fileInputHidden" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]) }} />
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📤</div>
        <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 6 }}>{uploading ? 'Uploading...' : 'Drop your file here or click to browse'}</div>
        <div style={{ color: '#8b92b3', fontSize: '0.85rem' }}>Supports .xlsx, .xls, .csv — up to 50MB</div>
      </div>

      {/* File list */}
      <div className="card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e5f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0c1446' }}>Uploaded Files ({files.length})</h2>
        </div>
        {loading ? <p style={{ padding: 24, color: '#8b92b3' }}>Loading...</p> :
          files.length === 0 ? <p style={{ padding: 40, textAlign: 'center', color: '#8b92b3' }}>No files uploaded yet</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e5f1' }}>
                  {['File Name', 'Rows', 'Columns', 'Size', 'Uploaded', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#4a5280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #e2e5f1' }}>
                    <td style={{ padding: '12px 16px', color: '#0c1446', fontWeight: 500 }}>📄 {f.filename}</td>
                    <td style={{ padding: '12px 16px', color: '#4a5280' }}>{f.rows?.toLocaleString() || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#4a5280' }}>{f.columns || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#4a5280' }}>{formatSize(f.size)}</td>
                    <td style={{ padding: '12px 16px', color: '#4a5280' }}>{new Date(f.uploaded_at).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => navigate('/analytics/' + f.id)} style={{ background: '#e91e8c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Analyse</button>
                        <button onClick={() => handleDelete(f.id, f.filename)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}
