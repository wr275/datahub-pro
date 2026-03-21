import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#e91e8c','#0c1446','#0097b2','#10b981','#f59e0b','#6366f1','#ef4444','#8b5cf6','#14b8a6','#f97316']

const fmt = (n) => {
  if (n === null || n === undefined) return '-'
  const num = Number(n)
  if (isNaN(num)) return String(n)
  if (Math.abs(num) >= 1000000) return (num/1000000).toFixed(1) + 'M'
  if (Math.abs(num) >= 1000) return (num/1000).toFixed(1) + 'K'
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const TabBtn = ({ id, active, onClick, label }) => (
  <button onClick={() => onClick(id)} style={{
    padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer',
    fontWeight: active ? 700 : 400, color: active ? '#e91e8c' : '#4a5280',
    borderBottom: active ? '3px solid #e91e8c' : '3px solid transparent',
    marginBottom: -2, fontSize: '0.9rem', transition: 'all 0.15s'
  }}>{label}</button>
)

export default function Analytics() {
  const { fileId } = useParams()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [kpis, setKpis] = useState([])
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (!fileId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [sumRes, kpiRes, previewRes] = await Promise.all([
          analyticsApi.summary(fileId),
          analyticsApi.kpis(fileId),
          analyticsApi.preview(fileId)
        ])
        setSummary(sumRes.data)
        setKpis(kpiRes.data)
        setPreview(previewRes.data)
      } catch (e) {
        setError('Failed to load analytics. The file may no longer be available.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fileId])

  if (!fileId) return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>[ chart ]</div>
      <h2 style={{ color: '#0c1446', fontWeight: 800, marginBottom: 8 }}>No file selected</h2>
      <p style={{ color: '#8b92b3', marginBottom: 24 }}>Go to My Files and click Analyse to get started.</p>
      <button onClick={() => navigate('/files')} style={{ background: '#e91e8c', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>Go to Files</button>
    </div>
  )

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <p style={{ color: '#8b92b3', fontSize: '1.1rem' }}>Analysing your data...</p>
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>[ ! ]</div>
      <h2 style={{ color: '#0c1446', fontWeight: 800, marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: '#8b92b3', marginBottom: 24 }}>{error}</p>
      <button onClick={() => navigate('/files')} style={{ background: '#e91e8c', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>Back to Files</button>
    </div>
  )

  if (!summary) return null

  const numericCols = Object.entries(summary.summary || {}).filter(([,v]) => v.type === 'numeric')
  const textCols = Object.entries(summary.summary || {}).filter(([,v]) => v.type === 'text')
  const barData = kpis.map(k => ({ name: k.column.length > 14 ? k.column.slice(0,14)+'...' : k.column, Mean: k.mean, Max: k.max, Min: k.min }))

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/files')} style={{ background: 'none', border: '1px solid #e2e5f1', color: '#4a5280', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', marginBottom: 14 }}>
          Back to Files
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446', marginBottom: 4 }}>{summary.filename}</h1>
        <p style={{ color: '#8b92b3', fontSize: '0.88rem' }}>{summary.rows} rows - {summary.columns} columns - {numericCols.length} numeric, {textCols.length} text</p>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '2px solid #e2e5f1' }}>
        <TabBtn id="overview" active={tab==='overview'} onClick={setTab} label="Overview" />
        <TabBtn id="charts" active={tab==='charts'} onClick={setTab} label="Charts" />
        <TabBtn id="preview" active={tab==='preview'} onClick={setTab} label="Data Preview" />
      </div>

      {tab === 'overview' && (
        <div>
          {kpis.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16, fontSize: '1rem' }}>Key Metrics</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {kpis.map((k, i) => (
                  <div key={k.column} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e5f1', borderTop: '3px solid ' + COLORS[i % COLORS.length] }}>
                    <div style={{ fontSize: '0.7rem', color: '#8b92b3', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{k.column}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1446', lineHeight: 1.1 }}>{fmt(k.sum)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#8b92b3', marginTop: 6 }}>Avg: {fmt(k.mean)} | Min: {fmt(k.min)} | Max: {fmt(k.max)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {numericCols.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16, fontSize: '1rem' }}>Numeric Column Stats</h2>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e5f1', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fc' }}>
                      {['Column','Count','Sum','Mean','Min','Max'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#4a5280', fontWeight: 600, fontSize: '0.78rem', borderBottom: '1px solid #e2e5f1' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {numericCols.map(([col, s], i) => (
                      <tr key={col} style={{ borderTop: '1px solid #f0f2f8', background: i%2===0?'#fff':'#fafbff' }}>
                        <td style={{ padding: '11px 16px', fontWeight: 600, color: '#0c1446' }}>{col}</td>
                        <td style={{ padding: '11px 16px', color: '#4a5280' }}>{fmt(s.count)}</td>
                        <td style={{ padding: '11px 16px', color: '#4a5280' }}>{fmt(s.sum)}</td>
                        <td style={{ padding: '11px 16px', color: '#4a5280' }}>{fmt(s.mean)}</td>
                        <td style={{ padding: '11px 16px', color: '#4a5280' }}>{fmt(s.min)}</td>
                        <td style={{ padding: '11px 16px', color: '#4a5280' }}>{fmt(s.max)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {textCols.length > 0 && (
            <div>
              <h2 style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16, fontSize: '1rem' }}>Text Columns</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {textCols.map(([col, s]) => (
                  <div key={col} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e5f1' }}>
                    <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 4 }}>{col}</div>
                    <div style={{ fontSize: '0.78rem', color: '#8b92b3', marginBottom: 10 }}>{s.count} values - {s.unique} unique</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(s.top_values||[]).slice(0,8).map(v => (
                        <span key={v} style={{ background: '#f0f2f8', color: '#4a5280', padding: '3px 10px', borderRadius: 20, fontSize: '0.73rem' }}>{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'charts' && (
        <div>
          {barData.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontWeight: 700, color: '#0c1446', marginBottom: 6, fontSize: '1rem' }}>Average Values per Column</h2>
              <p style={{ color: '#8b92b3', fontSize: '0.82rem', marginBottom: 16 }}>Mean value for each numeric column</p>
              <div style={{ background: '#fff', borderRadius: 12, padding: '24px 8px 8px', border: '1px solid #e2e5f1' }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={barData} margin={{ top: 5, right: 24, left: 16, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8b92b3' }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: '#8b92b3' }} tickFormatter={v => fmt(v)} width={60} />
                    <Tooltip formatter={(v, n) => [fmt(v), n]} />
                    <Bar dataKey="Mean" fill="#e91e8c" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {barData.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontWeight: 700, color: '#0c1446', marginBottom: 6, fontSize: '1rem' }}>Min vs Max Range</h2>
              <p style={{ color: '#8b92b3', fontSize: '0.82rem', marginBottom: 16 }}>Value range spread per numeric column</p>
              <div style={{ background: '#fff', borderRadius: 12, padding: '24px 8px 8px', border: '1px solid #e2e5f1' }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={barData} margin={{ top: 5, right: 24, left: 16, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8b92b3' }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: '#8b92b3' }} tickFormatter={v => fmt(v)} width={60} />
                    <Tooltip formatter={(v, n) => [fmt(v), n]} />
                    <Bar dataKey="Min" fill="#0097b2" radius={[4,4,0,0]} />
                    <Bar dataKey="Max" fill="#0c1446" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {textCols.length > 0 && (
            <div>
              <h2 style={{ fontWeight: 700, color: '#0c1446', marginBottom: 6, fontSize: '1rem' }}>Category Breakdown</h2>
              <p style={{ color: '#8b92b3', fontSize: '0.82rem', marginBottom: 16 }}>Top values distribution in text columns</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                {textCols.slice(0,4).map(([col, s]) => {
                  const pieData = (s.top_values||[]).slice(0,7).map(v => ({ name: v.length > 16 ? v.slice(0,16)+'...' : v, value: 1 }))
                  if (pieData.length < 2) return null
                  return (
                    <div key={col} style={{ background: '#fff', borderRadius: 12, padding: '20px', border: '1px solid #e2e5f1' }}>
                      <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 4 }}>{col}</div>
                      <div style={{ fontSize: '0.78rem', color: '#8b92b3', marginBottom: 12 }}>{s.unique} unique values</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name }) => name} labelLine={true} fontSize={10}>
                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {barData.length === 0 && textCols.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#8b92b3' }}>No chart data available for this file.</div>
          )}
        </div>
      )}

      {tab === 'preview' && preview && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, color: '#0c1446', fontSize: '1rem' }}>Data Preview</h2>
            <span style={{ fontSize: '0.8rem', color: '#8b92b3', background: '#f0f2f8', padding: '4px 12px', borderRadius: 20 }}>Showing {preview.rows.length} of {preview.total_rows} rows</span>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e5f1', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 500 }}>
              <thead>
                <tr style={{ background: '#f8f9fc' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#4a5280', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #e2e5f1', whiteSpace: 'nowrap' }}>#</th>
                  {(preview.headers||[]).map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#4a5280', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid #e2e5f1', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(preview.rows||[]).map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f0f2f8', background: i%2===0?'#fff':'#fafbff' }}>
                    <td style={{ padding: '8px 14px', color: '#c0c4d8', fontSize: '0.75rem' }}>{i+1}</td>
                    {(preview.headers||[]).map(h => (
                      <td key={h} style={{ padding: '8px 14px', color: '#4a5280', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}