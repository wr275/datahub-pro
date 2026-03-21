import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function PeriodComparison() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [dateCol, setDateCol] = useState('')
  const [valCol, setValCol] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!dateCol || !valCol || !rows.length) return
    const byMonth = {}
    rows.forEach(r => {
      const raw = r[dateCol] || ''
      let key = raw
      const d = new Date(raw)
      if (!isNaN(d.getTime())) {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      } else if (raw.length >= 7) {
        key = raw.slice(0, 7)
      }
      const v = parseFloat(r[valCol]) || 0
      if (!byMonth[key]) byMonth[key] = { sum: 0, count: 0 }
      byMonth[key].sum += v; byMonth[key].count++
    })
    const periods = Object.keys(byMonth).sort()
    const data = periods.map(p => ({
      period: p,
      total: parseFloat(byMonth[p].sum.toFixed(2)),
      avg: parseFloat((byMonth[p].sum / byMonth[p].count).toFixed(2)),
      count: byMonth[p].count
    }))
    const growth = data.map((d, i) => {
      const prev = i > 0 ? data[i - 1].total : null
      const pct = prev != null && prev !== 0 ? ((d.total - prev) / Math.abs(prev) * 100).toFixed(1) : null
      return { ...d, growth: pct !== null ? parseFloat(pct) : null }
    })
    setResult({ data: growth, best: [...growth].sort((a, b) => b.total - a.total)[0], worst: [...growth].sort((a, b) => a.total - b.total)[0] })
  }

  const numericCols = headers.filter(h => rows.length && !isNaN(parseFloat(rows[0]?.[h])))

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Period Comparison</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Compare performance across time periods with growth analysis</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Date Column', <select value={dateCol} onChange={e => setDateCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Value', <select value={valCol} onChange={e => setValCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Numeric --</option>{numericCols.map(h => <option key={h} value={h}>{h}</option>)}</select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={run} disabled={!dateCol || !valCol} style={{ padding: '9px 24px', background: dateCol && valCol ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: dateCol && valCol ? 'pointer' : 'default' }}>Compare Periods</button>
      </div>

      {result && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[['Best Period', result.best?.period, result.best?.total?.toLocaleString(), '#10b981'],
              ['Worst Period', result.worst?.period, result.worst?.total?.toLocaleString(), '#ef4444']
            ].map(([label, period, val, c]) => (
              <div key={label} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 700, color: '#0c1446' }}>{period}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Period Totals</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={result.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#0097b2" radius={[4, 4, 0, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Period-by-Period Data</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead><tr style={{ background: '#f9fafb' }}>{['Period', 'Total', 'Average', 'Count', 'Growth %'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {result.data.map((row, i) => (
                    <tr key={row.period} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600, color: '#0c1446' }}>{row.period}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{row.total?.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{row.avg?.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', color: '#374151' }}>{row.count}</td>
                      <td style={{ padding: '9px 14px', color: row.growth == null ? '#9ca3af' : row.growth >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                        {row.growth == null ? '—' : `${row.growth >= 0 ? '+' : ''}${row.growth}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📅</div><div>Select date and value columns to compare periods</div></div>}
    </div>
  )
}
