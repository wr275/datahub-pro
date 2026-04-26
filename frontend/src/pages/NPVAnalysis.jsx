import React, { useState, useEffect, useRef } from 'react'
import { filesApi, analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

function calcNPV(rate, cashflows) {
  return cashflows.reduce(function(acc, cf, i) {
    return acc + cf / Math.pow(1 + rate, i)
  }, 0)
}

function calcIRR(cashflows) {
  var lo = -0.999; var hi = 100; var mid; var i
  for (i = 0; i < 200; i++) {
    mid = (lo + hi) / 2
    if (calcNPV(mid, cashflows) > 0) lo = mid
    else hi = mid
  }
  var result = mid * 100
  if (isNaN(result) || !isFinite(result) || result < -99 || result > 9999) return null
  return result
}

function calcPayback(cashflows) {
  var cum = 0
  for (var i = 1; i < cashflows.length; i++) {
    cum += cashflows[i]
    if (cum >= -cashflows[0]) return i
  }
  return null
}

var inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }
var labelStyle = { fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5, display: 'block' }

export default function NPVAnalysis() {
  const [mode, setMode] = useState('manual')
  const [investment, setInvestment] = useState('')
  const [rate, setRate] = useState('10')
  const [cashFlows, setCashFlows] = useState(['', '', '', '', ''])
  const [result, setResult] = useState(null)

  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [cfCol, setCfCol] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [fileResult, setFileResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(function() {
    filesApi.list().then(function(r) { setFiles(r.data || []) }).catch(function() {})
  }, [])

  function onFileChange(id) {
    setFileId(id); setHeaders([]); setFileResult(null); setCfCol(''); setError('')
    if (!id) return
    setPreviewLoading(true)
    analyticsApi.preview(id)
      .then(function(r) { setHeaders(r.data.headers || []) })
      .catch(function() { setError('Could not load file columns.') })
      .finally(function() { setPreviewLoading(false) })
  }

  function runManual() {
    var inv = parseFloat(investment)
    if (isNaN(inv) || inv <= 0) { setResult(null); return }
    var r = parseFloat(rate) / 100
    var cfs = cashFlows.map(function(v) { return parseFloat(v) || 0 })
    var nonZero = cfs.filter(function(v) { return v !== 0 })
    if (nonZero.length === 0) { setResult(null); return }
    var allCFs = [-inv].concat(cfs)
    var npv = calcNPV(r, allCFs)
    var irr = calcIRR(allCFs)
    var payback = calcPayback(allCFs)
    setResult({ npv: npv, irr: irr, payback: payback, cashflows: allCFs })
  }

  function runFile() {
    if (!fileId || !cfCol) return
    analyticsApi.preview(fileId)
      .then(function(r) {
        var rows = r.data.rows || []
        var cfs = rows.map(function(row) { return parseFloat(row[cfCol]) || 0 })
        if (cfs.length < 2) { setError('Not enough rows for NPV calculation.'); return }
        var r2 = parseFloat(rate) / 100
        var npv = calcNPV(r2, cfs)
        var irr = calcIRR(cfs)
        var payback = calcPayback(cfs)
        setFileResult({ npv: npv, irr: irr, payback: payback, cashflows: cfs.slice(0, 30) })
        setError('')
      })
      .catch(function() { setError('Analysis failed. Please check the file and column.') })
  }

  function updateCF(i, val) {
    setCashFlows(function(prev) {
      var next = prev.slice()
      next[i] = val
      return next
    })
    setResult(null)
  }

  function addYear() { setCashFlows(function(p) { return p.concat(['']) }) }
  function removeYear(i) { setCashFlows(function(p) { return p.filter(function(_, idx) { return idx !== i }) }) }

  var activeResult = mode === 'manual' ? result : fileResult
  var chartData = activeResult ? activeResult.cashflows.map(function(cf, i) {
    return { period: i === 0 ? 'Initial' : 'Y' + i, value: cf, positive: cf >= 0 }
  }) : []
  var chartRef = useRef(null)

  var cum = 0
  var cumulativeData = activeResult ? activeResult.cashflows.map(function(cf, i) {
    cum += cf
    return { period: i === 0 ? 'Initial' : 'Y' + i, cumulative: parseFloat(cum.toFixed(2)) }
  }) : []

  function fmt(n) {
    if (n == null || isNaN(n)) return 'N/A'
    return (n < 0 ? '-' : '') + '\u00A3' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  var tabStyle = function(active) {
    return { padding: '8px 20px', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', background: active ? '#0c1446' : '#f3f4f6', color: active ? '#fff' : '#6b7280' }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>NPV / Financial Analysis</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.95rem' }}>Calculate Net Present Value, IRR and Payback Period for investment decisions</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={tabStyle(mode === 'manual')} onClick={function() { setMode('manual'); setFileResult(null) }}>Manual Entry</button>
        <button style={tabStyle(mode === 'file')} onClick={function() { setMode('file'); setResult(null) }}>From File</button>
      </div>

      {mode === 'manual' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 20 }}>Input Parameters</div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Initial Investment ({'\u00A3'})</label>
              <input type="number" value={investment} onChange={function(e) { setInvestment(e.target.value); setResult(null) }} placeholder="e.g. 100000" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Discount Rate (%)</label>
              <input type="number" value={rate} onChange={function(e) { setRate(e.target.value); setResult(null) }} placeholder="e.g. 10" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Annual Cash Flows ({'\u00A3'})</div>
              {cashFlows.map(function(cf, i) {
                return (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', width: 44, flexShrink: 0 }}>Year {i + 1}</div>
                    <input type="number" value={cf} onChange={function(e) { updateCF(i, e.target.value) }} placeholder="0" style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }} />
                    {cashFlows.length > 1 && (
                      <button onClick={function() { removeYear(i) }} style={{ padding: '4px 8px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>x</button>
                    )}
                  </div>
                )
              })}
              <button onClick={addYear} style={{ fontSize: '0.82rem', color: '#0097b2', background: 'none', border: '1px dashed #0097b2', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', marginTop: 4 }}>+ Add Year</button>
            </div>

            <button onClick={runManual}
              style={{ width: '100%', padding: '11px', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
              Calculate
            </button>
          </div>

          <div>
            {result && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                  <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid ' + (result.npv >= 0 ? '#10b981' : '#ef4444') }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Net Present Value</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: result.npv >= 0 ? '#10b981' : '#ef4444', marginTop: 6 }}>{fmt(result.npv)}</div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>{result.npv >= 0 ? 'Positive - investment creates value' : 'Negative - investment destroys value'}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid #0097b2' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Internal Rate of Return</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0097b2', marginTop: 6 }}>{result.irr != null ? result.irr.toFixed(1) + '%' : 'N/A'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>{result.irr != null ? (result.irr > parseFloat(rate) ? 'Exceeds hurdle rate' : 'Below hurdle rate') : 'Could not converge'}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Payback Period</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: 6 }}>{result.payback != null ? result.payback + ' yr' + (result.payback > 1 ? 's' : '') : 'Not recovered'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>Time to recover initial investment</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
                  <OpenInAskYourData
                    fileId={fileId}
                    prompt={`We modelled an NPV of ${fmt(result.npv)} at a ${rate}% discount rate, IRR of ${result.irr != null ? result.irr.toFixed(1) + '%' : 'N/A'}, payback ${result.payback != null ? result.payback + ' years' : 'never'}. What sensitivities should we stress-test before approving this?`}
                  />
                  <PinToDashboard
                    widget={{
                      type: 'kpi',
                      col: 'npv',
                      label: `NPV @ ${rate}% — ${fmt(result.npv)}`,
                      file_id: fileId || null,
                      extra: { rate, npv: result.npv, irr: result.irr, payback: result.payback },
                    }}
                  />
                  <ExportMenu data={chartData} filename="npv-cashflows" containerRef={chartRef} title="NPV — Cash Flow Waterfall" />
                </div>
                <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0c1446', marginBottom: 16 }}>Cash Flow Waterfall</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={function(v) { return '\u00A3' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(0) + 'k' : v) }} />
                      <Tooltip formatter={function(v) { return [fmt(v), 'Cash Flow'] }} />
                      <ReferenceLine y={0} stroke="#374151" />
                      <Bar dataKey="value" radius={[4,4,0,0]}>
                        {chartData.map(function(entry, i) {
                          return <Cell key={i} fill={entry.positive ? '#10b981' : '#ef4444'} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!result && (
              <EmptyState
                icon="💰"
                title="Enter your inputs to calculate"
                body="Fill in the initial investment, discount rate, and annual cash flows then click Calculate. We'll compute NPV, IRR, and payback period."
              />
            )}
          </div>
        </div>
      )}

      {mode === 'file' && (
        <div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <div style={labelStyle}>File (each row = one period)</div>
                <select value={fileId} onChange={function(e) { onFileChange(e.target.value) }}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', background: '#fff' }}>
                  <option value="">-- Choose a file --</option>
                  {files.map(function(f) { return <option key={f.id} value={f.id}>{f.filename}</option> })}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Cash flow column</div>
                <select value={cfCol} onChange={function(e) { setCfCol(e.target.value) }}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', background: '#fff' }} disabled={!headers.length}>
                  <option value="">-- Select --</option>
                  {headers.map(function(h) { return <option key={h} value={h}>{h}</option> })}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Discount Rate (%)</div>
                <input type="number" value={rate} onChange={function(e) { setRate(e.target.value) }} style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} />
              </div>
              <button onClick={runFile} disabled={!fileId || !cfCol}
                style={{ padding: '10px 24px', background: (fileId && cfCol) ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: (fileId && cfCol) ? 'pointer' : 'default' }}>
                Calculate
              </button>
            </div>
            {previewLoading && <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#6b7280' }}>Loading columns...</div>}
          </div>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 14, borderRadius: 8, color: '#dc2626', fontSize: '0.875rem', marginBottom: 20 }}>{error}</div>}

          {fileResult && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid ' + (fileResult.npv >= 0 ? '#10b981' : '#ef4444') }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Net Present Value</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: fileResult.npv >= 0 ? '#10b981' : '#ef4444', marginTop: 6 }}>{fmt(fileResult.npv)}</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>{fileResult.npv >= 0 ? 'Positive - investment creates value' : 'Negative - investment destroys value'}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid #0097b2' }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Internal Rate of Return</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0097b2', marginTop: 6 }}>{fileResult.irr != null ? fileResult.irr.toFixed(1) + '%' : 'N/A'}</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>{fileResult.irr != null ? (fileResult.irr > parseFloat(rate) ? 'Exceeds hurdle rate' : 'Below hurdle rate') : 'Could not converge'}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid #f59e0b' }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Payback Period</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: 6 }}>{fileResult.payback != null ? fileResult.payback + ' period' + (fileResult.payback > 1 ? 's' : '') : 'Not recovered'}</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>Periods to recover initial outflow</div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0c1446', marginBottom: 16 }}>Cash Flow Chart (first 30 periods)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={0} stroke="#374151" />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {chartData.map(function(entry, i) {
                        return <Cell key={i} fill={entry.positive ? '#10b981' : '#ef4444'} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
