import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function AINarrative() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [narrativeType, setNarrativeType] = useState('executive')
  const [loading, setLoading] = useState(false)
  const [narrative, setNarrative] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setNarrative(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function generate() {
    if (!fileId || !rows.length) return
    setLoading(true); setNarrative(null)
    analyticsApi.summary(fileId).then(r => {
      const raw = r.data; const summary = raw.summary || {}
      const numericCols = Object.entries(summary).filter(([, v]) => v.type === 'numeric')
      const textCols = Object.entries(summary).filter(([, v]) => v.type !== 'numeric')
      const totalRows = raw.rows || 0; const totalCols = raw.columns || 0

      let text = ''

      if (narrativeType === 'executive') {
        text = `Executive Summary — ${raw.filename}\n\nThis analysis examines a dataset comprising ${totalRows.toLocaleString()} records across ${totalCols} data dimensions, including ${numericCols.length} quantitative metrics and ${textCols.length} categorical attributes.\n\n`
        if (numericCols.length > 0) {
          const [topCol, topStats] = numericCols[0]
          text += `The primary quantitative measure, ${topCol}, shows a mean value of ${(topStats.mean || 0).toFixed(2)}, ranging from ${(topStats.min || 0).toFixed(2)} to ${(topStats.max || 0).toFixed(2)}. `
          if (numericCols.length > 1) {
            text += `Additional key metrics include ${numericCols.slice(1, 3).map(([k, v]) => `${k} (avg: ${(v.mean || 0).toFixed(2)})`).join(' and ')}. `
          }
        }
        const missingCount = Object.values(summary).reduce((a, v) => a + (totalRows - (v.count || 0)), 0)
        text += `\nData quality assessment indicates ${missingCount === 0 ? 'excellent completeness with no missing values detected' : `${missingCount} missing data points requiring attention before further analysis`}.\n\n`
        text += `Key Findings:\n• Dataset contains ${totalRows.toLocaleString()} observations suitable for statistical analysis\n`
        numericCols.slice(0, 3).forEach(([col, stats]) => {
          text += `• ${col}: avg ${(stats.mean || 0).toFixed(2)}, range ${((stats.max || 0) - (stats.min || 0)).toFixed(2)}\n`
        })
        text += `\nThis data provides a solid foundation for further analysis and decision-making.`
      } else if (narrativeType === 'technical') {
        text = `Technical Analysis Report — ${raw.filename}\n\n`
        text += `Dataset Characteristics:\n- Observations: ${totalRows.toLocaleString()}\n- Variables: ${totalCols} (${numericCols.length} continuous, ${textCols.length} categorical)\n\n`
        text += `Continuous Variable Statistics:\n`
        numericCols.forEach(([col, stats]) => {
          text += `${col}: n=${stats.count || 0}, μ=${(stats.mean || 0).toFixed(4)}, min=${(stats.min || 0).toFixed(4)}, max=${(stats.max || 0).toFixed(4)}\n`
        })
        text += `\nCategorical Variables:\n`
        textCols.forEach(([col, stats]) => {
          text += `${col}: n=${stats.count || 0}, top="${stats.top || ''}" (${stats.freq || 0} occurrences)\n`
        })
        text += `\nMissing Data Summary:\n`
        Object.entries(summary).forEach(([col, stats]) => {
          const missing = totalRows - (stats.count || 0)
          if (missing > 0) text += `${col}: ${missing} missing (${(missing / totalRows * 100).toFixed(1)}%)\n`
        })
        if (!Object.entries(summary).some(([, v]) => (totalRows - (v.count || 0)) > 0)) text += 'No missing values detected.\n'
      } else {
        text = `Data Story — ${raw.filename}\n\nWelcome to the story of this dataset. Behind the numbers, there's a narrative worth exploring.\n\n`
        text += `We're working with a collection of ${totalRows.toLocaleString()} data points — each one a snapshot of real-world activity. Across ${totalCols} dimensions, patterns begin to emerge.\n\n`
        if (numericCols.length > 0) {
          const [col, stats] = numericCols[0]
          text += `Take ${col}, for instance. On average, it sits at ${(stats.mean || 0).toFixed(2)} — but the story gets interesting when you see its range: from a low of ${(stats.min || 0).toFixed(2)} all the way up to ${(stats.max || 0).toFixed(2)}. That's the kind of variation that tells you something is happening beneath the surface.\n\n`
        }
        if (textCols.length > 0) {
          const [col, stats] = textCols[0]
          text += `Among the categories, ${col} stands out. The most common value is "${stats.top || 'unknown'}", appearing ${stats.freq || 0} times. What does that tell us? Perhaps a dominant segment, or a common pattern that deserves closer attention.\n\n`
        }
        text += `Every dataset has a story. This one is yours to explore.`
      }

      setNarrative(text)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>AI Narrative</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Auto-generate written narratives about your data in different styles</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Dataset</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Narrative Style</div>
            <select value={narrativeType} onChange={e => setNarrativeType(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="executive">Executive Summary</option>
              <option value="technical">Technical Analysis</option>
              <option value="story">Data Story</option>
            </select>
          </div>
          <button onClick={generate} disabled={!fileId || loading} style={{ padding: '9px 24px', background: fileId && !loading ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId && !loading ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
            {loading ? '✨ Generating...' : '✨ Generate'}
          </button>
        </div>
      </div>

      {narrative && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#0c1446', fontSize: '1rem' }}>Generated Narrative</div>
            <button onClick={() => navigator.clipboard?.writeText(narrative)} style={{ padding: '6px 14px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}>Copy Text</button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#374151', fontSize: '0.95rem' }}>{narrative}</div>
        </div>
      )}

      {!narrative && !loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>✍️</div><div>Select a dataset and narrative style to generate written analysis</div></div>}
    </div>
  )
}
