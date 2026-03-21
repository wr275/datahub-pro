import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analyticsApi } from '../api'

export default function Analytics() {
  const { fileId } = useParams()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!fileId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [sumRes, kpiRes] = await Promise.all([
          analyticsApi.summary(fileId),
          analyticsApi.kpis(fileId)
        ])
        setSummary(sumRes.data)
        setKpis(kpiRes.data)
      } catch (e) {
        setError('Failed to load analytics. The file may no longer be available.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fileId])

  if (!fileId) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>[chart]</div>
        <h2 style={{ color: '#0c1446', fontWeight: 800, marginBottom: 8 }}>No file selected</h2>
        <p style={{ color: '#8b92b3', marginBottom: 24 }}>Go to your files and click "Analyse" to get started.</p>
        <button onClick={() => navigate('/files')} style={{ background: '#e91e8c', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
          Go to Files ->
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>[loading]</div>
          <div style={{ fontWeight: 600, color: '#0c1446' }}>Analysing your data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>[!]</div>
        <h2 style={{ color: '#0c1446', fontWeight: 800, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ color: '#8b92b3', marginBottom: 24 }}>{error}</p>
        <button onClick={() => navigate('/files')} style={{ background: '#e91e8c', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
          Back to Files
        </button>
      </div>
    )
  }

  if (!summary) return null

  const numericCols = Object.entries(summary.summary).filter(([, v]) => v.type === 'numeric')
  const textCols = Object.entries(summary.summary).filter(([, v]) => v.type === 'text')

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/files')} style={{ background: 'none', border: '1px solid #e2e4f0', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', color: '#8b92b3', fontSize: '0.9rem' }}><- Back</button>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1446', margin: 0 }}>{summary.filename}</h1>
          <p style={{ color: '#8b92b3', margin: 0, fontSize: '0.85rem' }}>{summary.rows.toLocaleString()} rows · {summary.columns} columns</p>
        </div>
      </div>

      {kpis.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Key Metrics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
            {kpis.map(k => (
              <div key={k.column} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(12,20,70,0.07)', border: '1px solid #f0f1f8' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8b92b3', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k.column}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0c1446', marginBottom: 4 }}>
                  {k.sum >= 1000 ? k.sum.toLocaleString() : k.sum}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#8b92b3' }}>
                  Avg: {k.mean} · Min: {k.min} · Max: {k.max}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {numericCols.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Numeric Columns</h2>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f1f8', overflow: 'hidden', marginBottom: 28 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8f9fe' }}>
                  {['Column', 'Count', 'Sum', 'Mean', 'Min', 'Max'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#0c1446', borderBottom: '1px solid #f0f1f8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {numericCols.map(([col, v]) => (
                  <tr key={col} style={{ borderBottom: '1px solid #f8f9fe' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0c1446' }}>{col}</td>
                    <td style={{ padding: '10px 16px', color: '#555' }}>{v.count.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: '#555' }}>{v.sum.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: '#555' }}>{v.mean}</td>
                    <td style={{ padding: '10px 16px', color: '#555' }}>{v.min}</td>
                    <td style={{ padding: '10px 16px', color: '#555' }}>{v.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {textCols.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Text Columns</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {textCols.map(([col, v]) => (
              <div key={col} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(12,20,70,0.07)', border: '1px solid #f0f1f8' }}>
                <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 4 }}>{col}</div>
                <div style={{ fontSize: '0.8rem', color: '#8b92b3', marginBottom: 8 }}>{v.count} entries · {v.unique} unique</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {v.top_values.slice(0, 8).map(val => (
                    <span key={val} style={{ background: '#f0f1f8', borderRadius: 4, padding: '2px 8px', fontSize: '0.78rem', color: '#444' }}>{val}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}