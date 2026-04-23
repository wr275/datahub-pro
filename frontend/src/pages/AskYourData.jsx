import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filesApi, analyticsApi, aiApi } from '../api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'

const PIE_COLORS = ['#e91e8c', '#0097b2', '#0c1446', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#8b5cf6']

// -----------------------------------------------------------------------------
// Render logic — if the model returns JSON (table / chart), render it properly
// -----------------------------------------------------------------------------

function tryParseJson(text) {
  if (!text) return null
  const s = text.trim()
  // Strip ```json ... ``` fences if present.
  const fenced = s.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/)
  const body = fenced ? fenced[1].trim() : s
  // Fast path: whole response is JSON.
  if (body.startsWith('{') && body.endsWith('}')) {
    try { return { parsed: JSON.parse(body), preamble: '', postamble: '' } } catch { /* fall through */ }
  }
  // Relaxed path: find the outermost balanced {...} block and parse it.
  const first = body.indexOf('{')
  if (first < 0) return null
  let depth = 0, end = -1, inStr = false, esc = false
  for (let i = first; i < body.length; i++) {
    const ch = body[i]
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end < 0) return null
  try {
    const obj = JSON.parse(body.slice(first, end + 1))
    // Only treat as structured if it has a 'type' we care about.
    if (obj?.type !== 'table' && obj?.type !== 'chart') return null
    return {
      parsed: obj,
      preamble: body.slice(0, first).trim(),
      postamble: body.slice(end + 1).trim(),
    }
  } catch { return null }
}

function RenderedMessage({ text }) {
  const extracted = tryParseJson(text)
  const parsed = extracted?.parsed
  const preamble = extracted?.preamble
  const postamble = extracted?.postamble

  if (parsed?.type === 'table' && Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
    return (
      <div>
        {preamble && <div style={{ fontSize: '0.88rem', color: '#374151', marginBottom: 10, whiteSpace: 'pre-wrap' }}>{preamble}</div>}
        {parsed.summary && (
          <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: 10 }}>{parsed.summary}</div>
        )}
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                {parsed.columns.map(c => (
                  <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                  {parsed.columns.map(c => (
                    <td key={c} style={{ padding: '7px 12px', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
                      {row[c] == null ? '—' : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {postamble && <div style={{ fontSize: '0.88rem', color: '#374151', marginTop: 10, whiteSpace: 'pre-wrap' }}>{postamble}</div>}
      </div>
    )
  }

  if (parsed?.type === 'chart' && Array.isArray(parsed.chart_data)) {
    const xKey = parsed.x_key || 'name'
    const yKeys = Array.isArray(parsed.y_keys) && parsed.y_keys.length ? parsed.y_keys : ['value']
    return (
      <div>
        {preamble && <div style={{ fontSize: '0.88rem', color: '#374151', marginBottom: 10, whiteSpace: 'pre-wrap' }}>{preamble}</div>}
        {parsed.title && <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0c1446', marginBottom: 4 }}>{parsed.title}</div>}
        {parsed.summary && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 10 }}>{parsed.summary}</div>}
        <div style={{ height: 280, width: '100%' }}>
          <ResponsiveContainer>
            {parsed.chart_type === 'line' ? (
              <LineChart data={parsed.chart_data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {yKeys.map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            ) : parsed.chart_type === 'pie' ? (
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie data={parsed.chart_data} dataKey={yKeys[0]} nameKey={xKey}
                  outerRadius={100} label>
                  {parsed.chart_data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={parsed.chart_data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {yKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} fill={PIE_COLORS[i % PIE_COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        {postamble && <div style={{ fontSize: '0.88rem', color: '#374151', marginTop: 10, whiteSpace: 'pre-wrap' }}>{postamble}</div>}
      </div>
    )
  }

  // Plain text — render simple bold markdown and preserve line breaks
  const lines = String(text).split('\n')
  return (
    <div style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
      {lines.map((line, i) => (
        <div key={i}>{renderInlineBold(line)}</div>
      ))}
    </div>
  )
}

function renderInlineBold(line) {
  // Very small markdown: **bold**
  const parts = []
  let idx = 0
  const re = /\*\*(.+?)\*\*/g
  let m
  while ((m = re.exec(line)) !== null) {
    if (m.index > idx) parts.push(line.slice(idx, m.index))
    parts.push(<strong key={idx + 'b'}>{m[1]}</strong>)
    idx = m.index + m[0].length
  }
  if (idx < line.length) parts.push(line.slice(idx))
  return parts
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

const SUGGESTIONS = [
  'Summarise the data in 5 bullets',
  'Show me a chart of the top 10 rows by the largest numeric column',
  'Which column has the most missing values?',
  'Are there any obvious outliers?',
  'What story does this data tell?',
]

export default function AskYourData() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [filename, setFilename] = useState('')
  const [question, setQuestion] = useState('')
  const [chat, setChat] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  const autoSubmitPending = useRef(searchParams.get('autosubmit') === '1')
  const seededFromUrl = useRef(false)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && !seededFromUrl.current) { setQuestion(q); seededFromUrl.current = true }
    filesApi.list().then(r => {
      const list = r.data || []
      setFiles(list)
      if (q && !fileId && list.length > 0) loadFile(list[0].id)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chat, loading])

  function loadFile(id) {
    setFileId(id); setChat([]); setError('')
    if (!id) { setHeaders([]); setRows([]); setFilename(''); return }
    analyticsApi.preview(id).then(r => {
      const d = r.data
      setHeaders(d.headers || [])
      setRows(d.rows || [])
      setFilename(d.filename || '')
      setChat([{
        role: 'assistant',
        text: `I've loaded **${d.filename || 'your dataset'}** — ${(d.rows?.length || 0).toLocaleString()} rows, ${(d.headers?.length || 0)} columns. Ask me anything about it, and I'll use the full dataset to answer. I can also return charts and tables.`,
      }])
    }).catch(() => setError('Failed to load file.'))
  }

  async function ask(explicit) {
    const q = (explicit ?? question).trim()
    if (!q || !fileId || loading) return
    setError('')
    const nextHistory = [...chat, { role: 'user', text: q }]
    setChat(nextHistory)
    setQuestion('')
    setLoading(true)

    try {
      // Convert local "text" messages into API content messages
      const apiMessages = nextHistory
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.text }))
      const r = await aiApi.chat({ file_id: fileId, messages: apiMessages })
      const resp = r.data?.response || ''
      setChat(c => [...c, { role: 'assistant', text: resp }])
    } catch (e) {
      const d = e?.response?.data?.detail
      if (d?.code === 'ai_disabled') {
        setError('AI is not enabled on this workspace. Ask your org owner to enable AI in settings.')
      } else {
        setError(typeof d === 'string' ? d : (e.message || 'Chat failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!autoSubmitPending.current) return
    if (!rows.length || !question.trim()) return
    autoSubmitPending.current = false
    const next = new URLSearchParams(searchParams)
    next.delete('q'); next.delete('autosubmit')
    setSearchParams(next, { replace: true })
    setTimeout(() => ask(), 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, question])

  return (
    <div style={{ padding: 28, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0c1446' }}>Ask Your Data</h1>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg,#e91e8c,#0097b2)', padding: '3px 8px',
          borderRadius: 6, letterSpacing: 0.5,
        }}>LLM · TABLES · CHARTS</span>
      </div>
      <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: '0.9rem' }}>
        Conversational analysis with memory. Ask follow-up questions, request charts or tables, and the model remembers the whole thread.
      </p>

      <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
          Dataset
        </label>
        <select value={fileId} onChange={e => loadFile(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
          <option value="">-- Choose a file to query --</option>
          {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
        </select>
        {filename && (
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 8 }}>
            {rows.length.toLocaleString()} rows · {headers.length} columns
            {chat.length > 1 && <button onClick={() => setChat(chat.slice(0, 1))}
              style={{ marginLeft: 10, color: '#e91e8c', background: 'transparent', border: 'none',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, padding: 0 }}>
              Clear conversation
            </button>}
          </div>
        )}
      </div>

      {chat.length > 0 && (
        <div ref={scrollRef} style={{
          background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, marginBottom: 14,
          maxHeight: 520, overflowY: 'auto', padding: 16,
        }}>
          {chat.map((msg, i) => (
            <div key={i} style={{
              marginBottom: 14, display: 'flex', gap: 10,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', background: '#0c1446',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
                }}>AI</div>
              )}
              <div style={{
                maxWidth: msg.role === 'assistant' ? '90%' : '80%',
                padding: msg.role === 'user' ? '10px 14px' : '12px 16px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? '#e91e8c' : '#f9fafb',
                color: msg.role === 'user' ? '#fff' : '#374151',
                fontSize: '0.9rem',
              }}>
                {msg.role === 'user'
                  ? <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  : <RenderedMessage text={msg.text} />}
              </div>
              {msg.role === 'user' && (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', background: '#fdf2f8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#e91e8c', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                }}>You</div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0c1446',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '0.72rem', fontWeight: 700 }}>AI</div>
              <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 12, color: '#6b7280', fontSize: '0.85rem' }}>
                <span style={{ display: 'inline-block', animation: 'pulse 1s infinite' }}>Thinking…</span>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {fileId && (
        <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => { setQuestion(s); setTimeout(() => ask(s), 20) }}
                disabled={loading}
                style={{
                  padding: '6px 11px', background: '#f3f4f6', border: '1px solid #e5e7eb',
                  borderRadius: 14, fontSize: '0.77rem', cursor: loading ? 'not-allowed' : 'pointer',
                  color: '#374151',
                }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && ask()}
              placeholder='Ask anything — "top 10 products by revenue", "show me a bar chart of…"'
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}
            />
            <button onClick={() => ask()} disabled={!question.trim() || loading}
              style={{
                padding: '10px 22px',
                background: (!question.trim() || loading) ? '#d1d5db' : 'linear-gradient(135deg,#e91e8c,#c4166e)',
                color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem',
                cursor: (!question.trim() || loading) ? 'not-allowed' : 'pointer',
              }}>
              {loading ? '…' : 'Ask'}
            </button>
          </div>
        </div>
      )}

      {!fileId && (
        <div style={{ textAlign: 'center', padding: 70, color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>◎</div>
          <div>Select a dataset above to start a conversation.</div>
        </div>
      )}
    </div>
  )
}
