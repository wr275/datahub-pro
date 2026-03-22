import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function AnomalyDetection() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [sensitivity, setSensitivity] = useState(2.5)
  const [method, setMethod] = useState('zscore')
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function detect() {
    if (!selectedFile) return
    setLoading(true); setAnomalies([])
    analyticsApi.anomalies(selectedFile, { method, threshold: sensitivity }).then(r => {
      const anomalyList = r && r.data && r.data.anomalies ? r.data.anomalies : []
      setAnomalies(anomalyList)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Anomaly Detection</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Dataset</div>
            <select value={selectedFile} onChange={e => setSelectedFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Method</div>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="zscore">Z-Score</option>
              <option value="iqr">IQR (Tukey)</option>
              <option value="locaout">Local Outlier</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Sensitivity: {sensitivity.toFixed(1)}</div>
            <input type="range" min="1" max="4" step="0.1" value={sensitivity} onChange={e => setSensitivity(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
        <button onClick={detect} disabled={!selectedFile || loading} style={{ padding: '9px 24px', background: selectedFile && !loading ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: selectedFile && !loading ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
          {loading ? '✨ Detecting...' : 'Run Detection'}
        </button>
      </div>

      {anomalies.length > 0 && (
        <div style={{ background: 'fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16, fontSize: '1rem' }}>Detected Anomalies ({anomalies.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {anomalies.map((a, i) => (
              <div key={i} style={{ background: '#fef2f2', borderLeft: '4px solid #e91e8c', padding: 16, borderRadius: 8 }}>
                <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 8 }}>Row {i + 1}</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                  Score: <span style={{ color: '#e91e8c', fontWeight: 700 }}>{Math.abs(a.score || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 16 }}>Anomalies detected using {method.toUpperCase()} method with threshold of {sensitivity.toFixed(1)} mes</div>
        </div>
     )}
    </div>
  }
}
