import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

const COLORS = ['#e91e8c', '#0097b2', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

export default function ValueFrequency() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [col, setCol] = useState('')
  const [chartType, setChartType] = useState('bar')
  const [topN, setTopN] = useState(20)
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function run() {
    if (!col || !rows.length) return
    const freq = {}
    rows.forEach(r => {
      const v = String(r[col] ?? '(blank)')
      freq[v] = (freq[v] || 0) + 1
    })
    const data = Object.entries(freq)
      .map(([value, count]) => ({ value, count, pct: parseFloat((count / rows.length * 100).toFixed(1)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
    setResult({ data, total: rows.length, unique: Object.keys(freq).length })
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Value Frequency</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Count occurrences of each unique value in any column</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
          {[
            ['File', <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Choose --</option>{files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select>],
            ['Column', <select value={col} onChange={e => setCol(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="">-- Column --</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>],
            ['Chart Type', <select value={chartType} onChange={e => setChartType(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value="bar">Bar Chart</option><option value="pie">Pie Chart</option></select>],
            ['Top N', <select value={topN} onChange={e => setTopN(parseInt(e.target.value))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}><option value={10}>Top 10</option><option value={20}>Top 20</option><option value={50}>Top 50</option></select>]
          ].map(([label, el]) => <div key={label}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</div>{el}</div>)}
        </div>
        <button onClick={run} disabled={!col} style={{ padding: '9px 24px', background: col ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: col ? 'pointer' : 'default' }}>Analyse Frequency</button>
      </div>

      {result && (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[['Total Rows', result.total, '#0c1446'], ['Unique Values', result.unique, '#0097b2'], ['Top Value', result.data[0]?.value, '#e91e8c'], ['Top %', result.data[0]?.pct + '%', '#10b981']].map(([k, v, c]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `3px solid ${c}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{k}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16 }}>Frequency Distribution</div>
              {chartType === 'bar' ? (
                <ResponsiveContainer width="100%" height={Math.min(result.data.length * 32 + 60, 400)}>
                  <BarChart data={result.data} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="value" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v, n, p) => [v + ' (' + p.payload.pct + '%)', 'Count']} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {result.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={result.data.slice(0, 10)} dataKey="count" nameKey="value" cx="50%" cy="50%" outerRadius={120} label={({ value, pct }) => `${value} (${pct}%)`} labelLine fontSize={11}>
                      {result.data.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => v + ' rows'} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowY: 'auto', maxHeight: 450 }}>
              <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Frequency Table</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead><tr style={{ background: '#f9fafb' }}>{['Value', 'Count', '%'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {result.data.map((row, i) => (
                    <tr key={row.value} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '7px 10px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.value}>{row.value}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0c1446' }}>{row.count}</td>
                      <td style={{ padding: '7px 10px', color: '#6b7280' }}>{row.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div><div>Select a column to see its value frequency distribution</div></div>}
    </div>
  )
}
