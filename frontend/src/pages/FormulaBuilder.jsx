import React, { useState, useEffect, useMemo, useRef } from 'react'
import { filesApi, analyticsApi, aiApi } from '../api'
import { create, all } from 'mathjs'

// Locked-down mathjs instance: no import, no createUnit, no eval, etc.
const math = create(all)
math.import({
  import: () => { throw new Error('import disabled') },
  createUnit: () => { throw new Error('createUnit disabled') },
  evaluate: () => { throw new Error('evaluate disabled') },
  parse: () => { throw new Error('parse disabled') },
  simplify: () => { throw new Error('simplify disabled') },
  derivative: () => { throw new Error('derivative disabled') },
}, { override: true })

// -----------------------------------------------------------------------------
// Helpers: column aliasing so "Column Name With Spaces" can be referenced
// inside an expression as "Column_Name_With_Spaces".
// -----------------------------------------------------------------------------

function sanitize(name) {
  return String(name).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1')
}

function buildAliasMap(headers) {
  const map = {}
  const reverse = {}
  headers.forEach(h => {
    let alias = sanitize(h)
    let n = 2
    while (reverse[alias]) {
      alias = sanitize(h) + '_' + n
      n++
    }
    map[h] = alias
    reverse[alias] = h
  })
  return { forward: map, reverse }
}

function coerce(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isNaN(n) && String(v).trim() !== '') return n
  return String(v)
}

// -----------------------------------------------------------------------------
// Function / operator catalog shown in the UI
// -----------------------------------------------------------------------------

const CATALOG = {
  Operators: [
    { label: '+',  insert: ' + '  },
    { label: '−',  insert: ' - '  },
    { label: '×',  insert: ' * '  },
    { label: '÷',  insert: ' / '  },
    { label: '^',  insert: ' ^ '  },
    { label: '(',  insert: '('    },
    { label: ')',  insert: ')'    },
  ],
  Logic: [
    { label: '>',   insert: ' > '  },
    { label: '<',   insert: ' < '  },
    { label: '>=',  insert: ' >= ' },
    { label: '<=',  insert: ' <= ' },
    { label: '==',  insert: ' == ' },
    { label: '!=',  insert: ' != ' },
    { label: 'and', insert: ' and '},
    { label: 'or',  insert: ' or ' },
    { label: 'not', insert: ' not '},
  ],
  Math: [
    { label: 'abs()',    insert: 'abs()',    caret: -1 },
    { label: 'round()',  insert: 'round()',  caret: -1 },
    { label: 'floor()',  insert: 'floor()',  caret: -1 },
    { label: 'ceil()',   insert: 'ceil()',   caret: -1 },
    { label: 'sqrt()',   insert: 'sqrt()',   caret: -1 },
    { label: 'min(a,b)', insert: 'min(, )',  caret: -3 },
    { label: 'max(a,b)', insert: 'max(, )',  caret: -3 },
    { label: 'log()',    insert: 'log()',    caret: -1 },
    { label: 'exp()',    insert: 'exp()',    caret: -1 },
  ],
  Conditional: [
    { label: 'if(c,a,b)', insert: '( ? : )', caret: -5, desc: 'Use: condition ? true_val : false_val' },
  ],
  Text: [
    { label: 'concat()',    insert: "concat('', '')",   caret: -5 },
    { label: 'substring()', insert: "substring('', 0, 3)", caret: -9 },
    { label: 'length()',    insert: 'length("")',          caret: -2 },
    { label: 'toLower()',   insert: 'toLower("")',         caret: -2 },
    { label: 'toUpper()',   insert: 'toUpper("")',         caret: -2 },
  ],
}

// mathjs doesn't ship substring / toLower / length for strings — register them.
math.import({
  toLower:  (x) => String(x).toLowerCase(),
  toUpper:  (x) => String(x).toUpperCase(),
  substring:(s, start, len) => String(s).substring(start, start + (len ?? String(s).length)),
  // mathjs has `length` but it's matrix length. Override for strings only.
  lengthOf: (x) => (x === null || x === undefined) ? 0 : String(x).length,
  trim: (x) => String(x).trim(),
  concat: (...parts) => parts.map(p => p == null ? '' : String(p)).join(''),
}, { override: true })

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function FormulaBuilder() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [expression, setExpression] = useState('')
  const [outputName, setOutputName] = useState('Computed')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('builder')   // 'builder' | 'ai'
  const [nlPrompt, setNlPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiExplain, setAiExplain] = useState(null)
  const taRef = useRef(null)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
  }, [])

  const aliases = useMemo(() => buildAliasMap(headers), [headers])

  function loadFile(id) {
    setFileId(id)
    setPreview(null); setError(''); setAiExplain(null); setExpression('')
    if (!id) { setHeaders([]); setRows([]); return }
    analyticsApi.preview(id)
      .then(r => {
        setHeaders(r.data.headers || [])
        setRows(r.data.rows || [])
      })
      .catch(() => setError('Could not load the file preview.'))
  }

  // -------- expression editing -----------------------------------------------

  function insertAtCaret(text, caretOffset = 0) {
    const ta = taRef.current
    if (!ta) { setExpression(expression + text); return }
    const start = ta.selectionStart ?? expression.length
    const end = ta.selectionEnd ?? expression.length
    const next = expression.slice(0, start) + text + expression.slice(end)
    setExpression(next)
    const newPos = start + text.length + caretOffset
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(newPos, newPos)
    }, 0)
  }

  // Replace "Column Name" in expression with its alias before evaluation.
  function rewriteWithAliases(expr) {
    let out = expr
    // Replace longest column names first to avoid partial collisions.
    const sorted = [...headers].sort((a, b) => b.length - a.length)
    sorted.forEach(h => {
      if (aliases.forward[h] === h) return  // already safe
      // Word-boundary regex that allows spaces in the column name.
      const esc = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp('(^|[^A-Za-z0-9_])' + esc + '(?=$|[^A-Za-z0-9_])', 'g')
      out = out.replace(re, (m, p1) => p1 + aliases.forward[h])
    })
    return out
  }

  function buildScope(row) {
    const scope = {}
    headers.forEach(h => { scope[aliases.forward[h]] = coerce(row[h]) })
    return scope
  }

  // -------- evaluation -------------------------------------------------------

  function runPreview() {
    setError(''); setPreview(null)
    if (!expression.trim()) { setError('Write or generate a formula first.'); return }
    if (!rows.length) { setError('Choose a file first.'); return }

    let parsed
    try {
      // Compile once so we can reuse across rows.
      parsed = math.compile(rewriteWithAliases(expression))
    } catch (e) {
      setError('Formula syntax error: ' + e.message)
      return
    }

    const N = rows.length
    const allVals = []
    const previewRows = []
    let errorCount = 0
    for (let i = 0; i < N; i++) {
      try {
        const v = parsed.evaluate(buildScope(rows[i]))
        allVals.push(v)
        if (i < 15) previewRows.push({ ...rows[i], [outputName]: v })
      } catch (e) {
        errorCount++
        allVals.push(null)
        if (i < 15) previewRows.push({ ...rows[i], [outputName]: `#ERR` })
      }
    }

    // Stats for the computed column
    const nums = allVals.filter(v => typeof v === 'number' && Number.isFinite(v))
    const stats = nums.length ? {
      type: 'numeric',
      count: nums.length,
      nonNum: N - nums.length,
      min: Math.min(...nums),
      max: Math.max(...nums),
      sum: nums.reduce((a, b) => a + b, 0),
      mean: nums.reduce((a, b) => a + b, 0) / nums.length,
    } : {
      type: 'text',
      count: allVals.filter(v => v !== null && v !== undefined && v !== '').length,
      unique: new Set(allVals.map(v => String(v))).size,
    }

    setPreview({
      rows: previewRows,
      headers: [...headers, outputName],
      stats,
      totalRows: N,
      errorCount,
    })
  }

  // -------- AI layer ---------------------------------------------------------

  async function askAI() {
    if (!nlPrompt.trim() || !fileId) return
    setAiBusy(true); setError(''); setAiExplain(null)
    try {
      const r = await aiApi.formula({ file_id: fileId, description: nlPrompt })
      const data = r.data || r
      if (!data.expression) {
        setError(data.explanation || 'AI could not generate a formula for that request.')
        setAiExplain(data)
        return
      }
      setExpression(data.expression)
      if (data.suggested_column_name) setOutputName(data.suggested_column_name)
      setAiExplain(data)
      setMode('builder')
    } catch (e) {
      const d = e?.response?.data?.detail
      if (d?.code === 'ai_disabled') setError('AI is not enabled on this workspace.')
      else setError(d || e.message || 'AI call failed')
    } finally {
      setAiBusy(false)
    }
  }

  // -------- render -----------------------------------------------------------

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0c1446' }}>Formula Builder</h1>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg,#e91e8c,#0097b2)', padding: '3px 8px',
          borderRadius: 6, letterSpacing: 0.5 }}>MATHJS + AI</span>
      </div>
      <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: '0.9rem' }}>
        Write Excel-style formulas with real operator precedence, conditional logic, and text functions —
        or describe it in plain English and let AI write it for you.
      </p>

      {/* Dataset + mode tabs */}
      <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Dataset
            </label>
            <select value={fileId} onChange={e => loadFile(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value=''>-- Choose a file --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            {headers.length ? `${headers.length} columns · ${rows.length.toLocaleString()} rows` : 'no file loaded'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb' }}>
          {['builder', 'ai'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{
                padding: '10px 18px', background: 'transparent',
                border: 'none', borderBottom: mode === m ? '2px solid #e91e8c' : '2px solid transparent',
                color: mode === m ? '#e91e8c' : '#6b7280',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              }}>
              {m === 'builder' ? 'Formula editor' : 'Ask AI'}
            </button>
          ))}
        </div>
      </div>

      {/* AI mode panel */}
      {mode === 'ai' && (
        <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 20, marginBottom: 18 }}>
          <div style={{ fontWeight: 800, color: '#0c1446', marginBottom: 8, fontSize: '0.95rem' }}>Describe the formula you want</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 12 }}>
            Examples: <em>“Flag customers whose revenue is over 10,000 as high-value”</em> ·
            <em> “revenue minus cost, divided by revenue, as a percentage”</em> ·
            <em> “category in upper case”</em>.
          </div>
          <textarea
            value={nlPrompt}
            onChange={e => setNlPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. if profit margin is above 30%, flag as 'premium', else 'standard'"
            style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
          />
          <button
            onClick={askAI}
            disabled={!nlPrompt.trim() || !fileId || aiBusy}
            style={{
              marginTop: 10, padding: '10px 22px',
              background: (!nlPrompt.trim() || !fileId || aiBusy) ? '#d1d5db' : 'linear-gradient(135deg,#e91e8c,#c4166e)',
              color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem',
              cursor: (!nlPrompt.trim() || !fileId || aiBusy) ? 'not-allowed' : 'pointer',
            }}>
            {aiBusy ? 'Thinking…' : 'Generate formula →'}
          </button>
          {aiExplain?.explanation && (
            <div style={{ marginTop: 14, padding: 12, background: '#effaf9', border: '1px solid #b2e0da',
              borderRadius: 8, fontSize: '0.85rem', color: '#065f46' }}>
              <strong>AI:</strong> {aiExplain.explanation}
              {aiExplain.confidence && (
                <span style={{ marginLeft: 8, fontSize: '0.72rem', textTransform: 'uppercase',
                  opacity: 0.75 }}>({aiExplain.confidence} confidence)</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Builder mode: palette + editor */}
      {mode === 'builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, marginBottom: 18 }}>
          {/* Palette */}
          <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 18 }}>
            <div style={{ fontWeight: 800, color: '#0c1446', marginBottom: 10, fontSize: '0.9rem' }}>Columns</div>
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
              {headers.length ? headers.map(h => (
                <button key={h} onClick={() => insertAtCaret(h)}
                  title={`Inserts: ${aliases.forward[h]}`}
                  style={{
                    padding: '5px 10px', borderRadius: 14, background: '#fdf2f8', color: '#e91e8c',
                    border: '1px solid #fbcfe8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  }}>
                  {h}
                </button>
              )) : <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Load a file to see columns.</span>}
            </div>

            {Object.entries(CATALOG).map(([group, items]) => (
              <div key={group} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                  letterSpacing: 0.5, marginBottom: 6 }}>{group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {items.map(it => (
                    <button key={it.label}
                      onClick={() => insertAtCaret(it.insert, it.caret || 0)}
                      title={it.desc || it.insert}
                      style={{
                        padding: '5px 10px', borderRadius: 6, background: '#f3f4f6',
                        color: '#0c1446', border: '1px solid #e5e7eb',
                        fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'ui-monospace, monospace',
                      }}>
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Expression editor */}
          <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 18 }}>
            <div style={{ fontWeight: 800, color: '#0c1446', marginBottom: 8, fontSize: '0.9rem' }}>Expression</div>
            <textarea
              ref={taRef}
              value={expression}
              onChange={e => setExpression(e.target.value)}
              rows={4}
              placeholder='e.g.  Revenue - Cost     or     Revenue > 10000 ? "High" : "Low"'
              style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.92rem',
                background: '#0c1446', color: '#a5f3fc', resize: 'vertical' }}
            />
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 6 }}>
              Operator precedence, parentheses, conditional expressions and string functions are fully supported.
              Column names with spaces are auto-quoted.
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
              <input
                value={outputName}
                onChange={e => setOutputName(e.target.value)}
                placeholder='Output column name'
                style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}
              />
              <button onClick={() => { setExpression(''); setPreview(null); setError(''); setAiExplain(null) }}
                style={{ padding: '9px 14px', background: '#fff', color: '#6b7280',
                  border: '1px solid #d1d5db', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                Clear
              </button>
              <button onClick={runPreview} disabled={!expression.trim() || !fileId}
                style={{
                  padding: '9px 22px',
                  background: (!expression.trim() || !fileId) ? '#d1d5db' : 'linear-gradient(135deg,#e91e8c,#c4166e)',
                  color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
                  cursor: (!expression.trim() || !fileId) ? 'not-allowed' : 'pointer',
                }}>
                Run preview
              </button>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                padding: '10px 14px', borderRadius: 8, marginTop: 12, fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview + stats */}
      {preview && (
        <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ fontSize: '0.75rem' }}>
              <div style={{ color: '#6b7280', fontWeight: 600 }}>Rows evaluated</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0c1446' }}>
                {preview.totalRows.toLocaleString()}
              </div>
            </div>
            {preview.errorCount > 0 && (
              <div style={{ fontSize: '0.75rem' }}>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Errors</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#dc2626' }}>
                  {preview.errorCount}
                </div>
              </div>
            )}
            {preview.stats.type === 'numeric' && (
              <>
                <StatBlock label='Sum'  value={fmt(preview.stats.sum)} />
                <StatBlock label='Mean' value={fmt(preview.stats.mean)} />
                <StatBlock label='Min'  value={fmt(preview.stats.min)} />
                <StatBlock label='Max'  value={fmt(preview.stats.max)} />
                <StatBlock label='Non-numeric' value={preview.stats.nonNum} />
              </>
            )}
            {preview.stats.type === 'text' && (
              <>
                <StatBlock label='Populated' value={preview.stats.count} />
                <StatBlock label='Distinct'  value={preview.stats.unique} />
              </>
            )}
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #f1f3f9', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {preview.headers.map(h => (
                    <th key={h} style={{
                      padding: '9px 12px', textAlign: 'left', fontWeight: 700,
                      color: h === outputName ? '#e91e8c' : '#4b5563',
                      borderBottom: '1px solid #e5e7eb',
                      background: h === outputName ? '#fdf2f8' : undefined,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {preview.headers.map(h => (
                      <td key={h} style={{
                        padding: '7px 12px',
                        color: h === outputName ? '#e91e8c' : '#374151',
                        fontWeight: h === outputName ? 700 : 400,
                        borderBottom: '1px solid #f3f4f6',
                        background: h === outputName ? '#fdf2f8' : undefined,
                      }}>
                        {fmtCell(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#9ca3af' }}>
            Preview shows the first 15 rows — stats above cover the full {preview.totalRows.toLocaleString()} rows.
          </div>
        </div>
      )}

      {!preview && !error && (
        <div style={{ textAlign: 'center', padding: 50, color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>∑</div>
          <div>Build or describe a formula, then click <strong>Run preview</strong>.</div>
        </div>
      )}
    </div>
  )
}

function StatBlock({ label, value }) {
  return (
    <div style={{ fontSize: '0.75rem' }}>
      <div style={{ color: '#6b7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0c1446',
        fontFamily: 'ui-monospace, monospace' }}>
        {value}
      </div>
    </div>
  )
}

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (typeof n !== 'number') return String(n)
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function fmtCell(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return fmt(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}
