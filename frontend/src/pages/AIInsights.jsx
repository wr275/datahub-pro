import React, { useState, useEffect, useRef } from 'react'
import { filesApi, aiApi } from '../api'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard, SkeletonChart } from '../components/ui/Skeleton'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

// --- visual helpers ---------------------------------------------------------

const SEVERITY_STYLES = {
  alert: { border: '#dc2626', bg: '#fef2f2', dot: '#dc2626', label: 'ALERT' },
  warn:  { border: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b', label: 'WARN'  },
  info:  { border: '#0097b2', bg: '#effaf9', dot: '#0097b2', label: 'INFO'  },
}

const CATEGORY_ICON = {
  growth: '↗',
  concentration: '◐',
  trend: '∿',
  outlier: '★',
  segmentation: '▦',
  opportunity: '◎',
}

function SeverityBadge({ severity }) {
  const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px', borderRadius: 999,
      background: s.bg, color: s.dot,
      fontSize: '0.7rem', fontWeight: 800, letterSpacing: 0.4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  )
}

function FindingCard({ f, fileId }) {
  const s = SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.info
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8eaf4',
      borderLeft: `4px solid ${s.dot}`,
      borderRadius: 10,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem', color: s.dot }}>{CATEGORY_ICON[f.category] || '•'}</span>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0c1446' }}>{f.title}</span>
        </div>
        <SeverityBadge severity={f.severity} />
      </div>
      {f.metric && (
        <div style={{
          fontSize: '0.8rem', color: s.dot, fontWeight: 700,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        }}>
          {f.metric}
        </div>
      )}
      <div style={{ fontSize: '0.87rem', color: '#374151', lineHeight: 1.5 }}>{f.detail}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <OpenInAskYourData
          variant="icon"
          fileId={fileId}
          prompt={`Tell me more about: ${f.title}. ${f.detail || ''}`.trim()}
        />
        <PinToDashboard
          variant="icon"
          widget={{
            type: 'insight',
            label: f.title,
            file_id: fileId,
            extra: { severity: f.severity, detail: f.detail, metric: f.metric },
          }}
        />
      </div>
    </div>
  )
}

function QualityRow({ q }) {
  const s = SEVERITY_STYLES[q.severity] || SEVERITY_STYLES.info
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f3f9' }}>
      <div style={{ minWidth: 60 }}><SeverityBadge severity={q.severity} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0c1446' }}>
          {q.field}: <span style={{ fontWeight: 500, color: '#374151' }}>{q.issue}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>→ {q.recommendation}</div>
      </div>
    </div>
  )
}

function OpportunityCard({ o, fileId }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#fff,#fdf2f8)',
      border: '1px solid #fbcfe8',
      borderRadius: 10,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0c1446', marginBottom: 6 }}>
          ◎ {o.title}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <OpenInAskYourData
            variant="icon"
            fileId={fileId}
            prompt={`Help me act on: ${o.title}. ${o.suggested_next_step || ''}`.trim()}
          />
          <PinToDashboard
            variant="icon"
            widget={{
              type: 'insight',
              label: o.title,
              file_id: fileId,
              extra: { detail: o.detail, next_step: o.suggested_next_step, kind: 'opportunity' },
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>{o.detail}</div>
      <div style={{
        fontSize: '0.78rem', color: '#e91e8c', fontWeight: 700,
        background: '#fff', border: '1px dashed #f9a8d4',
        padding: '6px 10px', borderRadius: 6, display: 'inline-block',
      }}>
        Next: {o.suggested_next_step}
      </div>
    </div>
  )
}

function StatCard({ label, value, hint }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '8px 14px',
      minWidth: 100,
    }}>
      <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{value}</div>
      {hint && <div style={{ fontSize: '0.7rem', opacity: 0.65, marginTop: 1 }}>{hint}</div>}
    </div>
  )
}

// --- page -------------------------------------------------------------------

export default function AIInsights() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
  }, [])

  const handleGenerate = async () => {
    if (!selectedFile) return
    setLoading(true); setErr(''); setResult(null)
    try {
      const res = await aiApi.insights(selectedFile)
      setResult(res.data || res)
    } catch (e) {
      const detail = e?.response?.data?.detail
      if (detail?.code === 'ai_disabled') {
        setErr('AI is not enabled for this workspace. Ask your org owner to enable AI in settings.')
      } else {
        setErr(e?.response?.data?.detail || e.message || 'Failed to generate insights')
      }
    } finally {
      setLoading(false)
    }
  }

  const pack = result?.stat_pack
  const insights = result?.insights
  const reportRef = useRef(null)

  // Build a flat row dataset from the insights so CSV export is meaningful.
  const exportRows = result && insights ? [
    ...((insights.key_findings || []).map(f => ({ section: 'finding', severity: f.severity, title: f.title, metric: f.metric || '', detail: f.detail }))),
    ...((insights.data_quality || []).map(q => ({ section: 'quality', severity: q.severity, title: q.field, metric: q.issue || '', detail: q.recommendation }))),
    ...((insights.opportunities || []).map(o => ({ section: 'opportunity', severity: 'info', title: o.title, metric: o.suggested_next_step || '', detail: o.detail }))),
  ] : []

  const numericCount = pack ? (pack.columns || []).filter(c => c.type === 'numeric').length : 0
  const categoricalCount = pack ? (pack.columns || []).filter(c => c.type === 'text').length : 0
  const dateCount = pack ? (pack.columns || []).filter(c => c.type === 'date').length : 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0c1446', margin: 0 }}>AI Insights</h1>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg,#e91e8c,#0097b2)',
          padding: '3px 8px', borderRadius: 6, letterSpacing: 0.5,
        }}>LLM-POWERED</span>
      </div>
      <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: '0.9rem' }}>
        Executive-quality findings written by Claude Haiku from a full statistical analysis of your data.
      </p>

      {/* File picker */}
      <div style={{
        background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12,
        padding: '18px 22px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
            Select file to analyse
          </label>
          <select
            value={selectedFile}
            onChange={e => setSelectedFile(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', background: '#fff' }}
          >
            <option value=''>-- Choose a file --</option>
            {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedFile || loading}
          style={{
            marginTop: 22, padding: '10px 24px',
            background: selectedFile && !loading ? 'linear-gradient(135deg,#e91e8c,#c4166e)' : '#d1d5db',
            color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
            fontSize: '0.9rem', cursor: selectedFile && !loading ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Analysing...' : 'Generate Insights'}
        </button>
      </div>

      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
          {err}
        </div>
      )}

      {!result && !loading && !err && (
        <EmptyState
          icon="◎"
          title="Pick a file to get an insight brief"
          body="We'll compute a full stat pack (distributions, outliers, concentrations, correlations) and ask the model to write findings, quality flags, and recommended next steps."
          tone="info"
        />
      )}

      {loading && (
        <div>
          <div style={{ marginBottom: 14, color: '#6b7280', fontSize: '0.88rem', fontWeight: 600 }}>
            Computing statistics, then handing the stat pack to Claude for interpretation…
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 16 }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <SkeletonChart height={220} />
        </div>
      )}

      {result && pack && insights && (
        <div ref={reportRef}>
          {/* Export bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <ExportMenu
              data={exportRows}
              filename={`insights-${pack.filename || 'report'}`}
              containerRef={reportRef}
              title={`AI Insights — ${pack.filename || ''}`}
            />
          </div>
          {/* Header card */}
          <div style={{
            background: 'linear-gradient(135deg,#0c1446,#1a2080 50%,#0097b2)',
            borderRadius: 12, padding: '20px 24px', marginBottom: 24, color: '#fff',
          }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 4, letterSpacing: 0.5 }}>HEADLINE</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.35, marginBottom: 16 }}>
              {insights.headline}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <StatCard label="File" value={pack.filename} />
              <StatCard label="Rows" value={(pack.row_count || 0).toLocaleString()} hint={pack.low_n ? 'low n (<30)' : ''} />
              <StatCard label="Cols" value={pack.column_count || 0} />
              <StatCard label="Numeric" value={numericCount} />
              <StatCard label="Text" value={categoricalCount} />
              {dateCount > 0 && <StatCard label="Date" value={dateCount} />}
              {pack.correlations?.length > 0 && (
                <StatCard label="Correlations" value={pack.correlations.length} hint="|r|≥0.3" />
              )}
            </div>
          </div>

          {/* Key findings */}
          {insights.key_findings?.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0c1446', margin: '0 0 12px' }}>
                Key findings
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {insights.key_findings.map((f, i) => <FindingCard key={i} f={f} fileId={selectedFile} />)}
              </div>
            </section>
          )}

          {/* Data quality */}
          {insights.data_quality?.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0c1446', margin: '0 0 12px' }}>
                Data quality
              </h2>
              <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 10, padding: '4px 18px' }}>
                {insights.data_quality.map((q, i) => <QualityRow key={i} q={q} />)}
              </div>
            </section>
          )}

          {/* Opportunities */}
          {insights.opportunities?.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0c1446', margin: '0 0 12px' }}>
                Recommended next steps
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {insights.opportunities.map((o, i) => <OpportunityCard key={i} o={o} fileId={selectedFile} />)}
              </div>
            </section>
          )}

          {/* Correlations drill-down */}
          {pack.correlations?.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0c1446', margin: '0 0 12px' }}>
                Numeric relationships
              </h2>
              <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ background: '#f8f9fc' }}>
                    <tr>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#4b5563' }}>Column A</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#4b5563' }}>Column B</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#4b5563' }}>Pearson r</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#4b5563' }}>n</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pack.correlations.map((c, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f1f3f9' }}>
                        <td style={{ padding: '8px 14px' }}>{c.a}</td>
                        <td style={{ padding: '8px 14px' }}>{c.b}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace',
                          color: Math.abs(c.r) > 0.6 ? '#e91e8c' : '#0097b2', fontWeight: 700 }}>
                          {c.r > 0 ? '+' : ''}{c.r.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: '#6b7280' }}>{c.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Raw stat pack (collapsible debug) */}
          <details style={{ marginBottom: 20 }}>
            <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.8rem', fontWeight: 600 }}>
              View raw stat pack (debug)
            </summary>
            <pre style={{
              background: '#0c1446', color: '#d1d5db', padding: 16, borderRadius: 8,
              fontSize: '0.72rem', overflow: 'auto', maxHeight: 380, marginTop: 10,
            }}>{JSON.stringify(pack, null, 2)}</pre>
          </details>

          {insights.raw && (
            <details style={{ marginBottom: 20 }}>
              <summary style={{ cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem', fontWeight: 700 }}>
                Model returned unparsable output — view raw
              </summary>
              <pre style={{ background: '#fef2f2', color: '#991b1b', padding: 16, borderRadius: 8,
                fontSize: '0.8rem', overflow: 'auto', maxHeight: 380, marginTop: 10 }}>
                {insights.raw}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
