import { useState, useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────
   DataHub Pro — Product Demo Player  v3
   Visual style: light/warm theme matching the real app.
   8 screens: Exec Dashboard → Pivot Table → RFM → Forecast →
              Cohort → Churn → AI Insights → KPI
───────────────────────────────────────────────────────────── */

const SCREENS = [
  { id: 'exec',    label: 'Executive Dashboard', duration: 6000 },
  { id: 'pivot',   label: 'Pivot Table',         duration: 6000 },
  { id: 'rfm',     label: 'RFM Segmentation',    duration: 5500 },
  { id: 'forecast',label: 'Revenue Forecast',    duration: 5500 },
  { id: 'cohort',  label: 'Cohort Analysis',     duration: 5500 },
  { id: 'churn',   label: 'Churn Risk Analysis', duration: 5000 },
  { id: 'ai',      label: 'AI Insights',         duration: 7000 },
  { id: 'kpi',     label: 'KPI Dashboard',       duration: 5000 },
];

const NAV = [
  { icon: '📊', label: 'Executive Dashboard', screen: 'exec' },
  { icon: '🔢', label: 'Pivot Table',         screen: 'pivot' },
  { icon: '🎯', label: 'RFM Segmentation',    screen: 'rfm' },
  { icon: '📈', label: 'Revenue Forecast',    screen: 'forecast' },
  { icon: '🔁', label: 'Cohort Analysis',     screen: 'cohort' },
  { icon: '⚠️', label: 'Churn Analysis',      screen: 'churn' },
  { icon: '🤖', label: 'AI Insights',         screen: 'ai' },
  { icon: '📋', label: 'KPI Dashboard',       screen: 'kpi' },
  { icon: '🔀', label: 'Data Blending',       screen: null },
  { icon: '💬', label: 'Ask Your Data',       screen: null },
];

const AI_TEXT = `Revenue is up 18.4% quarter-on-quarter, driven by the Analytics Pro product line (52% of revenue). Sarah Chen accounts for 47% of all sales — this concentration is a risk worth managing.\n\nYour 8 Champion-tier customers haven't been offered the Data Suite product. Based on their order history, cross-sell potential is £8,000–£12,000.\n\nImmediate action: BrightStar Inc and Delta Systems haven't purchased in 90+ days. Both are historically high-value. Outreach this week could recover £4,200 in at-risk ARR.`;

// ─── AnimNumber ──────────────────────────────────────────────
function AnimNumber({ target, prefix = '', suffix = '', duration = 1200, delay = 0 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const t = setTimeout(() => {
      const step = (ts) => {
        if (!start) start = ts;
        const pct = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - pct, 3);
        setVal(Math.round(ease * target));
        if (pct < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(t);
  }, [target, duration, delay]);
  return <span>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ─── Shared card ─────────────────────────────────────────────
const C = ({ children, style }) => (
  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e4e0', padding: '18px 20px', ...style }}>
    {children}
  </div>
);

// ─── SVG Area Chart (light theme) ────────────────────────────
function AreaChart({ data, color = '#f59e0b', height = 90, width = 400 }) {
  const pad = { l: 6, r: 6, t: 10, b: 4 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(...data);
  const min = Math.min(...data) * 0.95;
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    pad.l + (i / (data.length - 1)) * w,
    pad.t + h - ((v - min) / range) * h,
  ]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${(pad.t + h).toFixed(1)} L${pts[0][0].toFixed(1)},${(pad.t + h).toFixed(1)} Z`;
  const gid = `ag${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => i === pts.length - 1 ? (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={color} stroke="#fff" strokeWidth="1.5" />
      ) : null)}
    </svg>
  );
}

// ─── SVG Donut (light theme) ──────────────────────────────────
function DonutChart({ slices, size = 100 }) {
  const r = 36; const cx = size / 2; const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((sl, i) => {
        const dash = (sl.value / total) * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={sl.color} strokeWidth="16"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })}
      <circle cx={cx} cy={cy} r="26" fill="#fff" />
    </svg>
  );
}

// ─── Sparkline (bar style, light) ────────────────────────────
function SparkBars({ data, up = true }) {
  const max = Math.max(...data);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
      {data.map((v, j) => (
        <div key={j} style={{
          flex: 1,
          background: up ? '#f59e0b' : '#ef4444',
          borderRadius: '2px 2px 0 0',
          height: `${(v / max) * 100}%`,
          opacity: 0.5 + (j / data.length) * 0.5,
        }} />
      ))}
    </div>
  );
}

// ─── Screen: Executive Dashboard ─────────────────────────────
function ScreenExec() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  const kpis = [
    { label: 'Total Revenue',     value: 89420, prefix: '£', badge: '▲ 18.4%', up: true },
    { label: 'Active Customers',  value: 28,    prefix: '',  badge: '▲ 9.2%',  up: true },
    { label: 'Avg Order Value',   value: 1788,  prefix: '£', badge: '▼ 2.1%',  up: false },
    { label: 'Total Orders',      value: 50,    prefix: '',  badge: '▲ 12%',   up: true },
  ];

  const revenueData = [8840, 11200, 10900, 13400, 12600, 15900, 16580, 17200, 16100, 18400, 20100, 21800];
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];

  const donutSlices = [
    { label: 'Analytics Pro', value: 52, color: '#f59e0b' },
    { label: 'Data Suite',    value: 34, color: '#ec4899' },
    { label: 'Reporting',     value: 14, color: '#10b981' },
  ];

  const reps = [
    { name: 'Sarah Chen', pct: 82, val: '£73.2k' },
    { name: 'James Park', pct: 54, val: '£48.3k' },
    { name: 'Aisha Noor', pct: 38, val: '£33.9k' },
    { name: 'Tom Walsh',  pct: 26, val: '£23.2k' },
  ];

  return (
    <div style={{ padding: '18px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1714' }}>Executive Dashboard</div>
          <div style={{ fontSize: 12, color: '#9c9490' }}>Q1–Q2 2025 · Q1_2026_sales.csv · 50 rows</div>
        </div>
        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>⚡ Generated in 0.8s</span>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        {kpis.map((k, i) => (
          <C key={k.label} style={{ opacity: show ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.1}s` }}>
            <div style={{ fontSize: 11, color: '#9c9490', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1714', marginBottom: 5 }}>
              {show ? <AnimNumber target={k.value} prefix={k.prefix} delay={i * 100} /> : '—'}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: k.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: k.up ? '#10b981' : '#ef4444' }}>{k.badge}</span>
          </C>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.9fr', gap: 12 }}>
        {/* Revenue area chart */}
        <C style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', marginBottom: 2 }}>Monthly Revenue</div>
          <div style={{ fontSize: 11, color: '#9c9490', marginBottom: 10 }}>12-month trend (£)</div>
          {show && <AreaChart data={revenueData} color="#f59e0b" height={90} width={320} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#b8b0a8', marginTop: 4 }}>
            {months.map(m => <span key={m}>{m}</span>)}
          </div>
        </C>

        {/* Donut */}
        <C style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', marginBottom: 10 }}>Revenue by Product</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {show && <DonutChart slices={donutSlices} size={82} />}
            <div style={{ flex: 1 }}>
              {donutSlices.map((sl, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: sl.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 10, color: '#6b6560' }}>{sl.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1714' }}>{sl.value}%</div>
                </div>
              ))}
            </div>
          </div>
        </C>

        {/* Sales reps */}
        <C style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', marginBottom: 10 }}>Top Reps</div>
          {reps.map((rep, i) => (
            <div key={i} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: '#4b4540' }}>{rep.name}</span>
                <span style={{ fontWeight: 700, color: '#1a1714' }}>{rep.val}</span>
              </div>
              <div style={{ background: '#f0ede9', borderRadius: 100, height: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#f59e0b', borderRadius: 100, width: show ? `${rep.pct}%` : '0%', transition: `width 0.8s ease ${0.4 + i * 0.12}s` }} />
              </div>
            </div>
          ))}
        </C>
      </div>
    </div>
  );
}

// ─── Screen: Pivot Table ─────────────────────────────────────
function ScreenPivot() {
  const [show, setShow] = useState(false);
  const [hovered, setHovered] = useState(null);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  const products = ['Analytics Pro', 'Data Suite', 'Reporting Lite', 'API Access'];
  const regions  = ['London', 'North', 'Midlands', 'Scotland', 'Wales'];
  const data = [
    [46200, 18700, 10400, 4600, 2800],
    [25300, 11200, 6900, 3100, 1700],
    [13800, 6000, 4300, 1900, 1100],
    [7100,  3600, 2100, 1000,  500],
  ];
  const rowTotals  = data.map(r => r.reduce((a, b) => a + b, 0));
  const colTotals  = regions.map((_, ci) => data.reduce((s, r) => s + r[ci], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
  const maxVal     = Math.max(...data.flat());

  const cellBg = (v) => {
    const pct = v / maxVal;
    if (pct > 0.7)  return 'rgba(245,158,11,0.30)';
    if (pct > 0.45) return 'rgba(245,158,11,0.18)';
    if (pct > 0.25) return 'rgba(245,158,11,0.09)';
    return 'transparent';
  };

  return (
    <div style={{ padding: '18px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1714' }}>Pivot Table</div>
          <div style={{ fontSize: 12, color: '#9c9490' }}>Revenue by Product × Region · FY 2024 · heat-mapped</div>
        </div>
        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>⚡ Generated in 0.6s</span>
      </div>

      {/* Config chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Rows', val: 'Product Line',   icon: '📦' },
          { label: 'Columns', val: 'Region',       icon: '🌍' },
          { label: 'Values', val: 'Revenue (£)',   icon: '💷' },
          { label: 'Aggregation', val: 'SUM',      icon: '∑' },
        ].map((f, i) => (
          <div key={i} style={{ background: '#f7f6f5', border: '1px solid #e8e4e0', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6, opacity: show ? 1 : 0, transition: `opacity 0.3s ease ${i * 0.08}s` }}>
            <span style={{ fontSize: 12 }}>{f.icon}</span>
            <span style={{ fontSize: 10, color: '#9c9490' }}>{f.label}:</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1714' }}>{f.val}</span>
          </div>
        ))}
      </div>

      {/* Pivot table */}
      <C style={{ padding: 0, overflow: 'hidden', opacity: show ? 1 : 0, transition: 'opacity 0.4s ease 0.3s', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f6f5' }}>
              <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9c9490', borderBottom: '1px solid #e8e4e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product ↓ Region →</th>
              {regions.map(r => (
                <th key={r} style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#9c9490', borderBottom: '1px solid #e8e4e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r}</th>
              ))}
              <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#f59e0b', borderBottom: '1px solid #e8e4e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {products.map((prod, ri) => (
              <tr key={ri}>
                <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#1a1714', borderBottom: '1px solid #f0ede9' }}>{prod}</td>
                {data[ri].map((val, ci) => {
                  const isHov = hovered && hovered[0] === ri && hovered[1] === ci;
                  return (
                    <td key={ci}
                      onMouseEnter={() => setHovered([ri, ci])}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        padding: '8px 12px', textAlign: 'right', fontSize: 12,
                        background: isHov ? 'rgba(245,158,11,0.2)' : cellBg(val),
                        color: '#1a1714', fontWeight: isHov ? 700 : 400,
                        borderBottom: '1px solid #f0ede9', cursor: 'default', transition: 'background 0.15s',
                      }}>
                      £{(val / 1000).toFixed(1)}k
                    </td>
                  );
                })}
                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#f59e0b', borderBottom: '1px solid #f0ede9' }}>
                  £{(rowTotals[ri] / 1000).toFixed(1)}k
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ background: '#f7f6f5' }}>
              <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Grand Total</td>
              {colTotals.map((v, ci) => (
                <td key={ci} style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1a1714' }}>
                  £{(v / 1000).toFixed(1)}k
                </td>
              ))}
              <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>
                £{(grandTotal / 1000).toFixed(0)}k
              </td>
            </tr>
          </tbody>
        </table>
      </C>

      {/* Insight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, opacity: show ? 1 : 0, transition: 'opacity 0.4s ease 0.6s' }}>
        {[
          { icon: '🏙️', label: 'London dominance', val: '48%', sub: 'of total revenue from London' },
          { icon: '📦', label: 'Top product',       val: 'Analytics Pro', sub: '£83k · 55% revenue share' },
          { icon: '🚀', label: 'Growth region',     val: 'Scotland',       sub: '+34% YoY, fastest growing' },
        ].map((ins, i) => (
          <C key={i} style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{ins.icon}</div>
            <div style={{ fontSize: 11, color: '#9c9490', marginBottom: 2 }}>{ins.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1714' }}>{ins.val}</div>
            <div style={{ fontSize: 11, color: '#9c9490', marginTop: 2 }}>{ins.sub}</div>
          </C>
        ))}
      </div>
    </div>
  );
}

// ─── Screen: RFM Segmentation (v2 exact) ────────────────────
function ScreenRFM() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  const segs = [
    { emoji: '🏆', label: 'Champions',      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  count: 8,  revenue: '£38,240', pct: 72 },
    { emoji: '⭐', label: 'Loyal',          color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   count: 7,  revenue: '£29,100', pct: 56 },
    { emoji: '⚠️', label: 'At Risk',        color: '#f97316', bg: 'rgba(249,115,22,0.08)',   count: 6,  revenue: '£12,800', pct: 34 },
    { emoji: '❄️', label: 'Lost',           color: '#9c9490', bg: 'rgba(156,148,144,0.08)', count: 7,  revenue: '£9,280',  pct: 20 },
  ];

  const rows = [
    { name: 'Acme Ltd',       seg: 'Champion', sc: '5-5-5', last: '27 Apr', orders: 3, spend: '£3,794', sc_color: '#10b981', sc_bg: 'rgba(16,185,129,0.1)' },
    { name: 'Ironclad Inc',   seg: 'Champion', sc: '5-4-5', last: '26 May', orders: 2, spend: '£4,190', sc_color: '#10b981', sc_bg: 'rgba(16,185,129,0.1)' },
    { name: 'NovaTech',       seg: 'Loyal',    sc: '4-4-4', last: '17 Jun', orders: 2, spend: '£3,493', sc_color: '#f59e0b', sc_bg: 'rgba(245,158,11,0.1)' },
    { name: 'Delta Systems',  seg: 'At Risk',  sc: '2-2-3', last: '15 Jan', orders: 2, spend: '£1,196', sc_color: '#f97316', sc_bg: 'rgba(249,115,22,0.1)' },
    { name: 'BrightStar Inc', seg: 'Lost',     sc: '1-1-2', last: '8 Jan',  orders: 1, spend: '£999',   sc_color: '#9c9490', sc_bg: 'rgba(156,148,144,0.1)' },
  ];

  return (
    <div style={{ padding: '18px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1714' }}>RFM Customer Segmentation</div>
          <div style={{ fontSize: 12, color: '#9c9490' }}>28 customers · scored on Recency, Frequency, Monetary value</div>
        </div>
        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>⚡ Generated in 1.1s</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {segs.map((s, i) => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 12, padding: '14px 16px', opacity: show ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.1}s` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 6 }}>{s.emoji} {s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1714' }}>{s.count}</div>
            <div style={{ fontSize: 11, color: '#6b6560', marginTop: 2, marginBottom: 10 }}>{s.revenue}</div>
            <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 100, height: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: s.color, borderRadius: 100, width: show ? `${s.pct}%` : '0%', transition: `width 0.8s ease ${0.3 + i * 0.12}s` }} />
            </div>
          </div>
        ))}
      </div>

      <C style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f6f5' }}>
              {['Customer', 'Segment', 'Last Order', 'Orders', 'Total Spend', 'RFM Score'].map(h => (
                <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#9c9490', textAlign: 'left', borderBottom: '1px solid #e8e4e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#1a1714', borderBottom: '1px solid #f0ede9' }}>{r.name}</td>
                <td style={{ padding: '9px 14px', borderBottom: '1px solid #f0ede9' }}>
                  <span style={{ background: r.sc_bg, color: r.sc_color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{r.seg}</span>
                </td>
                <td style={{ padding: '9px 14px', fontSize: 12, color: '#6b6560', borderBottom: '1px solid #f0ede9' }}>{r.last}</td>
                <td style={{ padding: '9px 14px', fontSize: 13, color: '#1a1714', borderBottom: '1px solid #f0ede9' }}>{r.orders}</td>
                <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#1a1714', borderBottom: '1px solid #f0ede9' }}>{r.spend}</td>
                <td style={{ padding: '9px 14px', fontSize: 12, color: '#6b6560', borderBottom: '1px solid #f0ede9', fontFamily: 'monospace' }}>{r.sc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </C>
    </div>
  );
}

// ─── Screen: Revenue Forecast (v2 exact) ────────────────────
function ScreenForecast() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  const historic = [
    { m: 'Jan', v: 8840 }, { m: 'Feb', v: 11200 }, { m: 'Mar', v: 10900 },
    { m: 'Apr', v: 13400 }, { m: 'May', v: 12600 }, { m: 'Jun', v: 15900 }, { m: 'Jul', v: 16580 },
  ];
  const future = [
    { m: 'Aug', v: 17800 }, { m: 'Sep', v: 18900 }, { m: 'Oct', v: 20100 },
    { m: 'Nov', v: 21400 }, { m: 'Dec', v: 23800 }, { m: 'Jan', v: 24600 },
  ];
  const allBars = [...historic.map(h => ({ ...h, isForecast: false })), ...future.map(d => ({ ...d, isForecast: true }))];
  const maxV = 26000;

  return (
    <div style={{ padding: '18px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1714' }}>12-Month Revenue Forecast</div>
          <div style={{ fontSize: 12, color: '#9c9490' }}>Based on 7 months of data · ARIMA + seasonal model</div>
        </div>
        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>⚡ Generated in 1.4s</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Projected Next 6M', value: '£126,600', badge: '▲ 42% growth', up: true },
          { label: 'Forecast Confidence', value: '87%', badge: 'High accuracy', up: true },
          { label: 'Peak Month (Dec)', value: '£23,800', badge: 'Seasonal uplift', up: true },
        ].map((k, i) => (
          <C key={k.label} style={{ opacity: show ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.1}s` }}>
            <div style={{ fontSize: 11, color: '#9c9490', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1714', marginBottom: 5 }}>{k.value}</div>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{k.badge}</span>
          </C>
        ))}
      </div>

      <C>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Revenue Trend + Forecast</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9c9490' }}>
            <span>■ <span style={{ color: '#f59e0b' }}>Actual</span></span>
            <span>■ <span style={{ color: '#6366f1' }}>Forecast</span></span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
          {allBars.map((b, i) => (
            <div key={b.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%',
                background: b.isForecast
                  ? 'repeating-linear-gradient(45deg,#6366f1,#6366f1 3px,rgba(99,102,241,0.3) 3px,rgba(99,102,241,0.3) 6px)'
                  : 'linear-gradient(180deg,#f59e0b,#d97706)',
                borderRadius: '3px 3px 0 0',
                height: show ? `${(b.v / maxV) * 100}%` : '0%',
                transition: `height 0.7s ease ${0.3 + i * 0.06}s`,
                opacity: b.isForecast ? 0.85 : 1,
              }} />
              <div style={{ fontSize: 9, color: b.isForecast ? '#6366f1' : '#9c9490', fontWeight: b.isForecast ? 600 : 400 }}>{b.m}</div>
            </div>
          ))}
        </div>
      </C>
    </div>
  );
}

// ─── Screen: Cohort Analysis ──────────────────────────────────
function ScreenCohort() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  const cohorts = ['Jan 2024', 'Feb 2024', 'Mar 2024', 'Apr 2024', 'May 2024', 'Jun 2024'];
  const sizes   = [42, 38, 51, 35, 46, 29];
  const retention = [
    [100, 82, 71, 65, 58, 54],
    [100, 79, 68, 61, 55, null],
    [100, 85, 74, 68, null, null],
    [100, 77, 66, null, null, null],
    [100, 81, null, null, null, null],
    [100, null, null, null, null, null],
  ];

  const cellStyle = (v) => {
    if (v === null) return { background: '#f7f6f5', color: 'transparent' };
    if (v === 100) return { background: '#1a1714', color: '#fff' };
    if (v >= 75)   return { background: 'rgba(16,185,129,0.55)', color: '#fff' };
    if (v >= 60)   return { background: 'rgba(16,185,129,0.30)', color: '#1a1714' };
    if (v >= 45)   return { background: 'rgba(245,158,11,0.35)', color: '#1a1714' };
    return           { background: 'rgba(239,68,68,0.30)', color: '#1a1714' };
  };

  return (
    <div style={{ padding: '18px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1714' }}>Cohort Retention Analysis</div>
          <div style={{ fontSize: 12, color: '#9c9490' }}>% of customers still active each month after signup</div>
        </div>
        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>⚡ Generated in 0.9s</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Avg Month-1 Retention', val: '81%', badge: '▲ vs 70% industry', up: true },
          { label: 'Best cohort (M+3)',      val: 'March', badge: '74% at 3 months', up: true },
          { label: '6-month avg retention',  val: '54%',  badge: 'Target: 60%', up: false },
        ].map((k, i) => (
          <C key={i} style={{ opacity: show ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.1}s` }}>
            <div style={{ fontSize: 11, color: '#9c9490', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1714', marginBottom: 5 }}>{k.val}</div>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: k.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: k.up ? '#10b981' : '#ef4444' }}>{k.badge}</span>
          </C>
        ))}
      </div>

      <C style={{ padding: 0, overflow: 'hidden', opacity: show ? 1 : 0, transition: 'opacity 0.4s ease 0.35s', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f6f5' }}>
              <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9c9490', borderBottom: '1px solid #e8e4e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cohort</th>
              <th style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9c9490', borderBottom: '1px solid #e8e4e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Size</th>
              {['M+0','M+1','M+2','M+3','M+4','M+5'].map(m => (
                <th key={m} style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9c9490', borderBottom: '1px solid #e8e4e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((month, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #f0ede9' }}>
                <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#1a1714' }}>{month}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: '#6b6560' }}>{sizes[ri]}</td>
                {retention[ri].map((v, ci) => {
                  const cs = cellStyle(v);
                  return (
                    <td key={ci} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600, ...cs, borderLeft: '1px solid #f0ede9' }}>
                      {v !== null ? `${v}%` : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </C>

      <C style={{ opacity: show ? 1 : 0, transition: 'opacity 0.4s ease 0.6s', padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: '#4b4540', lineHeight: 1.7 }}>
          <span style={{ fontWeight: 700, color: '#f59e0b' }}>💡 Insight: </span>
          March cohort shows the strongest retention curve — onboarded with the new Customer Success workflow. Rolling this playbook to April & May cohorts could lift 6-month retention from 54% → 62%.
        </div>
      </C>
    </div>
  );
}

// ─── Screen: Churn (v2 exact) ────────────────────────────────
function ScreenChurn() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  const customers = [
    { name: 'BrightStar Inc',  risk: 94, days: 80, spend: '£999',  action: 'Call today' },
    { name: 'Delta Systems',   risk: 87, days: 74, spend: '£1,196', action: 'Send offer' },
    { name: 'WebCore Ltd',     risk: 71, days: 62, spend: '£998',  action: 'Email sequence' },
    { name: 'Luminary Ltd',    risk: 58, days: 40, spend: '£1,196', action: 'Check in' },
    { name: 'MegaTrend',       risk: 42, days: 38, spend: '£999',  action: 'Monitor' },
  ];
  const riskColor = (r) => r >= 80 ? '#ef4444' : r >= 60 ? '#f97316' : r >= 40 ? '#f59e0b' : '#10b981';

  return (
    <div style={{ padding: '18px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1714' }}>Churn Risk Analysis</div>
          <div style={{ fontSize: 12, color: '#9c9490' }}>ML-scored · 28 customers analysed · 5 flagged at risk</div>
        </div>
        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>⚠️ 5 customers at risk</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'At-Risk Revenue', value: '£4,388', badge: 'Recoverable',     color: '#ef4444' },
          { label: 'Avg Days Inactive',value: '59 days',badge: 'Since last order',color: '#f97316' },
          { label: 'If Retained',      value: '+£8,200',badge: '12-month value',  color: '#10b981' },
        ].map((k, i) => (
          <C key={k.label} style={{ opacity: show ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.1}s` }}>
            <div style={{ fontSize: 11, color: '#9c9490', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginBottom: 5 }}>{k.value}</div>
            <span style={{ fontSize: 12, color: '#9c9490' }}>{k.badge}</span>
          </C>
        ))}
      </div>

      <C style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f6f5' }}>
              {['Customer', 'Churn Risk', 'Days Inactive', 'Last Spend', 'Recommended Action'].map(h => (
                <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#9c9490', textAlign: 'left', borderBottom: '1px solid #e8e4e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => (
              <tr key={c.name} style={{ opacity: show ? 1 : 0, transition: `opacity 0.3s ease ${0.2 + i * 0.1}s` }}>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1a1714', borderBottom: '1px solid #f0ede9' }}>{c.name}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0ede9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#f0ede9', borderRadius: 100, height: 6, width: 80, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: riskColor(c.risk), borderRadius: 100, width: show ? `${c.risk}%` : '0%', transition: `width 0.8s ease ${0.3 + i * 0.1}s` }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: riskColor(c.risk) }}>{c.risk}%</span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b6560', borderBottom: '1px solid #f0ede9' }}>{c.days}d</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: '#1a1714', borderBottom: '1px solid #f0ede9' }}>{c.spend}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f0ede9' }}>
                  <span style={{ background: `${riskColor(c.risk)}15`, color: riskColor(c.risk), borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>{c.action}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </C>
    </div>
  );
}

// ─── Screen: AI Insights (v2 exact) ──────────────────────────
function ScreenAI() {
  const [typed, setTyped] = useState('');
  const [cardsVisible, setCardsVisible] = useState(false);
  useEffect(() => {
    setTyped(''); setCardsVisible(false);
    const t1 = setTimeout(() => setCardsVisible(true), 150);
    let i = 0;
    const t2 = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setTyped(AI_TEXT.slice(0, i));
        if (i >= AI_TEXT.length) clearInterval(iv);
      }, 14);
      return () => clearInterval(iv);
    }, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const cards = [
    { icon: '📈', title: 'Revenue Trend',       text: '+18.4% QoQ. Analytics Pro driving 52% of all revenue.' },
    { icon: '🎯', title: 'Biggest Opportunity', text: '8 Champion customers never bought Data Suite — £8–12k cross-sell.' },
    { icon: '⚠️', title: 'Urgent Risk',          text: "BrightStar & Delta haven't purchased in 80+ days. £4,388 at risk." },
  ];

  return (
    <div style={{ padding: '18px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1714' }}>AI Insights</div>
        <span style={{ background: 'linear-gradient(135deg,#f59e0b,#ec4899)', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>🤖 GPT-4o Powered</span>
        <span style={{ fontSize: 11, color: '#9c9490' }}>Generated in 1.2s</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {cards.map((c, i) => (
          <C key={c.title} style={{ opacity: cardsVisible ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.15}s` }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: '#6b6560', lineHeight: 1.6 }}>{c.text}</div>
          </C>
        ))}
      </div>

      <C>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', marginBottom: 12 }}>💬 Executive Summary</div>
        <div style={{ fontSize: 13, color: '#4b4540', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
          {typed}
          {typed.length < AI_TEXT.length && (
            <span style={{ display: 'inline-block', width: 2, height: 14, background: '#f59e0b', verticalAlign: 'middle', marginLeft: 2, animation: 'blink 0.8s infinite' }} />
          )}
        </div>
      </C>
    </div>
  );
}

// ─── Screen: KPI Dashboard (v2 exact) ────────────────────────
function ScreenKPI() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  const kpis = [
    { label: 'Revenue per Customer', value: '£3,194', trend: '+14%', up: true,  spark: [40,55,48,62,70,68,80,90] },
    { label: 'Order Frequency',      value: '1.79x',  trend: '+8%',  up: true,  spark: [50,52,60,55,65,70,72,82] },
    { label: 'Days Between Orders',  value: '41 days',trend: '-12%', up: true,  spark: [90,85,80,75,70,65,60,55] },
    { label: 'Win Rate',             value: '68%',    trend: '+5%',  up: true,  spark: [55,58,60,63,65,64,67,68] },
    { label: 'Avg Deal Size',        value: '£1,788', trend: '-2%',  up: false, spark: [80,78,82,79,76,74,72,71] },
    { label: 'Revenue Growth MoM',   value: '6.2%',   trend: 'Accelerating', up: true, spark: [20,30,25,35,42,45,55,62] },
  ];

  return (
    <div style={{ padding: '18px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1714' }}>KPI Dashboard</div>
          <div style={{ fontSize: 12, color: '#9c9490' }}>6 key metrics · auto-calculated from your data</div>
        </div>
        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>⚡ Generated in 0.6s</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {kpis.map((k, i) => (
          <C key={k.label} style={{ opacity: show ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.1}s` }}>
            <div style={{ fontSize: 11, color: '#9c9490', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1714' }}>{k.value}</div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: k.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: k.up ? '#10b981' : '#ef4444' }}>{k.trend}</span>
            </div>
            <SparkBars data={k.spark} up={k.up} />
          </C>
        ))}
      </div>
    </div>
  );
}

// ─── Main DemoPlayer shell (v2 exact + new screens) ──────────
export default function DemoPlayer() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const go = (idx) => {
    clearTimeout(timerRef.current);
    setCurrent(idx);
  };

  useEffect(() => {
    timerRef.current = setTimeout(() => go((current + 1) % SCREENS.length), SCREENS[current].duration);
    return () => clearTimeout(timerRef.current);
  }, [current]);

  const screenId = SCREENS[current].id;

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow: 'hidden', background: '#f7f6f5' }}>
      <style>{`
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 200, minWidth: 200, background: '#1a1714', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(245,158,11,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#1a1714', flexShrink: 0 }}>D</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f5f0eb' }}>DataHub Pro</div>
            <div style={{ fontSize: 10, color: '#6b6560' }}>Q1_2026_sales.csv</div>
          </div>
        </div>
        <div style={{ padding: '10px 8px 4px', fontSize: 9, color: '#6b6560', letterSpacing: '1px', textTransform: 'uppercase' }}>Analytics</div>
        {NAV.map(n => (
          <div key={n.label}
            onClick={() => { const i = SCREENS.findIndex(s => s.id === n.screen); if (i >= 0) go(i); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', margin: '1px 6px', borderRadius: 7,
              fontSize: 11, cursor: n.screen ? 'pointer' : 'default',
              color: n.screen === screenId ? '#f59e0b' : '#9c9490',
              background: n.screen === screenId ? 'rgba(245,158,11,0.15)' : 'transparent',
              fontWeight: n.screen === screenId ? 600 : 400,
            }}
          >
            <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
        <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#6b6560' }}>
          <strong style={{ display: 'block', color: '#9c9490' }}>Demo User</strong>
          DataHub Demo Co
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e8e4e0', padding: '0 22px', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>{SCREENS[current].label}</span>
            <span style={{ fontSize: 11, color: '#9c9490', background: '#f0ede9', borderRadius: 5, padding: '2px 8px' }}>Q1_2026_sales.csv</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={{ background: '#f0ede9', color: '#6b6560', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>📥 Export</button>
            <button style={{ background: '#ec4899', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>▶ Run Again</button>
          </div>
        </div>

        {/* Screen content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {screenId === 'exec'     && <ScreenExec     key={current} />}
          {screenId === 'pivot'    && <ScreenPivot    key={current} />}
          {screenId === 'rfm'      && <ScreenRFM      key={current} />}
          {screenId === 'forecast' && <ScreenForecast key={current} />}
          {screenId === 'cohort'   && <ScreenCohort   key={current} />}
          {screenId === 'churn'    && <ScreenChurn    key={current} />}
          {screenId === 'ai'       && <ScreenAI       key={current} />}
          {screenId === 'kpi'      && <ScreenKPI      key={current} />}
        </div>

        {/* Bottom progress bar */}
        <div style={{ background: '#1a1714', borderTop: '1px solid rgba(245,158,11,0.15)', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: '#6b6560', whiteSpace: 'nowrap' }}>Live demo</span>
          <div style={{ display: 'flex', gap: 5, flex: 1 }}>
            {SCREENS.map((s, i) => (
              <div key={s.id} onClick={() => go(i)} title={s.label}
                style={{ flex: 1, height: 3, background: 'rgba(245,158,11,0.15)', borderRadius: 100, overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{
                  height: '100%', background: '#f59e0b', borderRadius: 100,
                  width: i < current ? '100%' : i === current ? '100%' : '0%',
                  transition: i === current ? `width ${s.duration}ms linear` : 'none',
                }} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>{SCREENS[current].label}</span>
          <button onClick={() => go(0)} style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 5, padding: '3px 9px', fontSize: 10, cursor: 'pointer' }}>↩</button>
        </div>
      </div>
    </div>
  );
}
