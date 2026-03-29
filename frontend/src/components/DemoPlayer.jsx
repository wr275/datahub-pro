import { useState, useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────
   DataHub Pro — Product Demo Player  v3
   8 screens: Exec Dashboard → Pivot Table → RFM → Forecast →
              Cohort Analysis → Churn → AI Insights → KPI
───────────────────────────────────────────────────────────── */

const SCREENS = [
  { id: 'exec',    label: 'Executive Dashboard', duration: 6000 },
  { id: 'pivot',   label: 'Pivot Table',         duration: 6000 },
  { id: 'rfm',     label: 'RFM Segmentation',    duration: 5500 },
  { id: 'forecast',label: 'Revenue Forecast',    duration: 5500 },
  { id: 'cohort',  label: 'Cohort Analysis',     duration: 5500 },
  { id: 'churn',   label: 'Churn Analysis',      duration: 5000 },
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

const AI_TEXT = `Revenue is up 18.4% QoQ, driven by the Analytics Pro line (52% of revenue). Sarah Chen accounts for 47% of all sales — this concentration is a risk worth managing.\n\nYour 8 Champion-tier customers haven't been offered Data Suite. Based on order history, cross-sell potential is £8,000–£12,000.\n\nImmediate action: BrightStar Inc and Delta Systems haven't purchased in 90+ days. Both are historically high-value. Outreach this week could recover £4,200 in at-risk ARR.`;

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

// ─── SVG Area Chart ──────────────────────────────────────────
function AreaChart({ data, color = '#6366f1', height = 80, width = 300 }) {
  const pad = { l: 4, r: 4, t: 8, b: 4 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    pad.l + (i / (data.length - 1)) * w,
    pad.t + h - ((v - min) / range) * h,
  ]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${(pad.t + h).toFixed(1)} L${pts[0][0].toFixed(1)},${(pad.t + h).toFixed(1)} Z`;
  const id = `grad-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => i === pts.length - 1 ? (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={color} />
      ) : null)}
    </svg>
  );
}

// ─── SVG Donut Chart ─────────────────────────────────────────
function DonutChart({ slices, size = 100 }) {
  const r = 36; const cx = size / 2; const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((sl, i) => {
        const dash = (sl.value / total) * circumference;
        const gap = circumference - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={sl.color} strokeWidth="18"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        );
        offset += dash;
        return el;
      })}
      <circle cx={cx} cy={cy} r="24" fill="#0f172a" />
    </svg>
  );
}

// ─── Dual-line SVG Chart ─────────────────────────────────────
function DualLineChart({ actual, forecast, width = 320, height = 90 }) {
  const pad = { l: 6, r: 6, t: 10, b: 6 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const all = [...actual, ...forecast];
  const max = Math.max(...all); const min = Math.min(...all);
  const range = max - min || 1;
  const pts = (arr) => arr.map((v, i) => [
    pad.l + (i / (arr.length - 1)) * w,
    pad.t + h - ((v - min) / range) * h,
  ]);
  const toPath = (arr) => pts(arr).map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const apts = pts(actual); const fpts = pts(forecast);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <path d={toPath(actual)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={toPath(forecast)} fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 3" strokeLinejoin="round" strokeLinecap="round" />
      {apts.map((p, i) => i === apts.length - 1 ? <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#f59e0b" /> : null)}
      {fpts.map((p, i) => i === fpts.length - 1 ? <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#a78bfa" /> : null)}
    </svg>
  );
}

// ─── Sparkline ───────────────────────────────────────────────
function Sparkline({ data, color = '#6366f1' }) {
  const w = 72; const h = 28;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Shared Shell ─────────────────────────────────────────────
function Shell({ activeScreen, children }) {
  return (
    <div style={{ display: 'flex', height: '100%', background: '#0f172a', color: '#e2e8f0', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 12, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 168, background: '#0a1120', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#6366f1', letterSpacing: '-0.3px' }}>DataHub Pro</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Analytics Platform</div>
        </div>
        <div style={{ padding: '6px 6px', flex: 1, overflowY: 'auto' }}>
          {NAV.map((n) => (
            <div key={n.label} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 6, marginBottom: 1,
              background: activeScreen === n.screen ? '#1e1b4b' : 'transparent',
              color: activeScreen === n.screen ? '#a5b4fc' : '#94a3b8',
              fontWeight: activeScreen === n.screen ? 600 : 400,
              cursor: 'default',
            }}>
              <span style={{ fontSize: 13 }}>{n.icon}</span>
              <span style={{ fontSize: 11 }}>{n.label}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>W</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>Waqas R.</div>
            <div style={{ fontSize: 9, color: '#64748b' }}>Admin</div>
          </div>
        </div>
      </div>
      {/* Main */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Screen: Executive Dashboard ─────────────────────────────
function ScreenExec({ reveal }) {
  const revenueData = [142, 158, 147, 165, 172, 189, 195, 208, 198, 224, 231, 247];
  const donutSlices = [
    { label: 'Analytics Pro', value: 52, color: '#6366f1' },
    { label: 'Data Suite',    value: 28, color: '#8b5cf6' },
    { label: 'Reporting',     value: 20, color: '#a78bfa' },
  ];
  const reps = [
    { name: 'Sarah Chen', pct: 78, val: '£94.2k' },
    { name: 'James Park', pct: 52, val: '£63.1k' },
    { name: 'Aisha Noor', pct: 41, val: '£49.7k' },
    { name: 'Tom Walsh',  pct: 29, val: '£35.2k' },
  ];
  return (
    <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Executive Dashboard</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>Q1 2025 · All regions · Live data</div>
      </div>
      {/* KPI row */}
      {reveal >= 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Total Revenue', val: 247000, prefix: '£', suffix: '', change: '+18.4%', up: true, data: [142,158,147,165,172,189,195,208,198,224,231,247], color: '#6366f1' },
            { label: 'Active Customers', val: 143, prefix: '', suffix: '', change: '+12', up: true, data: [98,104,108,112,116,119,124,128,131,136,139,143], color: '#22c55e' },
            { label: 'Avg Order Value', val: 1728, prefix: '£', suffix: '', change: '+5.3%', up: true, data: [1420,1510,1480,1560,1620,1590,1650,1680,1710,1690,1715,1728], color: '#f59e0b' },
            { label: 'Churn Rate', val: 3.2, prefix: '', suffix: '%', change: '-0.8%', up: false, data: [5.1,4.8,5.2,4.6,4.3,4.5,4.1,3.9,3.7,3.5,3.4,3.2], color: '#ef4444' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#131c2e', borderRadius: 8, padding: '10px 12px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
                {reveal >= 1 ? <AnimNumber target={k.val} prefix={k.prefix} suffix={k.suffix} duration={1000} delay={i * 120} /> : '—'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 10, color: k.up ? '#22c55e' : '#ef4444' }}>{k.change}</span>
                <div style={{ width: 70 }}><AreaChart data={k.data} color={k.color} height={28} width={70} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {reveal >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* Revenue area chart */}
          <div style={{ background: '#131c2e', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Monthly Revenue</div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>Jan–Dec 2024 (£k)</div>
            <AreaChart data={revenueData} color="#6366f1" height={80} width={340} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginTop: 4 }}>
              {['J','F','M','A','M','J','J','A','S','O','N','D'].map(m => <span key={m}>{m}</span>)}
            </div>
          </div>
          {/* Donut */}
          <div style={{ background: '#131c2e', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Revenue Mix</div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>By product line</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <DonutChart slices={donutSlices} size={90} />
              <div style={{ flex: 1 }}>
                {donutSlices.map((sl, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: sl.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 10, color: '#94a3b8' }}>{sl.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 600 }}>{sl.value}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {reveal >= 3 && (
        <div style={{ background: '#131c2e', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Sales Rep Performance</div>
          {reps.map((rep, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <div style={{ width: 70, fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{rep.name}</div>
              <div style={{ flex: 1, height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${rep.pct}%`, height: '100%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 4, transition: 'width 1s ease' }} />
              </div>
              <div style={{ width: 42, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>{rep.val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screen: Pivot Table ──────────────────────────────────────
function ScreenPivot({ reveal }) {
  const products = ['Analytics Pro', 'Data Suite', 'Reporting Lite', 'API Access'];
  const regions  = ['London', 'North', 'Midlands', 'Scotland', 'Wales'];
  const data = [
    [94200, 38100, 21400, 9300, 5800],
    [51300, 22700, 14100, 6200, 3400],
    [28400, 12100, 8700, 3900, 2100],
    [14600, 7200, 4300, 2100, 1100],
  ];
  const rowTotals = data.map(r => r.reduce((a, b) => a + b, 0));
  const colTotals = regions.map((_, ci) => data.reduce((s, r) => s + r[ci], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
  const maxVal = Math.max(...data.flat());

  const heatColor = (v) => {
    const pct = v / maxVal;
    if (pct > 0.7) return 'rgba(99,102,241,0.55)';
    if (pct > 0.45) return 'rgba(99,102,241,0.35)';
    if (pct > 0.25) return 'rgba(99,102,241,0.18)';
    return 'rgba(99,102,241,0.07)';
  };

  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Pivot Table</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>Revenue by Product × Region · FY 2024</div>
      </div>

      {reveal >= 1 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Row dimension', val: 'Product Line', icon: '📦' },
            { label: 'Column dimension', val: 'Region', icon: '🌍' },
            { label: 'Value metric', val: 'Revenue (£)', icon: '💷' },
            { label: 'Aggregation', val: 'SUM', icon: '∑' },
          ].map((f, i) => (
            <div key={i} style={{ background: '#131c2e', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12 }}>{f.icon}</span>
              <span style={{ fontSize: 10, color: '#64748b' }}>{f.label}:</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#a5b4fc' }}>{f.val}</span>
            </div>
          ))}
        </div>
      )}

      {reveal >= 2 && (
        <div style={{ background: '#131c2e', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a1120' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', borderBottom: '1px solid #1e293b', fontWeight: 600 }}>Product \ Region</th>
                {regions.map(r => (
                  <th key={r} style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid #1e293b', fontWeight: 600 }}>{r}</th>
                ))}
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: '#6366f1', borderBottom: '1px solid #1e293b', fontWeight: 700 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #1e2537' }}>
                  <td style={{ padding: '7px 12px', fontSize: 11, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{prod}</td>
                  {data[ri].map((val, ci) => {
                    const isHov = hovered && hovered[0] === ri && hovered[1] === ci;
                    return (
                      <td key={ci}
                        onMouseEnter={() => setHovered([ri, ci])}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          padding: '7px 10px', textAlign: 'right', fontSize: 11,
                          background: isHov ? 'rgba(99,102,241,0.3)' : heatColor(val),
                          color: isHov ? '#fff' : '#cbd5e1',
                          cursor: 'default', transition: 'background 0.15s',
                          fontWeight: isHov ? 700 : 400,
                        }}>
                        £{(val / 1000).toFixed(1)}k
                      </td>
                    );
                  })}
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#a5b4fc' }}>
                    £{(rowTotals[ri] / 1000).toFixed(1)}k
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#0d1829', borderTop: '1px solid #334155' }}>
                <td style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700, color: '#6366f1' }}>Grand Total</td>
                {colTotals.map((v, ci) => (
                  <td key={ci} style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#a5b4fc' }}>
                    £{(v / 1000).toFixed(1)}k
                  </td>
                ))}
                <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#818cf8' }}>
                  £{(grandTotal / 1000).toFixed(0)}k
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {reveal >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'London dominance', val: '48%', sub: 'of total revenue', color: '#6366f1' },
            { label: 'Top product', val: 'Analytics Pro', sub: '£169k · 55% share', color: '#8b5cf6' },
            { label: 'Growth region', val: 'Scotland', sub: '+34% YoY growth', color: '#22c55e' },
          ].map((ins, i) => (
            <div key={i} style={{ background: '#131c2e', borderRadius: 7, padding: '10px 12px', border: `1px solid ${ins.color}40` }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{ins.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: ins.color }}>{ins.val}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{ins.sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screen: RFM ─────────────────────────────────────────────
function ScreenRFM({ reveal }) {
  const segs = [
    { label: 'Champions',      count: 8,  revenue: '£94.2k', color: '#22c55e', w: 85 },
    { label: 'Loyal',          count: 21, revenue: '£71.8k', color: '#6366f1', w: 70 },
    { label: 'At Risk',        count: 14, revenue: '£38.4k', color: '#f59e0b', w: 48 },
    { label: 'Need Attention', count: 19, revenue: '£28.1k', color: '#ef4444', w: 38 },
    { label: 'New Customers',  count: 31, revenue: '£17.3k', color: '#3b82f6', w: 28 },
    { label: 'Hibernating',    count: 12, revenue: '£8.9k',  color: '#94a3b8', w: 16 },
  ];
  const customers = [
    { name: 'TechFlow Ltd',   seg: 'Champions',      rfm: [5,5,5], ltv: '£28.4k' },
    { name: 'Apex Systems',   seg: 'Champions',      rfm: [5,4,5], ltv: '£22.1k' },
    { name: 'Delta Inc',      seg: 'At Risk',        rfm: [2,4,3], ltv: '£15.7k' },
    { name: 'BrightStar',     seg: 'At Risk',        rfm: [1,3,4], ltv: '£12.3k' },
    { name: 'Sunrise Co',     seg: 'Loyal',          rfm: [4,5,4], ltv: '£19.8k' },
  ];
  return (
    <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>RFM Segmentation</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>143 customers · Recency / Frequency / Monetary</div>
      {reveal >= 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#131c2e', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
            {segs.map((s, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: '#e2e8f0' }}>{s.label}</span>
                  <span style={{ color: '#64748b' }}>{s.count} · {s.revenue}</span>
                </div>
                <div style={{ height: 7, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${s.w}%`, height: '100%', background: s.color, borderRadius: 4, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: '#131c2e', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Segment Value</div>
            {segs.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 10, color: '#94a3b8' }}>{s.label}</div>
                <div style={{ fontSize: 10, fontWeight: 600 }}>{s.revenue}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {reveal >= 2 && (
        <div style={{ background: '#131c2e', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a1120' }}>
                {['Customer', 'Segment', 'R', 'F', 'M', 'LTV'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: '#64748b', borderBottom: '1px solid #1e293b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => {
                const seg = segs.find(s => s.label === c.seg);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #1e2537' }}>
                    <td style={{ padding: '6px 10px', fontSize: 11 }}>{c.name}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ fontSize: 10, background: `${seg?.color}22`, color: seg?.color, border: `1px solid ${seg?.color}44`, borderRadius: 4, padding: '2px 6px' }}>{c.seg}</span>
                    </td>
                    {c.rfm.map((v, j) => (
                      <td key={j} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: v >= 4 ? '#22c55e' : v === 3 ? '#f59e0b' : '#ef4444' }}>{v}</td>
                    ))}
                    <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600 }}>{c.ltv}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Screen: Forecast ────────────────────────────────────────
function ScreenForecast({ reveal }) {
  const actual   = [142, 158, 147, 165, 172, 189, 195, 208, 198, 224, 231, 247];
  const forecast = [142, 158, 147, 165, 172, 189, 195, 208, 198, 224, 231, 247, 261, 278, 292, 308];
  return (
    <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Revenue Forecast</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>ML model · 92% accuracy · 4-month horizon</div>
      {reveal >= 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Current MRR', val: 247000, prefix: '£', suffix: '', color: '#f59e0b' },
            { label: 'Forecast Q2', val: 308000, prefix: '£', suffix: '', color: '#a78bfa' },
            { label: 'Growth rate', val: 24.7, prefix: '+', suffix: '%', color: '#22c55e' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#131c2e', borderRadius: 8, padding: '10px 12px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>
                <AnimNumber target={k.val} prefix={k.prefix} suffix={k.suffix} duration={1000} delay={i * 150} />
              </div>
            </div>
          ))}
        </div>
      )}
      {reveal >= 2 && (
        <div style={{ background: '#131c2e', borderRadius: 8, padding: '14px 16px', border: '1px solid #1e293b', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>Actual vs Forecast</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Jan 2024 – Apr 2025 (£k)</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
              <span style={{ color: '#f59e0b' }}>● Actual</span>
              <span style={{ color: '#a78bfa' }}>- - Forecast</span>
            </div>
          </div>
          <DualLineChart actual={actual} forecast={forecast} width={440} height={100} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginTop: 6 }}>
            {['J','F','M','A','M','J','J','A','S','O','N','D','J','F','M','A'].map((m, i) => <span key={i}>{m}</span>)}
          </div>
        </div>
      )}
      {reveal >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Model confidence', val: '92%', color: '#22c55e', sub: 'High accuracy' },
            { label: 'Seasonality', val: 'Q4 peak', color: '#f59e0b', sub: 'Dec historically +31%' },
            { label: 'Risk scenario', val: '£261k', color: '#ef4444', sub: 'Conservative floor' },
          ].map((ins, i) => (
            <div key={i} style={{ background: '#131c2e', borderRadius: 7, padding: '10px 12px', border: `1px solid ${ins.color}40` }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{ins.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: ins.color }}>{ins.val}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{ins.sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screen: Cohort Analysis ──────────────────────────────────
function ScreenCohort({ reveal }) {
  const cohorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const sizes   = [42, 38, 51, 35, 46, 29];
  const retention = [
    [100, 82, 71, 65, 58, 54],
    [100, 79, 68, 61, 55],
    [100, 85, 74, 68],
    [100, 77, 66],
    [100, 81],
    [100],
  ];

  const cellColor = (v) => {
    if (v === null) return '#0f172a';
    if (v >= 80) return '#166534';
    if (v >= 65) return '#14532d';
    if (v >= 50) return '#854d0e';
    if (v >= 35) return '#92400e';
    return '#7f1d1d';
  };

  return (
    <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Cohort Analysis</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Customer retention by signup month · % still active</div>

      {reveal >= 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Avg Month-1 Retention', val: '81%', color: '#22c55e', sub: 'Industry avg: 70%' },
            { label: 'Best cohort', val: 'March',   color: '#6366f1', sub: '74% at Month-3' },
            { label: '6-month avg retention', val: '54%', color: '#f59e0b', sub: 'Target: 60%' },
          ].map((ins, i) => (
            <div key={i} style={{ background: '#131c2e', borderRadius: 7, padding: '10px 12px', border: `1px solid ${ins.color}40` }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{ins.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: ins.color }}>{ins.val}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{ins.sub}</div>
            </div>
          ))}
        </div>
      )}

      {reveal >= 2 && (
        <div style={{ background: '#131c2e', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a1120' }}>
                <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, color: '#64748b', borderBottom: '1px solid #1e293b' }}>Cohort</th>
                <th style={{ padding: '7px 10px', textAlign: 'right', fontSize: 10, color: '#64748b', borderBottom: '1px solid #1e293b' }}>Size</th>
                {['M+0','M+1','M+2','M+3','M+4','M+5'].map(m => (
                  <th key={m} style={{ padding: '7px 10px', textAlign: 'center', fontSize: 10, color: '#64748b', borderBottom: '1px solid #1e293b' }}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((month, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #1e2537' }}>
                  <td style={{ padding: '7px 12px', fontSize: 11, fontWeight: 600 }}>{month} 2024</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11, color: '#94a3b8' }}>{sizes[ri]}</td>
                  {Array(6).fill(null).map((_, ci) => {
                    const v = retention[ri][ci] ?? null;
                    return (
                      <td key={ci} style={{
                        padding: '7px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600,
                        background: cellColor(v),
                        color: v !== null ? '#e2e8f0' : 'transparent',
                      }}>
                        {v !== null ? `${v}%` : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reveal >= 3 && (
        <div style={{ background: '#131c2e', borderRadius: 8, padding: '10px 14px', border: '1px solid #1e293b', fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>💡 Insight: </span>
          March cohort shows the strongest retention curve — this cohort was onboarded with the new Customer Success workflow. Rolling out the same playbook to April & May cohorts could lift 6-month retention from 54% → 62%.
        </div>
      )}
    </div>
  );
}

// ─── Screen: Churn Analysis ──────────────────────────────────
function ScreenChurn({ reveal }) {
  const risks = [
    { name: 'BrightStar Inc',   score: 87, revenue: '£4,200', days: 94,  reason: 'No purchase in 94d' },
    { name: 'Delta Systems',    score: 81, revenue: '£3,100', days: 91,  reason: 'Usage dropped 60%' },
    { name: 'Meridian Co',      score: 74, revenue: '£2,800', days: 67,  reason: 'Support tickets ×3' },
    { name: 'Coastal Ventures', score: 62, revenue: '£1,950', days: 45,  reason: 'No logins 45d' },
    { name: 'Apex Digital',     score: 55, revenue: '£1,700', days: 38,  reason: 'Plan downgrade' },
  ];
  return (
    <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Churn Analysis</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>ML churn score · 143 active accounts</div>
      {reveal >= 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Churn rate', val: 3.2, suffix: '%', color: '#ef4444' },
            { label: 'At risk ARR', val: 13750, prefix: '£', suffix: '', color: '#f59e0b' },
            { label: 'Avg health score', val: 73, prefix: '', suffix: '/100', color: '#22c55e' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#131c2e', borderRadius: 8, padding: '10px 12px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>
                <AnimNumber target={k.val} prefix={k.prefix || ''} suffix={k.suffix} duration={900} delay={i * 100} />
              </div>
            </div>
          ))}
        </div>
      )}
      {reveal >= 2 && (
        <div style={{ background: '#131c2e', borderRadius: 8, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', fontSize: 11, fontWeight: 600 }}>High-Risk Accounts</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a1120' }}>
                {['Account', 'Churn Score', 'At-Risk ARR', 'Signal', 'Action'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: '#64748b', borderBottom: '1px solid #1e293b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e2537' }}>
                  <td style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 40, height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${r.score}%`, height: '100%', background: r.score > 75 ? '#ef4444' : r.score > 55 ? '#f59e0b' : '#22c55e', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: r.score > 75 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{r.score}</span>
                    </div>
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 11 }}>{r.revenue}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: '#94a3b8' }}>{r.reason}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{ fontSize: 10, background: '#1e3a5f', color: '#60a5fa', borderRadius: 4, padding: '2px 6px', cursor: 'default' }}>Outreach</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Screen: AI Insights ─────────────────────────────────────
function ScreenAI({ reveal }) {
  const [typed, setTyped] = useState('');
  const [dots, setDots] = useState(true);
  useEffect(() => {
    if (reveal < 2) return;
    const start = 600;
    const speed = 22;
    let i = 0;
    const t = setTimeout(() => {
      setDots(false);
      const interval = setInterval(() => {
        i++;
        setTyped(AI_TEXT.slice(0, i));
        if (i >= AI_TEXT.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, start);
    return () => clearTimeout(t);
  }, [reveal]);

  return (
    <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>AI Insights</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>GPT-4 analysis · Updated 2 hours ago</div>
      {reveal >= 1 && (
        <div style={{ background: '#131c2e', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b', marginBottom: 12, display: 'flex', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>DataHub AI</div>
            {dots && <span style={{ fontSize: 13, color: '#6366f1' }}>●●●</span>}
            {!dots && (
              <div style={{ fontSize: 11, lineHeight: 1.7, color: '#cbd5e1', whiteSpace: 'pre-line' }}>
                {typed}<span style={{ opacity: typed.length < AI_TEXT.length ? 1 : 0 }}>▋</span>
              </div>
            )}
          </div>
        </div>
      )}
      {reveal >= 3 && typed.length > 200 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Cross-sell opportunity', val: '£10k', color: '#22c55e', icon: '💡' },
            { label: 'At-risk ARR',            val: '£4.2k', color: '#ef4444', icon: '⚠️' },
            { label: 'Concentration risk',     val: '47%', color: '#f59e0b', icon: '🎯' },
          ].map((a, i) => (
            <div key={i} style={{ background: '#131c2e', borderRadius: 7, padding: '10px 12px', border: `1px solid ${a.color}40` }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{a.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: a.color }}>{a.val}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{a.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screen: KPI Dashboard ───────────────────────────────────
function ScreenKPI({ reveal }) {
  const kpis = [
    { label: 'Monthly Recurring Revenue',  val: 247000, prefix: '£', suffix: '', change: '+18.4%', up: true,  spark: [180,195,188,210,220,214,232,240,235,247], color: '#6366f1' },
    { label: 'Net Revenue Retention',      val: 114,    prefix: '', suffix: '%',  change: '+6pts',  up: true,  spark: [101,103,104,105,107,108,109,110,112,114], color: '#22c55e' },
    { label: 'Customer Acquisition Cost',  val: 412,    prefix: '£', suffix: '', change: '-8.1%',  up: true,  spark: [520,510,495,480,468,455,448,437,425,412], color: '#f59e0b' },
    { label: 'Customer Lifetime Value',    val: 8240,   prefix: '£', suffix: '', change: '+11.2%', up: true,  spark: [6800,7000,7100,7300,7500,7600,7750,7900,8100,8240], color: '#8b5cf6' },
    { label: 'Gross Margin',               val: 73,     prefix: '', suffix: '%',  change: '+2pts',  up: true,  spark: [68,69,70,70,71,71,72,72,73,73], color: '#06b6d4' },
    { label: 'Support Ticket Volume',      val: 24,     prefix: '', suffix: '',   change: '-31%',   up: true,  spark: [62,55,49,42,38,34,32,29,27,24], color: '#ef4444' },
  ];
  return (
    <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>KPI Dashboard</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Core business metrics · Real-time</div>
      {reveal >= 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: '#131c2e', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                <AnimNumber target={k.val} prefix={k.prefix} suffix={k.suffix} duration={900} delay={i * 100} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: k.up ? '#22c55e' : '#ef4444' }}>{k.change}</span>
                <Sparkline data={k.spark} color={k.color} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main DemoPlayer ─────────────────────────────────────────
export default function DemoPlayer() {
  const [screenIdx, setScreenIdx] = useState(0);
  const [reveal, setReveal] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const progressRef = useRef(null);

  const screen = SCREENS[screenIdx];

  const goTo = (idx) => {
    clearTimeout(timerRef.current);
    cancelAnimationFrame(progressRef.current);
    setScreenIdx(idx);
    setReveal(0);
    setProgress(0);
  };

  // Auto-advance
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setScreenIdx(i => (i + 1) % SCREENS.length);
    }, screen.duration);
    return () => clearTimeout(timerRef.current);
  }, [screenIdx, screen.duration]);

  // Progress bar
  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    const tick = (now) => {
      const pct = Math.min((now - start) / screen.duration * 100, 100);
      setProgress(pct);
      if (pct < 100) progressRef.current = requestAnimationFrame(tick);
    };
    progressRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(progressRef.current);
  }, [screenIdx, screen.duration]);

  // Staggered reveal
  useEffect(() => {
    setReveal(0);
    const t1 = setTimeout(() => setReveal(1), 300);
    const t2 = setTimeout(() => setReveal(2), 1100);
    const t3 = setTimeout(() => setReveal(3), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [screenIdx]);

  const currentId = SCREENS[screenIdx].id;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', borderRadius: 12, overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ background: '#070d19', borderBottom: '1px solid #1e293b', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: '#131c2e', borderRadius: 5, padding: '3px 10px', fontSize: 11, color: '#475569', textAlign: 'center' }}>
          app.datahubpro.co.uk — {screen.label}
        </div>
        <div style={{ fontSize: 10, color: '#475569' }}>LIVE</div>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
      </div>

      {/* Screen tabs */}
      <div style={{ background: '#0a1120', borderBottom: '1px solid #1e293b', display: 'flex', gap: 2, padding: '5px 8px', overflowX: 'auto', flexShrink: 0 }}>
        {SCREENS.map((s, i) => (
          <button key={s.id} onClick={() => goTo(i)} style={{
            padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap',
            background: i === screenIdx ? '#1e293b' : 'transparent',
            color: i === screenIdx ? '#a5b4fc' : '#475569',
            fontWeight: i === screenIdx ? 600 : 400,
          }}>{s.label}</button>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: '#1e293b', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.1s linear' }} />
      </div>

      {/* Shell + screens */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Shell activeScreen={currentId}>
          {currentId === 'exec'     && <ScreenExec    reveal={reveal} key={screenIdx} />}
          {currentId === 'pivot'    && <ScreenPivot   reveal={reveal} key={screenIdx} />}
          {currentId === 'rfm'      && <ScreenRFM     reveal={reveal} key={screenIdx} />}
          {currentId === 'forecast' && <ScreenForecast reveal={reveal} key={screenIdx} />}
          {currentId === 'cohort'   && <ScreenCohort  reveal={reveal} key={screenIdx} />}
          {currentId === 'churn'    && <ScreenChurn   reveal={reveal} key={screenIdx} />}
          {currentId === 'ai'       && <ScreenAI      reveal={reveal} key={screenIdx} />}
          {currentId === 'kpi'      && <ScreenKPI     reveal={reveal} key={screenIdx} />}
        </Shell>
      </div>
    </div>
  );
}
