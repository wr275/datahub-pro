import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function CorrelationMatrix() {
  const [files, setFiles] = useState([])
  
  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch() }, [])

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Correlation Matrix</h1>
    </div>
  }
}
