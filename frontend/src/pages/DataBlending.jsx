import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function DataBlending() {
  const [files, setFiles] = useState([])
  const [file1, setFile1] = useState('')
  const [file2, setFile2] = useState('')
  const [headers1, setHeaders1] = useState([])
  const [headers2, setHeaders2] = useState([])
  const [rows1, setRows1] = useState([])
  const [rows2, setRows2] = useState([])
  const [joinKey1, setJoinKey1] = useState('')
  const [joinKey2, setJoinKey2] = useState('')
  const [joinType, setJoinType] = useState('inner')
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile1(id) {
    setFile1(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders1(r.data.headers || []); setRows1(r.data.rows || []) }).catch(() => {})
  }
  function loadFile2(id) {
    setFile2(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders2(r.data.headers || []); setRows2(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!joinKey1 || !joinKey2 || !rows1.length || !rows2.length) return
    const map2 = {}
    rows2.forEach(r => {
      const key = String(r[joinKey2] ?? '')
      if (!map2[key]) map2[key] = []
      map2[key].push(r)
    })
    const extra2 = headers2.filter(h => h !== joinKey2).map(h => `[B] ${h}`)
    const allHeaders = [...headers1, ...extra2]
    const blended = []
    rows1.forEach(r => {
      const key = String(r[joinKey1] ?? '')
      const matches = map2[key] || []
      if (matches.length === 0) {
        if (joinType === 'left' || joinType === 'full') {
          const row = { ...r }
          extra2.forEach(h => { row[h] = null })
          blended.push(row)
        }
      } else {
        matches.forEach(m => {
          const row = { ...r }
          headers2.filter(h => h !== joinKey2).forEach(h => { row[`[B] ${h}`] = m[h] })
          blended.push(row)
        })
      }
    })
    if (joinType === 'full') {
      const keys1 = new Set(rows1.map(r => String(r[joinKey1] ?? '')))
      rows2.forEach(r => {
        const key = String(r[joinKey2] ?? '')
        if (!keys1.has(key)) {
          const row = {}
          headers1.forEach(h => { row[h] = null })
          row[joinKey1] = key
          headers2.filter(h => h !== joinKey2).forEach(h => { row[`[B] ${h}`] = r[h] })
          blended.push(row)
        }
      })
    }
    setResult({ rows: blended.slice(0, 200), headers: allHeaders, total: blended.length })
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Data Blending</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Join two datasets on a common key — inner, left, or full outer join</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, color: '#0c1446', marginBottom: 10 }}>Dataset A</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File A</div>
              <select value={file1} onChange={e => loadFile1(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
                <option value="">-- Choose --</option>
                {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Join Key (A)</div>
              <select value={joinKey1} onChange={e => setJoinKey1(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
                <option value="">-- Column --</option>
                {headers1.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#0c1446', marginBottom: 10 }}>Dataset B</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File B</div>
              <select value={file2} onChange={e => loadFile2(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
                <option value="">-- Choose --</option>
                {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Join Key (B)</div>
              <select value={joinKey2} onChange={e => setJoinKey2(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
                <option value="">-- Column --</option>
                {headers2.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Join Type</div>
            <select value={joinType} onChange={e => setJoinType(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="inner">Inner Join (matching rows only)</option>
              <option value="left">Left Join (all of A + matches from B)</option>
              <option value="full">Full Outer Join (all rows)</option>
            </select>
          </div>
          <button onClick={run} disabled={!joinKey1 || !joinKey2} style={{ padding: '9px 24px', background: joinKey1 && joinKey2 ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: joinKey1 && joinKey2 ? 'pointer' : 'default' }}>Blend Data</button>
        </div>
      </div>

      {result && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#0c1446' }}>Blended Dataset — {result.headers.length} columns, {result.total} rows</span>
            {result.total > 200 && <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Showing first 200 rows</span>}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 450 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  {result.headers.slice(0, 15).map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: h.startsWith('[B]') ? '#0097b2' : '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {result.headers.slice(0, 15).map(h => (
                      <td key={h} style={{ padding: '7px 12px', color: '#374151', whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6' }}>{row[h] ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🔗</div><div>Select two files and join keys to blend your datasets</div></div>}
    </div>
  )
}
