import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function DataTable() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const PAGE_SIZE = 20

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  useEffect(() => {
    let r = rows
    if (search) r = r.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
    if (sortCol) r = [...r].sort((a, b) => {
      const av = a[sortCol] || '', bv = b[sortCol] || ''
      const an = parseFloat(av), bn = parseFloat(bv)
      if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    setFiltered(r)
    setPage(0)
  }, [rows, search, sortCol, sortDir])

  function load() {
    if (!fileId) return
    setLoading(true)
    analyticsApi.preview(fileId).then(r => {
      setHeaders(r.data.headers || [])
      setRows(r.data.rows || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  function sort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Data Table</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>View, sort, search and filter your raw data</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
          <select value={fileId} onChange={e => setFileId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
            <option value="">-- Choose a file --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={!fileId || loading} style={{ padding: '9px 24px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>
          {loading ? 'Loading...' : 'Load Data'}
        </button>
        {rows.length > 0 && <input placeholder="Search all columns..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', minWidth: 200 }} />}
      </div>

      {rows.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} rows</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: page > 0 ? 'pointer' : 'default', color: page > 0 ? '#374151' : '#d1d5db' }}>‹</button>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Page {page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: page < totalPages - 1 ? 'pointer' : 'default', color: page < totalPages - 1 ? '#374151' : '#d1d5db' }}>›</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {headers.map(h => (
                    <th key={h} onClick={() => sort(h)} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      {h} {sortCol === h ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {headers.map(h => <td key={h} style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[h] || ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!rows.length && !loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div><div>Select a file and click Load Data to view your data</div></div>}
    </div>
  )
}
