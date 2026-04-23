import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi, aiApi } from '../api'

// -----------------------------------------------------------------------------
// AI Narrative 2.0 — real LLM-written prose with audience/tone/length controls
// -----------------------------------------------------------------------------

const AUDIENCE_OPTS = [
  { value: 'client', label: 'Client',
    desc: 'Addressed to the client reading the deliverable' },
  { value: 'board', label: 'Board / exec',
    desc: 'Briefing for senior stakeholders; emphasises "so what"' },
  { value: 'team', label: 'Internal team',
    desc: 'Team voice, actionable, candid' },
]

const TONE_OPTS = [
  { value: 'executive',   label: 'Executive',   desc: 'Confident, decisive, outcome-led' },
  { value: 'analyst',     label: 'Analyst',     desc: 'Precise, includes caveats where relevant' },
  { value: 'storyteller', label: 'Storyteller', desc: 'Narrative arc — hook, tension, resolution' },
  { value: 'plain',       label: 'Plain English', desc: 'Simple words, no jargon' },
]

const LENGTH_OPTS = [
  { value: 'short',  label: 'Short',  desc: '≈ 80-120 words' },
  { value: 'medium', label: 'Medium', desc: '≈ 180-240 words' },
  { value: 'long',   label: 'Long',   desc: '≈ 320-400 words' },
]

export default function AINarrative() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [audience, setAudience] = useState('client')
  const [tone, setTone] = useState('executive')
  const [length, setLength] = useState('medium')
  const [focusColumn, setFocusColumn] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
  }, [])

  function loadFile(id) {
    setFileId(id); setResult(null); setFocusColumn(''); setError('')
    if (!id) { setHeaders([]); return }
    analyticsApi.preview(id).then(r => {
      setHeaders(r.data.headers || [])
    }).catch(() => {})
  }

  async function generate() {
    if (!fileId || loading) return
    setLoading(true); setError(''); setResult(null); setCopied(false)
    try {
      const r = await aiApi.narrative(fileId, {
        audience, tone, length,
        focus_column: focusColumn || null,
      })
      setResult(r.data)
    } catch (e) {
      const d = e?.response?.data?.detail
      if (d?.code === 'ai_disabled') setError('AI is not enabled on this workspace.')
      else setError(typeof d === 'string' ? d : (e.message || 'Narrative generation failed'))
    } finally {
      setLoading(false)
    }
  }

  async function copyText() {
    const txt = result?.narrative?.narrative || ''
    if (!txt) return
    try {
      await navigator.clipboard.writeText(txt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy to clipboard blocked by the browser. Select text and copy manually.')
    }
  }

  const narrative = result?.narrative

  return (
    <div style={{ padding: 28, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0c1446' }}>AI Narrative</h1>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg,#e91e8c,#0097b2)', padding: '3px 8px',
          borderRadius: 6, letterSpacing: 0.5,
        }}>LLM · TUNED PROSE</span>
      </div>
      <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: '0.9rem' }}>
        Turn your data into a finished paragraph ready to paste into a deck or email — tuned to audience, tone and length.
      </p>

      <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          <Field label='Dataset'>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={selectStyle}>
              <option value=''>-- Choose a file --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </Field>
          <Field label='Anchor on column (optional)'>
            <select value={focusColumn} onChange={e => setFocusColumn(e.target.value)} style={selectStyle} disabled={!headers.length}>
              <option value=''>-- let the model pick --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
        </div>

        <SegmentedGroup label='Audience' value={audience} onChange={setAudience} options={AUDIENCE_OPTS} />
        <SegmentedGroup label='Tone'     value={tone}     onChange={setTone}     options={TONE_OPTS} />
        <SegmentedGroup label='Length'   value={length}   onChange={setLength}   options={LENGTH_OPTS} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button onClick={generate} disabled={!fileId || loading}
            style={{
              padding: '10px 22px',
              background: (!fileId || loading) ? '#d1d5db' : 'linear-gradient(135deg,#e91e8c,#c4166e)',
              color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
              cursor: (!fileId || loading) ? 'not-allowed' : 'pointer',
            }}>
            {loading ? 'Writing…' : 'Generate narrative'}
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
        <div style={{ textAlign: 'center', padding: 50, color: '#6b7280' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0c1446' }}>Writing your narrative…</div>
          <div style={{ fontSize: '0.82rem', marginTop: 4 }}>Typically 5-15 seconds.</div>
        </div>
      )}

      {narrative && !loading && (
        <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: '#e91e8c', fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Narrative
              </div>
              {narrative.headline && (
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0c1446', marginTop: 4, lineHeight: 1.4 }}>
                  {narrative.headline}
                </div>
              )}
              {narrative.anchor_column && (
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>
                  Anchored on <strong style={{ color: '#0097b2' }}>{narrative.anchor_column}</strong> · {LENGTH_OPTS.find(l => l.value === length)?.label} · {TONE_OPTS.find(t => t.value === tone)?.label}
                </div>
              )}
            </div>
            <button onClick={copyText} style={{
              padding: '7px 14px', background: copied ? '#10b981' : '#f3f4f6',
              color: copied ? '#fff' : '#0c1446', border: 'none', borderRadius: 7,
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}>
              {copied ? '✓ Copied' : 'Copy text'}
            </button>
          </div>

          <div style={{
            fontSize: '0.98rem', color: '#1f2937', lineHeight: 1.75,
            whiteSpace: 'pre-wrap', fontFamily: 'Georgia, ui-serif, serif',
          }}>
            {narrative.narrative}
          </div>

          {narrative.raw && (
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', color: '#dc2626', fontSize: '0.78rem', fontWeight: 700 }}>
                Model returned unparsable output — view raw
              </summary>
              <pre style={{ background: '#fef2f2', color: '#991b1b', padding: 10, borderRadius: 8,
                fontSize: '0.75rem', overflow: 'auto', maxHeight: 260, marginTop: 8 }}>{narrative.raw}</pre>
            </details>
          )}
        </div>
      )}

      {!narrative && !loading && !error && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>✍️</div>
          <div>Pick a dataset, choose an audience and tone, and click <strong>Generate narrative</strong>.</div>
        </div>
      )}
    </div>
  )
}

function SegmentedGroup({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(o => {
          const active = o.value === value
          return (
            <button key={o.value} onClick={() => onChange(o.value)} title={o.desc}
              style={{
                padding: '7px 14px',
                background: active ? 'linear-gradient(135deg,#e91e8c,#c4166e)' : '#fff',
                color: active ? '#fff' : '#374151',
                border: active ? '1px solid transparent' : '1px solid #d1d5db',
                borderRadius: 999, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: active ? '0 2px 8px rgba(233,30,140,0.25)' : 'none',
              }}>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

const selectStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.9rem', background: '#fff',
}
