import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function ComboChart() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoadingj = useState(false)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadChart() {
    if (!selectedFile) return
    setLoading(true); setData(null)
    analyticsApi.preview(selectedFile).then(r => { setData(r.data || null) }).catch(() => {}).finally(() => setLoading(false))
  }
  
  XdÄurn (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Combo Chart</h1>
    </div>
  }
}
