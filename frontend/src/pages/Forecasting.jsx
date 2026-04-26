import React, { useState, useEffect, useMemo } from 'react'
import { filesApi, analyticsApi } from '../api'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import DateRangePicker from '../components/ui/DateRangePicker'

// -----------------------------------------------------------------------------
// Forecasting 2.0
// Backend runs Holt-Winters / Holt / SES / Linear, picks best via backtest,
// and returns 80% + 95% prediction intervals. Frontend just renders.
// -----------------------------------------------------------------------------

const METHOD_OPTS = [
  { value: 'auto',         label: 'Auto-pick',         desc: 'Let the backtest choose' },
  { value: 'holt_winters', label: 'Holt-Winters',      desc: 'Trend + seasonality' },
  { value: 'holt',         label: 'Holt',              desc: 'Linear trend' },
  { value: 'ses',          label: 'Exponential',       desc: 'Flat + recency-weighted' },
  { value: 'linear',       label: 'Linear regression', desc: 'Simple line fit' },
]

const AGG_OPTS = [
  { value: 'auto',      label: 'Auto' },
  { value: 'daily',     label: 'Daily' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

const fmtNum = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function Forecasting() {
  const [files, setFiles] = useState([])
  const [fileId, setFileId] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [valCol, setValCol] = useState('')
  const [dateRange, setDateRange] = useState(null)   // { date_column, from, to, preset }
  const dateCol = dateRange?.date_column || ''
  const [method, setMethod] = useState('auto')
  const [agg, setAgg] = useState('auto')
  const [periods, setPeriods] = useState(6)
  const [showCI, setShowCI] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    filesApi.list().then(r => setFiles(r.data || [])).catch(() => {})
  }, [])

  function loadFile(id) {
    setFileId(id); setResult(null); setValCol(''); setDateRange(null); setError('')
    if (!id) { setHeaders([]); setRows([]); return }
    analyticsApi.preview(id).then(r => {
      setHeaders(r.data.headers || [])
      setRows(r.data.rows || [])
    }).catch(() => setError('Could not load file preview'))
  }

  // Heuristic column detection: numeric vs date
  const { numericCols, dateCols } = useMemo(() => {
    if (!rows.length) return { numericCols: [], dateCols: [] }
    const sample = rows.slice(0, 50)
    const nums = [], dates = []
    for (const h of headers) {
      const vals = sample.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== '')
      if (!vals.length) continue
      const numHits = vals.filter(v => !isNaN(parseFloat(v))).length
      const dateHits = vals.filter(v => {
        const s = String(v)
        return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(s) || !isNaN(Date.parse(s))
      }).length
      if (numHits / vals.length > 0.8) nums.push(h)
      if (dateHits / vals.length > 0.7 && !/^\d+(\.\d+)?$/.test(String(vals[0]))) dates.push(h)
    }
    return { numericCols: nums, dateCols: dates }
  }, [headers, rows])

  async function run() {
    if (!fileId || !valCol || loading) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await analyticsApi.forecast(fileId, {
        value_column: valCol,
        date_column: dateCol || null,
        // New optional fields the backend may or may not honour yet — forwards-compatible.
        from: dateRange?.from || null,
        to:   dateRange?.to   || null,
        periods,
        method,
        aggregation: agg,
      })
      setResult(r.data)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Forecast failed')
    } finally {
      setLoading(false)
    }
  }

  // Combine historical + forecast into one series for Recharts
  const chartData = useMemo(() => {
    if (!result) return []
    const hist = result.historical.map(p => ({
      label: p.label, actual: p.value,
    }))
    const fut = result.forecast.map(p => ({
      label: p.label,
      forecast: p.forecast,
      band80: [p.lower_80, p.upper_80],
      band95: [p.lower_95, p.upper_95],
    }))
    // Bridge: last actual also carries forecast value so the line connects
    if (hist.length && fut.length) {
      hist[hist.length - 1].forecast = hist[hist.length - 1].actual
    }
    return [...hist, ...fut]
  }, [result])

  const nowIdx = result ? result.historical.length - 1 : 0

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0c1446' }}>Forecasting</h1>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg,#e91e8c,#0097b2)', padding: '3px 8px',
          borderRadius: 6, letterSpacing: 0.5,
        }}>HOLT-WINTERS · CI BANDS</span>
      </div>
      <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: '0.9rem' }}>
        Project future values with seasonality-aware models and proper 80% / 95% confidence intervals.
      </p>

      <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12, marginBottom: 12 }}>
          <Field label='Dataset'>
            <select value={fileId} onChange={e => loadFile(e.target.value)} style={selectStyle}>
              <option value=''>-- Choose a file --</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}
            </select>
          </Field>
          <Field label='Value column'>
            <select value={valCol} onChange={e => setValCol(e.target.value)} style={selectStyle} disabled={!numericCols.length}>
              <option value=''>-- Numeric column --</option>
              {numericCols.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label='Aggregation'>
            <select value={agg} onChange={e => setAgg(e.target.value)} style={selectStyle} disabled={!dateCol}>
              {AGG_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Date range — drives both the date column AND the optional date filter
            sent to the forecast endpoint. Header order is preserved when the
            heuristic detects a date column, so the user can always override. */}
        {headers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <DateRangePicker
              columns={headers}
              dateColumns={dateCols}
              value={dateRange}
              onChange={setDateRange}
              storageKey="forecasting.dateRange"
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, alignItems: 'end' }}>
          <Field label='Method'>
            <select value={method} onChange={e => setMethod(e.target.value)} style={selectStyle}>
              {METHOD_OPTS.map(o => <option key={o.value} value={o.value} title={o.desc}>{o.label}</option>)}
            </select>
          </Field>
          <Field label={`Periods ahead: ${periods}`}>
            <input type='range' min={1} max={24} value={periods} onChange={e => setPeriods(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: '#e91e8c' }} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#374151', fontWeight: 600 }}>
            <input type='checkbox' checked={showCI} onChange={e => setShowCI(e.target.checked)} />
            Show confidence bands
          </label>
          <button onClick={run} disabled={!valCol || loading}
            style={{
              padding: '10px 22px',
              background: (!valCol || loading) ? '#d1d5db' : 'linear-gradient(135deg,#e91e8c,#c4166e)',
              color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
              cursor: (!valCol || loading) ? 'not-allowed' : 'pointer',
            }}>
            {loading ? 'Forecasting…' : 'Generate forecast'}
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
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0c1446' }}>Fitting models…</div>
          <div style={{ fontSize: '0.82rem', marginTop: 4 }}>Backtesting 3–4 methods to pick the best.</div>
        </div>
      )}

      {result && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
            <Kpi label='Last actual'     value={fmtNum(result.summary.last_actual)}     color='#0c1446' />
            <Kpi label='Next forecast'   value={fmtNum(result.summary.next_forecast)}  color='#e91e8c' />
            <Kpi label='Backtest MAPE'   value={result.summary.mape === Infinity || !isFinite(result.summary.mape) ? '—' : result.summary.mape + '%'} color='#0097b2'
              hint={`Hold-out: last ${result.hold_out} periods`} />
            <Kpi label='Model'           value={result.method_label} color='#7c3aed'
              hint={result.season_length ? `Season length: ${result.season_length}` : (result.aggregation !== 'index' ? `Aggregation: ${result.aggregation}` : '')} />
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, color: '#0c1446', fontSize: '1.02rem' }}>
                Historical + {result.periods}-period forecast
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                n = {result.n_points} · trend {result.summary.trend_direction} ({result.summary.trend_pct > 0 ? '+' : ''}{result.summary.trend_pct}%)
              </div>
            </div>
            <ResponsiveContainer width='100%' height={340}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f3f4f6' />
                <XAxis dataKey='label' tick={{ fontSize: 10 }} interval='preserveStartEnd' minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtNum} />
                <Tooltip formatter={(v) => typeof v === 'number' ? fmtNum(v) : v} />
                <Legend wrapperStyle={{ fontSize: '0.82rem' }} />
                {showCI && (
                  <Area type='monotone' dataKey='band95' name='95% CI'
                    stroke='none' fill='#e91e8c' fillOpacity={0.09} isAnimationActive={false} />
                )}
                {showCI && (
                  <Area type='monotone' dataKey='band80' name='80% CI'
                    stroke='none' fill='#e91e8c' fillOpacity={0.17} isAnimationActive={false} />
                )}
                <Line type='monotone' dataKey='actual' name='Actual' stroke='#0097b2' strokeWidth={2.2}
                  dot={{ r: 2.5 }} connectNulls={false} />
                <Line type='monotone' dataKey='forecast' name='Forecast' stroke='#e91e8c' strokeWidth={2.2}
                  dot={{ r: 3 }} strokeDasharray='5 4' connectNulls={false} />
                {result.historical.length > 0 && (
                  <ReferenceLine x={result.historical[result.historical.length - 1].label}
                    stroke='#9ca3af' strokeDasharray='3 3'
                    label={{ value: 'now', fontSize: 10, fill: '#6b7280' }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, color: '#0c1446', marginBottom: 10 }}>Model comparison</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 8 }}>
                Backtested by withholding the last {result.hold_out} periods, training on the rest, and measuring error.
                Lower MAPE is better.
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.72rem', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    <th style={{ padding: '6px 8px', borderBottom: '1px solid #e8eaf4' }}>Method</th>
                    <th style={{ padding: '6px 8px', borderBottom: '1px solid #e8eaf4', textAlign: 'right' }}>MAPE</th>
                    <th style={{ padding: '6px 8px', borderBottom: '1px solid #e8eaf4', textAlign: 'right' }}>RMSE</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.backtest).map(([m, v]) => {
                    const active = m === result.method
                    return (
                      <tr key={m} style={{ background: active ? '#fdf2f8' : 'transparent' }}>
                        <td style={{ padding: '7px 8px', fontWeight: active ? 800 : 500, color: active ? '#e91e8c' : '#0c1446' }}>
                          {METHOD_OPTS.find(o => o.value === m)?.label || m}
                          {active && <span style={{ marginLeft: 6, fontSize: '0.7rem' }}>✓ chosen</span>}
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {isFinite(v.mape) ? v.mape + '%' : '—'}
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>
                          {isFinite(v.rmse) ? fmtNum(v.rmse) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, color: '#0c1446', marginBottom: 10 }}>Next {result.periods} periods</div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
                    <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.7rem', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid #e8eaf4' }}>Period</th>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid #e8eaf4', textAlign: 'right' }}>Forecast</th>
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid #e8eaf4', textAlign: 'right' }}>80% range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.forecast.map((f, i) => (
                      <tr key={i}>
                        <td style={{ padding: '6px 8px', color: '#374151' }}>{f.label}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#e91e8c', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtNum(f.forecast)}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem' }}>
                          {fmtNum(f.lower_80)} – {fmtNum(f.upper_80)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📈</div>
          <div>Pick a file and a numeric value column, then click <strong>Generate forecast</strong>.</div>
          <div style={{ fontSize: '0.8rem', marginTop: 6 }}>Add a date column for seasonality-aware modelling.</div>
        </div>
      )}
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

function Kpi({ label, value, color, hint }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 12, padding: 14, borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color, lineHeight: 1.25 }}>{value}</div>
      {hint && <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

const selectStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.9rem', background: '#fff',
}
