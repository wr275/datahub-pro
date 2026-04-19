import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filesApi, analyticsApi } from '../api'

const QUESTION_PATTERNS = [
  { pattern: /what is the (total|sum) of (.+)/i, handler: (m, rows, headers) => {
    const col = m[2].trim(); const actual = headers.find(h => h.toLowerCase() === col.toLowerCase()) || headers.find(h => h.toLowerCase().includes(col.toLowerCase()))
    if (!actual) return `I couldn't find a column matching "${col}". Available columns: ${headers.join(', ')}`
    const vals = rows.map(r => parseFloat(r[actual])).filter(v => !isNaN(v))
    return `The total sum of **${actual}** is **${vals.reduce((a, b) => a + b, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}** (from ${vals.length} records).`
  }},
  { pattern: /what is the (average|mean) of (.+)/i, handler: (m, rows, headers) => {
    const col = m[2].trim(); const actual = headers.find(h => h.toLowerCase().includes(col.toLowerCase()))
    if (!actual) return `Column "${col}" not found.`
    const vals = rows.map(r => parseFloat(r[actual])).filter(v => !isNaN(v))
    return `The average of **${actual}** is **${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)}**.`
  }},
  { pattern: /how many rows|how many records|count|total rows/i, handler: (m, rows) => `The dataset has **${rows.length} rows**.` },
  { pattern: /how many columns|what columns|list columns|show columns/i, handler: (m, rows, headers) => `The dataset has **${headers.length} columns**: ${headers.map(h => `\`${h}\``).join(', ')}.` },
  { pattern: /what is the (max|maximum|highest) (.+)/i, handler: (m, rows, headers) => {
    const col = m[2].trim(); const actual = headers.find(h => h.toLowerCase().includes(col.toLowerCase()))
    if (!actual) return `Column "${col}" not found.`
    const vals = rows.map(r => parseFloat(r[actual])).filter(v => !isNaN(v))
    return `The maximum value in **${actual}** is **${Math.max(...vals).toLocaleString(undefined, { maximumFractionDigits: 2 })}**.`
  }},
  { pattern: /what is the (min|minimum|lowest) (.+)/i, handler: (m, rows, headers) => {
    const col = m[2].trim(); const actual = headers.find(h => h.toLowerCase().includes(col.toLowerCase()))
    if (!actual) return `Column "${col}" not found.`
    const vals = rows.map(r => parseFloat(r[actual])).filter(v => !isNaN(v))
    return `The minimum value in **${actual}** is **${Math.min(...vals).toLocaleString(undefined, { maximumFractionDigits: 2 })}**.`
  }},
  { pattern: /top (\d+) (.+) by (.+)/i, handler: (m, rows, headers) => {
    const n = parseInt(m[1]); const labelCol = headers.find(h => h.toLowerCase().includes(m[2].trim().toLowerCase())) || headers[0]
    const valCol = headers.find(h => h.toLowerCase().includes(m[3].trim().toLowerCase()))
    if (!valCol) return `Could not find column for "${m[3]}".`
    const sorted = [...rows].filter(r => !isNaN(parseFloat(r[valCol]))).sort((a, b) => parseFloat(b[valCol]) - parseFloat(a[valCol])).slice(0, n)
    return `**Top ${n} ${m[2]} by ${m[3]}:**\n${sorted.map((r, i) => `${i + 1}. ${r[labelCol]}: ${parseFloat(r[valCol]).toLocaleString()}`).join('\n')}`
  }},
  { pattern: /how many unique|distinct values in (.+)/i, handler: (m, rows, headers) => {
    const col = m[1].trim(); const actual = headers.find(h => h.toLowerCase().includes(col.toLowerCase()))
    if (!actual) return `Column "${col}" not found.`
    const unique = new Set(rows.map(r => r[actual])).size
    return `There are **${unique} unique values** in column **${actual}**.`
  }},
  { pattern: /missing values|null values|empty values/i, handler: (m, rows, headers) => {
    const counts = headers.map(h => ({ col: h, missing: rows.filter(r => r[h] == null || r[h] === '').length })).filter(c => c.missing > 0)
    if (!counts.length) return `✅ No missing values found in any column!`
    return `**Missing values found:**\n${counts.map(c => `- ${c.col}: ${c.missing} missing (${(c.missing / rows.length * 100).toFixed(1)}%)`).join('\n')}`
  }},
  { pattern: /summarize|summary|overview|describe/i, handler: (m, rows, headers) => {
    const numCols = headers.filter(h => rows.some(r => !isNaN(parseFloat(r[h]))))
    const lines = [`**Dataset Summary:**`, `- Rows: ${rows.length}`, `- Columns: ${headers.length}`, `- Numeric columns: ${numCols.length}`, '']
    numCols.slice(0, 5).forEach(h => {
      const vals = rows.map(r => parseFloat(r[h])).filter(v => !isNaN(v))
      if (vals.length) lines.push(`**${h}**: min=${Math.min(...vals).toFixed(2)}, mean=${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)}, max=${Math.max(...vals).toFixed(2)}`)
    })
    return lines.join('\n')
  }},
]

function answerQuestion(question, rows, headers) {
  for (const { pattern, handler } of QUESTION_PATTERNS) {
    const match = question.match(pattern)
    if (match) return handler(match, rows, headers)
  }
  return `I understand you're asking about your data, but I wasn't able to parse that specific question. Try asking:\n\n• "What is the total of [column]?"\n• "What is the average of [column]?"\n• "How many rows?"\n• "Top 5 [label] by [value]?"\n• "How many unique values in [column]?"\n• "Are there missing values?"\n• "Summarize the data"`
}

export default function AskYourData() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [question, setQuestion] = useState('')
  const [chat, setChat] = useState([])
  const [loading, setLoading] = useState(false)

  // HubHome can hand off a prompt via ?q=...&autosubmit=1. Track whether
  // we still owe an auto-submit so we fire it exactly once, after the
  // dataset rows have actually loaded.
  const autoSubmitPending = useRef(searchParams.get('autosubmit') === '1')
  const seededFromUrl = useRef(false)

  useEffect(() => {
    // Seed the input from ?q=... on first mount so the user sees their
    // prompt immediately, even before files finish loading.
    const q = searchParams.get('q')
    if (q && !seededFromUrl.current) {
      setQuestion(q)
      seededFromUrl.current = true
    }
    filesApi.list().then(r => {
      const list = r.data || []
      setFiles(list)
      // If the Hub sent us here with a prompt, auto-select the most
      // recent file so the user doesn't have to pick one before seeing
      // an answer. If the workspace has no files, we silently do nothing
      // and the user will see the empty-state prompt.
      if (q && !fileId && list.length > 0) {
        loadFile(list[0].id)
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadFile(id) {
    setFileId(id); setChat([])
    if (!id) return
    analyticsApi.preview(id).then(r => {
      setHeaders(r.data.headers || [])
      setRows(r.data.rows || [])
      setChat([{ role: 'assistant', text: `I've loaded your dataset with ${r.data.rows?.length || 0} rows and ${r.data.headers?.length || 0} columns (${r.data.headers?.join(', ')}). What would you like to know?` }])
    }).catch(() => {})
  }

  function ask() {
    if (!question.trim() || !rows.length) return
    const q = question.trim()
    setChat(c => [...c, { role: 'user', text: q }])
    setQuestion('')
    setLoading(true)
    setTimeout(() => {
      const answer = answerQuestion(q, rows, headers)
      setChat(c => [...c, { role: 'assistant', text: answer }])
      setLoading(false)
    }, 400)
  }

  // Once rows are loaded and we still have a pending auto-submit from
  // the URL, fire the question once and then scrub the params so a
  // refresh doesn't re-ask the same thing.
  useEffect(() => {
    if (!autoSubmitPending.current) return
    if (!rows.length || !question.trim()) return
    autoSubmitPending.current = false
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    next.delete('autosubmit')
    setSearchParams(next, { replace: true })
    // Defer one tick so the chat scroll / state settles before asking.
    setTimeout(() => ask(), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, question])

  const suggestions = ['How many rows?', 'What columns are there?', 'Summarize the data', 'Are there missing values?']

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Ask Your Data</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Ask questions about your data in plain English</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
          <option value="">-- Choose a dataset to query --</option>
          {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
        </select>
      </div>

      {chat.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16, maxHeight: 450, overflowY: 'auto', padding: 16 }}>
          {chat.map((msg, i) => (
            <div key={i} style={{ marginBottom: 16, display: 'flex', gap: 10, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0c1446', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.85rem', flexShrink: 0 }}>AI</div>}
              <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.role === 'user' ? '#e91e8c' : '#f9fafb', color: msg.role === 'user' ? '#fff' : '#374151', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                {msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}
              </div>
              {msg.role === 'user' && <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e91e8c20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>👤</div>}
            </div>
          ))}
          {loading && <div style={{ display: 'flex', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0c1446', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.85rem' }}>AI</div><div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 12 }}>Thinking...</div></div>}
        </div>
      )}

      {fileId && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {suggestions.map(s => <button key={s} onClick={() => { setQuestion(s) }} style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: 16, fontSize: '0.8rem', cursor: 'pointer', color: '#374151' }}>{s}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="Ask a question about your data..." style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }} />
            <button onClick={ask} disabled={!question.trim()} style={{ padding: '10px 20px', background: question.trim() ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: question.trim() ? 'pointer' : 'default' }}>Ask</button>
          </div>
        </div>
      )}

      {!fileId && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>💬</div><div>Select a dataset above to start asking questions</div></div>}
    </div>
  )
}
