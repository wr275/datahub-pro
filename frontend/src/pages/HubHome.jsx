import React, { useState, useEffect, useRef, useCallback } from 'react'
import { filesApi } from '../api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const COLORS = ['#4f8ef7', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#38bdf8']

// ── Renderers ────────────────────────────────────────────────────────────────

function FormattedText({ text }) {
  const lines = text.split('\n')
  return (
    <div style={{ lineHeight: 1.65, fontSize: 14 }}>
      {lines.map((line, i) => {
        if (/^\*\*(.+)\*\*$/.test(line)) {
          return <p key={i} style={{ fontWeight: 700, margin: '6px 0 2px' }}>{line.replace(/\*\*/g, '')}</p>
        }
        if (/^[-•]\s/.test(line)) {
          return <p key={i} style={{ margin: '2px 0', paddingLeft: 14 }}>• {line.slice(2)}</p>
        }
        if (line.trim() === '') return <br key={i} />
        return <p key={i} style={{ margin: '3px 0' }}>{line}</p>
      })}
    </div>
  )
}

function TableResponse({ data }) {
  if (!data || !data.columns || !data.rows || data.rows.length === 0) return null
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {data.columns.map((col, i) => (
              <th key={i} style={{
                background: '#1e2a5e', color: '#fff', padding: '7px 12px',
                textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap',
                borderBottom: '2px solid #2d3a7c'
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? '#f8f9ff' : '#fff' }}>
              {data.columns.map((col, ci) => (
                <td key={ci} style={{
                  padding: '6px 12px', borderBottom: '1px solid #e8eaf0',
                  color: '#1a2342', whiteSpace: 'nowrap'
                }}>{Array.isArray(row) ? (row[ci] ?? '') : (row[col] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartResponse({ data }) {
  if (!data || !data.chart_data || data.chart_data.length === 0) return null
  const { chart_type = 'bar', chart_data, x_key, y_keys = [], title } = data

  return (
    <div style={{ marginTop: 12 }}>
      {title && <p style={{ fontSize: 13, fontWeight: 600, color: '#1e2a5e', marginBottom: 8 }}>{title}</p>}
      <ResponsiveContainer width="100%" height={260}>
        {chart_type === 'pie' ? (
          <PieChart>
            <Pie data={chart_data} dataKey={y_keys[0] || 'value'} nameKey={x_key || 'name'}
              cx="50%" cy="50%" outerRadius={100} label>
              {chart_data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : chart_type === 'line' ? (
          <LineChart data={chart_data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eaf0" />
            <XAxis dataKey={x_key} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {(y_keys.length ? y_keys : ['value']).map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={chart_data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8eaf0" />
            <XAxis dataKey={x_key} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {(y_keys.length ? y_keys : ['value']).map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

// ── Message bubble ───────────────────────────────────────────────────────────

function Message({ msg }) {
  const isUser = msg.role === 'user'
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div style={{
          background: '#4f8ef7', color: '#fff', borderRadius: '16px 16px 4px 16px',
          padding: '10px 16px', maxWidth: '72%', fontSize: 14, lineHeight: 1.5
        }}>{msg.content}</div>
      </div>
    )
  }

  // Parse structured response — handles raw JSON or ```json``` wrapped
  let parsed = null
  if (msg.content && !msg.streaming) {
    let text = msg.content.trim()
    const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (blockMatch) text = blockMatch[1].trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]) } catch (_) {} }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
      <div style={{
        background: '#fff', border: '1px solid #e4e8f0', borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px', maxWidth: '85%', fontSize: 14, lineHeight: 1.5,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        {msg.streaming && !msg.content && (
          <span style={{ display: 'inline-block', width: 8, height: 14, background: '#4f8ef7',
            borderRadius: 2, animation: 'blink 1s step-end infinite' }} />
        )}
        {parsed ? (
          <>
            {parsed.summary && <FormattedText text={parsed.summary} />}
            {parsed.type === 'table' && <TableResponse data={parsed} />}
            {parsed.type === 'chart' && <ChartResponse data={parsed} />}
          </>
        ) : (
          <>
            <FormattedText text={msg.content || ''} />
            {msg.streaming && (
              <span style={{ display: 'inline-block', width: 8, height: 14, background: '#4f8ef7',
                borderRadius: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom', marginLeft: 2 }} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── AIAssistant ──────────────────────────────────────────────────────────────

function AIAssistant() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const bottomRef = useRef(null)
  const abortRef = useRef(null)

  // Load files
  useEffect(() => {
    filesApi.list()
      .then(res => {
        const list = res.data || []
        setFiles(list)
        // Check for pending file from upload
        const pending = localStorage.getItem('ai_pending_file')
        if (pending) {
          try {
            const p = JSON.parse(pending)
            localStorage.removeItem('ai_pending_file')
            const match = list.find(f => f.id === p.id)
            if (match) {
              setSelectedFile(String(p.id))
              const greeting = `I've loaded **${p.name}** — ${p.rows?.toLocaleString() || '?'} rows, ${p.cols || '?'} columns. Ask me anything about it.`
              setMessages([{ role: 'assistant', content: greeting, id: Date.now() }])
              return
            }
          } catch (_) {}
        }
        if (list.length > 0) setSelectedFile(String(list[0].id))
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false))
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text) => {
    const question = (text || input).trim()
    if (!question || !selectedFile || streaming) return

    const userMsg = { role: 'user', content: question, id: Date.now() }
    const assistantId = Date.now() + 1
    const assistantMsg = { role: 'assistant', content: '', streaming: true, id: assistantId }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || ''
      abortRef.current = new AbortController()

      const res = await fetch(`${API_BASE}/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ file_id: selectedFile, question }),
        signal: abortRef.current.signal
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        // Parse SSE: "data: ...\n\n"
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            accumulated += data
            const current = accumulated
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: current, streaming: true } : m
            ))
          }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, streaming: false } : m
      ))
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.', streaming: false }
            : m
        ))
      }
    } finally {
      setStreaming(false)
    }
  }, [input, selectedFile, streaming])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const suggestions = [
    'Summarize this dataset',
    'Show top 10 rows as a table',
    'What are the key trends?',
    'Create a chart of the main metrics'
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 220px)', minHeight: 480,
      background: '#f4f6fb', borderRadius: 14,
      border: '1px solid #dde2f0', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: '#1e2a5e', padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
      }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>AI Assistant</div>
          <div style={{ color: '#8fa8d8', fontSize: 12 }}>Powered by GPT-4o mini</div>
        </div>
        {loadingFiles ? (
          <div style={{ color: '#8fa8d8', fontSize: 13 }}>Loading files…</div>
        ) : (
          <select
            value={selectedFile}
            onChange={e => { setSelectedFile(e.target.value); setMessages([]) }}
            style={{
              background: '#2d3a7c', color: '#fff', border: '1px solid #4f5f9a',
              borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer',
              maxWidth: 200
            }}
          >
            {files.length === 0 && <option value="">No files uploaded</option>}
            {files.map(f => (
              <option key={f.id} value={String(f.id)}>{f.filename || f.name}</option>
             ))}
          </select>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {messages.length === 0 && !streaming && (
          <div style={{ textAlign: 'center', paddingTop: 40, color: '7a8ab5' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#1e2a5e' }}>
              Ask anything about your data
            </div>
            <div style={{ fontSize: 13, marginBottom: 24 }}>
              {selectedFile ? 'Select a question below or type your own' : 'Upload a file to get started'}
            </div>
            {selectedFile && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{
                    background: '#fff', border: '1px solid #d0d8f0', borderRadius: 20,
                    padding: '7px 14px', fontSize: 13, color: '#1e2a5e', cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                    onMouseOver={e => e.target.style.background = '#eef2ff'}
                    onMouseOut={e => e.target.style.background = '#fff'}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px', background: '#fff',
        borderTop: '1px solid #dde2f0', flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedFile ? 'Ask a question about your data…' : 'Upload a file first'}
            disabled={!selectedFile || streaming}
            rows={1}
            style={{
              flex: 1, border: '1.5px solid #dde2f0', borderRadius: 10,
              padding: '10px 14px', fontSize: 14, resize: 'none', outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, color: '#1a2342',
              background: selectedFile ? '#fff' : '#f8f9ff',
              transition: 'border-color 0.15s',
              minHeight: 42, maxHeight: 120, overflowY: 'auto'
            }}
            onFocus={e => e.target.style.borderColor = '#4f8ef7'}
            onBlur={e => e.target.style.borderColor = '#dde2f0'}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!selectedFile || !input.trim() || streaming}
            style={{
              background: selectedFile && input.trim() && !streaming ? '#4f8ef7' : '#c5cde8',
              color: '#fff', border: 'none', borderRadius: 10,
              width: 42, height: 42, cursor: selectedFile && input.trim() && !streaming ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s', flexShrink: 0
            }}
          >
            {streaming ? (
              <span style={{ width: 16, height: 16, border: '2px solid #fff',
                borderTopColor: 'transparent', borderRadius: '50%',
                display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#a0aac8', marginTop: 6, marginBottom: 0 }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, change }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '20px 22px',
      border: '1px solid #eaecf5', boxShadow: '0 2px 8px rgba(30,42,94,0.06)',
      display: 'flex', alignItems: 'center', gap: 16
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#7a8ab5', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1a2342', lineHeight: 1 }}>{value}</div>
        {change && <div style={{ fontSize: 12, color: '#34d399', marginTop: 3, fontWeight: 500 }}>{change}</div>}
      </div>
    </div>
  )
}

// ── Main HubHome ─────────────────────────────────────────────────────────────

export default function HubHome() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    // Check if we should auto-switch to AI tab
    const pending = localStorage.getItem('ai_pending_file')
    if (pending) setActiveTab('ai')

    filesApi.list()
      .then(res => {
        const files = res.data || []
        setStats({
          total: files.length,
          recent: files.filter(f => {
            const d = new Date(f.uploaded_at || f.created_at || 0)
            return (Date.now() - d) < 7 * 24 * 3600 * 1000
          }).length,
          rows: files.reduce((s, f) => s + (f.row_count || 0), 0),
          cols: files.reduce((s, f) => s + (f.column_count || 0), 0)
        })
      })
      .catch(() => {})
  }, [])

  const tabs = [
    { id: 'dashboard', label: '🏠 Dashboard' },
    { id: 'ai', label: '🤖 AI Mode' },
    { id: 'charts', label: '📊 Charts' },
  ]

  return (
    <div>
      {/* Chrome-style Tab Bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-end',
        background: '#0c1446', paddingLeft: 16, paddingTop: 8,
        borderBottom: '2px solid #1e2a5e', gap: 2
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: isActive ? '#f4f6fb' : 'transparent',
                color: isActive ? '#1a2342' : '#8fa8d8',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                padding: '9px 20px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                position: 'relative',
                bottom: -2
              }}
            >{tab.label}</button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>

        {activeTab === 'dashboard' && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a2342', margin: 0 }}>
                📊 DataHub Pro
              </h1>
              <p style={{ color: '#6b7db5', marginTop: 6, fontSize: 14 }}>
                Your intelligent data analysis workspace
              </p>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16, marginBottom: 28
            }}>
              <StatCard icon="📁" label="Total Files" value={stats?.total ?? '–'} color="#4f8ef7" change={stats?.recent ? `+${stats.recent} this week` : null} />
              <StatCard icon="📋" label="Total Rows" value={stats?.rows ? stats.rows.toLocaleString() : '–'} color="#34d399" />
              <StatCard icon="🗂️" label="Columns Tracked" value={stats?.cols ?? '–'} color="#f59e0b" />
              <StatCard icon="🤖" label="AI Ready" value="GPT-4o" color="#a78bfa" change="✅ Connected" />
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #1e2a5e 0%, #2d4a9e 100%)',
              borderRadius: 16, padding: '28px 32px', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 20
            }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                  Ready to analyze your data?
                </div>
                <div style={{ color: '#8fa8d8', fontSize: 14, maxWidth: 400 }}>
                  Upload a CSV or Excel file, then switch to AI Mode to ask questions in plain English.
                </div>
              </div>
              <button onClick={() => setActiveTab('ai')} style={{
                background: '#4f8ef7', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 24px', fontSize: 14,
                fontWeight: 600, cursor: 'pointer'
              }}>Open AI Mode →</button>
            </div>
          </div>
        )}

        {activeTab === 'ai' && <AIAssistant />}

        {activeTab === 'charts' && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: '#7a8ab5' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e2a5e', marginBottom: 8 }}>
              Charts coming soon
            </div>
            <div style={{ fontSize: 14 }}>
              Ask the AI to generate charts for you in AI Mode
            </div>
            <button onClick={() => setActiveTab('ai')} style={{
              marginTop: 20, background: '#4f8ef7', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
            }}>Go to AI Mode</button>
          </div>
        )}
      </div>
    </div>
  )
}
