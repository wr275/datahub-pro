import React, { useState, useEffect } from 'react'
import { filesApi, analyticsApi } from '../api'

export default function ConditionalFormat() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [rules, setRules] = useState([
    { col: '', op: 'gt', value: '', bg: '#dcfce7', text: '#166534', label: 'High' },
    { col: '', op: 'lt', value: '', bg: '#fee2e2', text: '#991b1b', label: 'Low' }
  ])
  const [result, setResult] = useState(null)

  useEffect(() => { filesApi.list().then(r => setFiles(r.data || [])).catch(() => {}) }, [])

  function loadFile(id) {
    setFileId(id); setResult(null)
    if (!id) return
    analyticsApi.preview(id).then(r => { setHeaders(r.data.headers || []); setRows(r.data.rows || []) }).catch(() => {})
  }

  function updateRule(i, field, val) { const u = [...rules]; u[i] = { ...u[i], [field]: val }; setRules(u) }
  function addRule() { setRules([...rules, { col: '', op: 'gt', value: '', bg: '#fef9c3', text: '#854d0e', label: 'Medium' }]) }
  function removeRule(i) { setRules(rules.filter((_, idx) => idx !== i)) }

  function getCellStyle(col, val) {
    for (const rule of rules) {
      if (!rule.col || rule.col !== col) continue
      const v = parseFloat(val); const rv = parseFloat(rule.value)
      let match = false
      if (rule.op === 'gt' && v > rv) match = true
      else if (rule.op === 'gte' && v >= rv) match = true
      else if (rule.op === 'lt' && v < rv) match = true
      else if (rule.op === 'lte' && v <= rv) match = true
      else if (rule.op === 'eq' && String(val) === String(rule.value)) match = true
      else if (rule.op === 'contains' && String(val).toLowerCase().includes(String(rule.value).toLowerCase())) match = true
      if (match) return { background: rule.bg, color: rule.text, fontWeight: 700 }
    }
    return {}
  }

  function apply() {
    if (!rows.length) return
    setResult({ rows: rows.slice(0, 100), headers })
  }

  const presets = [
    { label: 'Red-Yellow-Green', rules: [{ col: rules[0]?.col || '', op: 'gt', value: '75', bg: '#dcfce7', text: '#166534', label: 'High' }, { col: rules[0]?.col || '', op: 'lt', value: '25', bg: '#fee2e2', text: '#991b1b', label: 'Low' }, { col: rules[0]?.col || '', op: 'gte', value: '25', bg: '#fef9c3', text: '#854d0e', label: 'Medium' }] },
    { label: 'Blue Scale', rules: [{ col: rules[0]?.col || '', op: 'gt', value: '80', bg: '#1e40af', text: '#fff', label: 'Very High' }, { col: rules[0]?.col || '', op: 'gt', value: '60', bg: '#3b82f6', text: '#fff', label: 'High' }, { col: rules[0]?.col || '', op: 'gt', value: '40', bg: '#93c5fd', text: '#1e40af', label: 'Med' }] },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Conditional Formatting</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Apply colour-based rules to highlight patterns in your data</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>File</div>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}>
              <option value="">-- Choose --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Quick Presets</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {presets.map(p => <button key={p.label} onClick={() => setRules(p.rules)} style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', color: '#374151' }}>{p.label}</button>)}
          </div>
          <button onClick={apply} disabled={!fileId} style={{ width: '100%', padding: '10px', background: fileId ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: fileId ? 'pointer' : 'default' }}>Apply Formatting</button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Formatting Rules</div>
          {rules.map((rule, i) => (
            <div key={i} style={{ marginBottom: 12, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <select value={rule.col} onChange={e => updateRule(i, 'col', e.target.value)} style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.82rem' }}>
                  <option value="">-- Column --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <select value={rule.op} onChange={e => updateRule(i, 'op', e.target.value)} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.82rem' }}>
                  {[['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['eq', '='], ['contains', '∋']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)} placeholder="value" style={{ width: 70, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.82rem' }} />
                {rules.length > 1 && <button onClick={() => removeRule(i)} style={{ padding: '6px 8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>BG:</span>
                <input type="color" value={rule.bg} onChange={e => updateRule(i, 'bg', e.target.value)} style={{ width: 30, height: 26, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }} />
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 4 }}>Text:</span>
                <input type="color" value={rule.text} onChange={e => updateRule(i, 'text', e.target.value)} style={{ width: 30, height: 26, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }} />
                <div style={{ width: 60, padding: '4px 8px', borderRadius: 4, background: rule.bg, color: rule.text, fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', marginLeft: 4 }}>{rule.label}</div>
                <input value={rule.label} onChange={e => updateRule(i, 'label', e.target.value)} style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem' }} placeholder="Label" />
              </div>
            </div>
          ))}
          <button onClick={addRule} style={{ padding: '6px 14px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem' }}>+ Add Rule</button>
        </div>
      </div>

      {result && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, color: '#0c1446' }}>Formatted Preview (first 100 rows)</div>
          <div style={{ overflowX: 'auto', maxHeight: 500 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead><tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>{result.headers.map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {result.headers.map(h => {
                      const style = getCellStyle(h, row[h])
                      return <td key={h} style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', ...style }}>{row[h] ?? '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}><div style={{ fontSize: '2rem', marginBottom: 12 }}>🎨</div><div>Set up rules and click Apply Formatting</div></div>}
    </div>
  )
}
