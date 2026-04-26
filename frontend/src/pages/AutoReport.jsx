import React, { useState, useEffect } from 'react'
import { filesApi, aiApi } from '../api'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonChart, SkeletonCard } from '../components/ui/Skeleton'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function AutoReport() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')   // '' | 'docx' | 'pptx'
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
  }, [])

  async function generate() {
    if (!fileId) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await aiApi.report(fileId)
      setResult(r.data || r)
    } catch (e) {
      const d = e?.response?.data?.detail
      if (d?.code === 'ai_disabled') setError('AI is not enabled on this workspace.')
      else setError(typeof d === 'string' ? d : (e.message || 'Report generation failed'))
    } finally {
      setLoading(false)
    }
  }

  async function exportReport(format) {
    if (!result?.report || !fileId) return
    setExporting(format); setError('')
    try {
      const r = await aiApi.reportExport({ file_id: fileId, format, report: result.report })
      const blob = new Blob([r.data], {
        type: format === 'pptx'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const file = files.find(f => f.id === fileId)
      const base = (file?.filename || 'report').replace(/\.[^.]+$/, '')
      downloadBlob(blob, `${base}_report.${format}`)
    } catch (e) {
      setError('Export failed: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setExporting('')
    }
  }

  const report = result?.report
  const pack = result?.stat_pack

  return (
    <div style={{ padding: 28, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0c1446' }}>Auto Report</h1>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg,#e91e8c,#0097b2)', padding: '3px 8px',
          borderRadius: 6, letterSpacing: 0.5,
        }}>LLM · DOCX · PPTX</span>
      </div>
      <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: '0.9rem' }}>
        A client-ready analytical report with executive summary, narrative sections, quality notes and recommendations —
        exportable as Word or PowerPoint.
      </p>

      <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
              Dataset
            </label>
            <select value={fileId} onChange={e => setFileId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value=''>-- Choose a file --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <button onClick={generate} disabled={!fileId || loading}
            style={{
              padding: '10px 22px',
              background: (!fileId || loading) ? '#d1d5db' : 'linear-gradient(135deg,#e91e8c,#c4166e)',
              color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
              cursor: (!fileId || loading) ? 'not-allowed' : 'pointer',
            }}>
            {loading ? 'Writing…' : 'Generate report'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {loading && (
        <div>
          <div style={{ marginBottom: 14, color: '#6b7280', fontSize: '0.88rem', fontWeight: 600 }}>
            Computing statistics &amp; writing report — takes 10-30 seconds depending on dataset size…
          </div>
          <SkeletonCard /><div style={{ height: 12 }} />
          <SkeletonChart height={220} /><div style={{ height: 12 }} />
          <SkeletonCard />
        </div>
      )}

      {report && pack && (
        <>
          {/* Export bar */}
          <div style={{
            position: 'sticky', top: 10, zIndex: 10,
            background: 'linear-gradient(135deg,#0c1446,#0097b2)',
            borderRadius: 12, padding: '14px 18px', marginBottom: 18,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            color: '#fff', boxShadow: '0 4px 20px rgba(12,20,70,0.35)',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', opacity: 0.75, letterSpacing: 0.5, textTransform: 'uppercase' }}>Report ready</div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{pack.filename}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => exportReport('docx')} disabled={!!exporting}
                style={exportBtn('#fff', '#0c1446', !!exporting)}>
                {exporting === 'docx' ? '…' : '⬇  DOCX'}
              </button>
              <button onClick={() => exportReport('pptx')} disabled={!!exporting}
                style={exportBtn('#e91e8c', '#fff', !!exporting)}>
                {exporting === 'pptx' ? '…' : '⬇  PPTX'}
              </button>
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0c1446', margin: '0 0 6px' }}>
              {report.title}
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {pack.row_count?.toLocaleString?.() ?? pack.row_count} rows · {pack.column_count} columns · generated {new Date().toLocaleString()}
            </div>
          </div>

          {/* Executive summary */}
          <Section heading='Executive summary' color='#e91e8c'>
            <p style={bodyStyle}>{report.executive_summary}</p>
            <div style={{ marginTop: 8 }}>
              <OpenInAskYourData
                fileId={fileId}
                prompt={`Drill into this finding: ${report.executive_summary?.slice(0, 240) || ''}`}
              />
            </div>
          </Section>

          {/* Sections */}
          {(report.sections || []).map((s, i) => (
            <Section key={i} heading={s.heading} color='#0c1446'>
              {s.narrative && <p style={bodyStyle}>{s.narrative}</p>}
              {s.bullets?.length > 0 && (
                <ul style={{ paddingLeft: 22, margin: '8px 0 0' }}>
                  {s.bullets.map((b, j) => (
                    <li key={j} style={{ margin: '4px 0', color: '#374151', fontSize: '0.9rem', lineHeight: 1.55 }}>{b}</li>
                  ))}
                </ul>
              )}
            </Section>
          ))}

          {/* Data quality */}
          {report.data_quality_notes?.length > 0 && (
            <Section heading='Data quality notes' color='#0097b2'>
              <ul style={{ paddingLeft: 22, margin: 0 }}>
                {report.data_quality_notes.map((n, i) => (
                  <li key={i} style={{ margin: '4px 0', color: '#374151', fontSize: '0.9rem', lineHeight: 1.55 }}>{n}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Recommendations */}
          {report.recommendations?.length > 0 && (
            <Section heading='Recommended next steps' color='#e91e8c'>
              <ol style={{ paddingLeft: 22, margin: 0 }}>
                {report.recommendations.map((r, i) => (
                  <li key={i} style={{ margin: '6px 0', color: '#374151', fontSize: '0.9rem', lineHeight: 1.55 }}>{r}</li>
                ))}
              </ol>
            </Section>
          )}

          {report.raw && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem', fontWeight: 700 }}>
                Model returned unparsable output — view raw
              </summary>
              <pre style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8,
                fontSize: '0.78rem', overflow: 'auto', maxHeight: 300, marginTop: 8 }}>{report.raw}</pre>
            </details>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <EmptyState
          icon="📋"
          title="Generate a polished agency-ready report"
          body="Pick a file and click Generate report. The model writes an executive summary, key findings, data-quality notes, and recommended next steps. Export as DOCX or PPTX from the bar above."
          tone="info"
        />
      )}
    </div>
  )
}

function Section({ heading, color, children }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12,
      padding: '18px 22px', marginBottom: 16, borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontWeight: 800, fontSize: '1.05rem', color, marginBottom: 8 }}>
        {heading}
      </div>
      {children}
    </div>
  )
}

const bodyStyle = { color: '#374151', fontSize: '0.9rem', lineHeight: 1.65, margin: 0 }

function exportBtn(bg, fg, disabled) {
  return {
    padding: '8px 16px',
    background: disabled ? '#d1d5db' : bg,
    color: disabled ? '#6b7280' : fg,
    border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem',
    cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: 0.3,
  }
}
