import React, { useState, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import OpenInAskYourData from '../components/ui/OpenInAskYourData'
import PinToDashboard from '../components/ui/PinToDashboard'

export default function BreakEvenCalculator() {
  const [fixedCosts, setFixedCosts] = useState('')
  const [varCostPerUnit, setVarCostPerUnit] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [result, setResult] = useState(null)
  const chartRef = useRef(null)

  function calculate() {
    const fc = parseFloat(fixedCosts) || 0
    const vc = parseFloat(varCostPerUnit) || 0
    const p = parseFloat(pricePerUnit) || 0
    if (p <= vc) { setResult({ error: 'Price per unit must be greater than variable cost per unit.' }); return }
    const contributionMargin = p - vc
    const bepUnits = fc / contributionMargin
    const bepRevenue = bepUnits * p
    const maxUnits = Math.ceil(bepUnits * 2.5)
    const chartData = []
    for (let u = 0; u <= maxUnits; u += Math.max(1, Math.ceil(maxUnits / 30))) {
      chartData.push({
        units: u,
        revenue: parseFloat((u * p).toFixed(2)),
        totalCost: parseFloat((fc + u * vc).toFixed(2)),
        profit: parseFloat((u * p - fc - u * vc).toFixed(2))
      })
    }
    setResult({ fc, vc, p, contributionMargin: parseFloat(contributionMargin.toFixed(2)), bepUnits: parseFloat(bepUnits.toFixed(0)), bepRevenue: parseFloat(bepRevenue.toFixed(2)), marginPct: parseFloat((contributionMargin / p * 100).toFixed(1)), chartData })
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Break-Even Calculator</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Calculate your break-even point and visualize profitability thresholds</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
          {[
            ['Fixed Costs ($)', fixedCosts, setFixedCosts, 'e.g. 50000', 'Total costs that don\'t vary with output (rent, salaries, etc.)'],
            ['Variable Cost per Unit ($)', varCostPerUnit, setVarCostPerUnit, 'e.g. 15', 'Cost to produce each additional unit'],
            ['Price per Unit ($)', pricePerUnit, setPricePerUnit, 'e.g. 40', 'Selling price for each unit']
          ].map(([label, val, setter, placeholder, hint]) => (
            <div key={label}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>
              <input type="number" value={val} onChange={e => setter(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>{hint}</div>
            </div>
          ))}
        </div>
        <button onClick={calculate} disabled={!fixedCosts || !varCostPerUnit || !pricePerUnit} style={{ padding: '10px 28px', background: fixedCosts && varCostPerUnit && pricePerUnit ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: fixedCosts && varCostPerUnit && pricePerUnit ? 'pointer' : 'default' }}>Calculate Break-Even</button>
      </div>

      {result?.error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: 16, borderRadius: 10, marginBottom: 20 }}>{result.error}</div>}

      {result && !result.error && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <PinToDashboard
              widget={{
                type: 'kpi',
                col: 'break_even_units',
                label: `Break-even: ${result.bepUnits.toLocaleString()} units`,
                file_id: null,
                extra: { fc: result.fc, vc: result.vc, p: result.p, bepUnits: result.bepUnits, bepRevenue: result.bepRevenue, marginPct: result.marginPct },
              }}
            />
            <ExportMenu data={result.chartData} filename="break-even" containerRef={chartRef} title="Break-Even Analysis" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              ['Break-Even Units', result.bepUnits.toLocaleString(), '#e91e8c'],
              ['Break-Even Revenue', '$' + result.bepRevenue.toLocaleString(), '#0097b2'],
              ['Contribution Margin', '$' + result.contributionMargin, '#10b981'],
              ['Margin %', result.marginPct + '%', '#f59e0b']
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `4px solid ${color}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>

          <div ref={chartRef} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 4 }}>Break-Even Analysis Chart</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 16 }}>Where Revenue line crosses Total Cost line = Break-Even Point ({result.bepUnits.toLocaleString()} units)</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={result.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="units" tick={{ fontSize: 11 }} label={{ value: 'Units', position: 'insideBottom', offset: -5, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => '$' + v.toLocaleString()} />
                <Legend />
                <ReferenceLine x={result.bepUnits} stroke="#e91e8c" strokeDasharray="6 3" label={{ value: 'BEP', position: 'top', fontSize: 11, fill: '#e91e8c' }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="totalCost" stroke="#ef4444" strokeWidth={2} dot={false} name="Total Cost" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 12 }}>Interpretation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['You need to sell', `${result.bepUnits.toLocaleString()} units`, 'to cover all costs'],
                ['Each unit sold above BEP', `$${result.contributionMargin}`, 'goes straight to profit'],
                ['At 2x BEP production', `$${(result.bepRevenue).toLocaleString()}`, 'profit generated'],
                ['Contribution margin ratio', `${result.marginPct}%`, 'of each sale covers fixed costs']
              ].map(([label, val, suffix]) => (
                <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{label}</div>
                  <div style={{ fontWeight: 800, color: '#0c1446', fontSize: '1.1rem' }}>{val}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{suffix}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!result && (
        <EmptyState
          icon="💰"
          title="Enter cost and pricing data"
          body="Fill in fixed costs, variable cost per unit, and selling price. We'll show units to break even, contribution margin, and a profitability chart."
        />
      )}
    </div>
  )
}
