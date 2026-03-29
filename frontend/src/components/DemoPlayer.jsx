import { useState, useEffect, useRef } from 'react';

const SCREENS = [
  { id: 'dashboard',  label: 'Hub Home',            duration: 4500 },
  { id: 'upload',     label: 'Upload Data',          duration: 4000 },
  { id: 'processing', label: 'Analysing…',           duration: 3500 },
  { id: 'exec',       label: 'Executive Dashboard',  duration: 5000 },
  { id: 'rfm',        label: 'RFM Segmentation',     duration: 5000 },
  { id: 'ai',         label: 'AI Insights',          duration: 7000 },
];

const AI_TEXT = `Your Q1–Q2 2025 data shows strong revenue momentum with £89,420 total across 28 unique customers. Sarah Chen is your top performer at £42,450 — 47% of total revenue — suggesting an over-reliance risk worth monitoring.\n\nYour 8 Champion customers represent your most profitable segment and should be prioritised for upsell campaigns. The 7 At-Risk customers represent £22,080 in recurring revenue that could be lost without intervention.\n\nNorth and East regions are your strongest markets. Consider reallocating budget from West (lowest) to support expansion in high-performing territories.`;

// ─── Tiny sub-components ────────────────────────────────────────────────────

function SidebarItem({ icon, label, active }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'10px',
      padding:'9px 14px', margin:'1px 6px', borderRadius:'8px',
      fontSize:'13px', color: active ? '#f59e0b' : '#9c9490',
      background: active ? 'rgba(245,158,11,0.15)' : 'transparent',
      fontWeight: active ? 600 : 400,
    }}>
      <span style={{width:'18px', textAlign:'center'}}>{icon}</span> {label}
    </div>
  );
}

function KpiCard({ label, value, badge, badgeUp, delay }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div style={{
      background:'#fff', borderRadius:'12px', border:'1px solid #e8e4e0',
      padding:'18px 20px', opacity: visible ? 1 : 0,
      transition:'opacity 0.4s ease',
    }}>
      <div style={{fontSize:'11px', color:'#9c9490', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:'8px'}}>{label}</div>
      <div style={{fontSize:'26px', fontWeight:'800', color:'#1a1714', marginBottom:'6px'}}>{value}</div>
      <span style={{
        display:'inline-flex', alignItems:'center', gap:'4px',
        fontSize:'12px', fontWeight:'600', padding:'3px 8px', borderRadius:'6px',
        background: badgeUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        color: badgeUp ? '#10b981' : '#ef4444',
      }}>{badge}</span>
    </div>
  );
}

function AnimBar({ pct, color, delay }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), delay + 100); return () => clearTimeout(t); }, [pct, delay]);
  return (
    <div style={{width:'80px', background:'#f0ede9', borderRadius:'100px', height:'4px'}}>
      <div style={{height:'100%', borderRadius:'100px', background:color, width:`${w}%`, transition:'width 0.8s ease'}} />
    </div>
  );
}

// ─── Screens ────────────────────────────────────────────────────────────────

function ScreenDashboard() {
  const tools = [
    ['Data View','Browse & explore'],['Data Summary','Column stats'],
    ['Quality Report','Missing values'],['Data Cleaner','Fix & dedupe'],['Data Blending','Merge sources'],
  ];
  const tools2 = [
    ['RFM Analysis','Segment customers'],['Cohort Analysis','Retention curves'],
    ['Revenue Forecast','12-month model'],['Churn Predictor','At-risk customers'],['Trend Analysis','Growth patterns'],
  ];
  return (
    <div style={{padding:'20px 28px', overflowY:'auto', height:'100%'}}>
      <div style={{fontSize:'20px', fontWeight:'800', color:'#1a1714'}}>Good morning, Demo 👋</div>
      <div style={{fontSize:'13px', color:'#9c9490', marginBottom:'20px'}}>Sunday, 29 March 2026</div>

      <div style={{display:'flex', gap:'12px', marginBottom:'20px'}}>
        {[['0','FILES','#9c9490'],['0','TOTAL ROWS','#9c9490'],['Trial','PLAN','#f59e0b']].map(([v,l,c]) => (
          <div key={l} style={{background:'#fff',borderRadius:'10px',border:'1px solid #e8e4e0',padding:'14px 18px',flex:1,textAlign:'center'}}>
            <div style={{fontSize:'22px',fontWeight:'800',color:c}}>{v}</div>
            <div style={{fontSize:'10px',color:'#9c9490',marginTop:'3px'}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap'}}>
        {['📂 Upload Data','🤖 AI Insights','📊 Executive View','💬 Ask Your Data','📄 Auto Report','🎯 RFM Analysis'].map(q => (
          <div key={q} style={{background:'#fff',border:'1px solid #e8e4e0',borderRadius:'20px',padding:'7px 14px',fontSize:'12px',color:'#1a1714',fontWeight:'500'}}>{q}</div>
        ))}
      </div>

      <div style={{fontSize:'13px', fontWeight:'700', color:'#1a1714', marginBottom:'12px'}}>ALL 50 TOOLS</div>

      {[['📦 DATA', '10 tools', tools], ['📈 ANALYSIS', '12 tools', tools2]].map(([cat, count, items]) => (
        <div key={cat} style={{marginBottom:'16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px',fontSize:'13px',fontWeight:'700',color:'#1a1714'}}>
            {cat} <span style={{background:'#f59e0b',color:'#1a1714',borderRadius:'20px',padding:'1px 8px',fontSize:'11px',fontWeight:'700'}}>{count}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px'}}>
            {items.map(([name, desc]) => (
              <div key={name} style={{background:'#fff',border:'1px solid #e8e4e0',borderRadius:'10px',padding:'12px'}}>
                <div style={{fontSize:'12px',fontWeight:'600',color:'#1a1714'}}>{name}</div>
                <div style={{fontSize:'11px',color:'#9c9490'}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScreenUpload() {
  const [phase, setPhase] = useState('idle'); // idle → dragging → uploading → done
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setPhase('idle'); setProgress(0);
    const t1 = setTimeout(() => setPhase('dragging'), 700);
    const t2 = setTimeout(() => { setPhase('uploading'); }, 1600);
    let iv;
    const t3 = setTimeout(() => {
      let w = 0;
      iv = setInterval(() => { w += 5; setProgress(w); if (w >= 100) clearInterval(iv); }, 50);
    }, 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearInterval(iv); };
  }, []);

  return (
    <div style={{padding:'20px 28px'}}>
      <div style={{fontSize:'20px',fontWeight:'800',color:'#1a1714'}}>Upload Your Data</div>
      <div style={{fontSize:'13px',color:'#9c9490',marginBottom:'20px'}}>Supports .xlsx, .csv, .xls — any format, no clean-up needed</div>

      <div style={{
        background: phase === 'dragging' ? 'rgba(245,158,11,0.04)' : '#fff',
        border: `2px dashed ${phase === 'dragging' ? '#f59e0b' : '#d1c9c0'}`,
        borderRadius:'16px', padding:'48px 40px', textAlign:'center', marginBottom:'20px',
        transition:'all 0.3s',
        display: phase === 'uploading' || phase === 'done' ? 'none' : 'block',
      }}>
        <div style={{fontSize:'40px',marginBottom:'12px'}}>📂</div>
        <div style={{fontSize:'16px',fontWeight:'700',color:'#1a1714',marginBottom:'6px'}}>Drop a file here or click to browse</div>
        <div style={{fontSize:'13px',color:'#9c9490',marginBottom:'12px'}}>No formatting required — we handle it automatically</div>
        <div style={{display:'flex',gap:'8px',justifyContent:'center'}}>
          {['.xlsx','.csv','.xls','Google Sheets','Xero Export'].map(f => (
            <span key={f} style={{background:'#f0ede9',borderRadius:'6px',padding:'3px 10px',fontSize:'12px',color:'#6b6560',fontWeight:'500'}}>{f}</span>
          ))}
        </div>
      </div>

      {(phase === 'uploading' || phase === 'done') && (
        <div style={{background:'#fff',border:'1px solid #e8e4e0',borderRadius:'10px',padding:'16px 20px',display:'flex',alignItems:'center',gap:'14px',maxWidth:'420px',margin:'0 auto',animation:'slideIn 0.3s ease'}}>
          <span style={{fontSize:'32px'}}>📊</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'14px',fontWeight:'600',color:'#1a1714'}}>Q1_2026_sales.csv</div>
            <div style={{fontSize:'12px',color:'#9c9490',marginBottom:'8px'}}>50 rows · 9 columns · 4.2 KB</div>
            <div style={{background:'#f0ede9',borderRadius:'100px',height:'4px',overflow:'hidden'}}>
              <div style={{height:'100%',background:'linear-gradient(90deg,#f59e0b,#ec4899)',borderRadius:'100px',width:`${progress}%`,transition:'width 0.3s'}} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenProcessing() {
  const steps = [
    'Parsing 50 rows across 9 columns',
    'Detecting column types & relationships',
    'Running 50 analytics tools in parallel',
    'Generating executive summary',
    '✅ Ready — insights available',
  ];
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    setVisible(0);
    steps.forEach((_, i) => {
      setTimeout(() => setVisible(i + 1), i * 600 + 200);
    });
  }, []);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:'20px'}}>
      <div style={{width:'52px',height:'52px',border:'3px solid rgba(245,158,11,0.2)',borderTopColor:'#f59e0b',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
      <div style={{fontSize:'18px',fontWeight:'700',color:'#1a1714'}}>Analysing your data…</div>
      <div style={{display:'flex',flexDirection:'column',gap:'10px',width:'360px'}}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display:'flex',alignItems:'center',gap:'12px',
            background:'#fff',borderRadius:'10px',padding:'11px 16px',
            fontSize:'13px',color:'#1a1714',
            opacity: visible > i ? 1 : 0,
            transition:'opacity 0.4s ease',
          }}>
            <span style={{width:'20px',textAlign:'center'}}>{visible > i ? (i === 4 ? '✅' : '⚡') : '⏳'}</span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenExec() {
  const months = [45,55,62,72,68,82,90];
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul'];
  const regions = [
    {name:'North', pct:72, val:'£24.1k', color:'#f59e0b'},
    {name:'South', pct:65, val:'£21.8k', color:'#ec4899'},
    {name:'East',  pct:58, val:'£23.4k', color:'#10b981'},
    {name:'West',  pct:50, val:'£20.1k', color:'#6366f1'},
  ];
  const [barsVisible, setBarsVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setBarsVisible(true), 300); return () => clearTimeout(t); }, []);

  return (
    <div style={{padding:'20px 28px', overflowY:'auto', height:'100%'}}>
      <div style={{fontSize:'20px',fontWeight:'800',color:'#1a1714',marginBottom:'18px'}}>Executive Dashboard</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px',marginBottom:'20px'}}>
        <KpiCard label="Total Revenue"     value="£89,420"    badge="▲ 18.4% vs last quarter" badgeUp delay={100} />
        <KpiCard label="Active Customers"  value="28"          badge="▲ 9.2% growth"           badgeUp delay={200} />
        <KpiCard label="Avg Order Value"   value="£1,788"     badge="▼ 2.1% pressure"         badgeUp={false} delay={300} />
        <KpiCard label="Top Sales Rep"     value="Sarah Chen" badge="£42,450 revenue"          badgeUp delay={400} />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'14px'}}>
        <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e8e4e0',padding:'18px'}}>
          <div style={{fontSize:'13px',fontWeight:'700',color:'#1a1714',marginBottom:'14px'}}>Monthly Revenue — Jan to Jul 2025</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:'6px',height:'90px'}}>
            {months.map((h, i) => (
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                <div style={{
                  width:'100%',background:'linear-gradient(180deg,#f59e0b,#d97706)',borderRadius:'4px 4px 0 0',
                  height: barsVisible ? `${h}%` : '0%', transition:`height 0.6s ease ${i*0.08}s`,
                }} />
                <div style={{fontSize:'10px',color:'#9c9490'}}>{labels[i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e8e4e0',padding:'18px'}}>
          <div style={{fontSize:'13px',fontWeight:'700',color:'#1a1714',marginBottom:'14px'}}>Revenue by Region</div>
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {regions.map((r, i) => (
              <div key={r.name} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}>
                <div style={{width:'10px',height:'10px',borderRadius:'50%',background:r.color,flexShrink:0}} />
                <div style={{flex:1,color:'#6b6560'}}>{r.name}</div>
                <AnimBar pct={r.pct} color={r.color} delay={i * 100 + 400} />
                <div style={{fontWeight:'700',color:'#1a1714',fontSize:'12px'}}>{r.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenRFM() {
  const segs = [
    {emoji:'🏆', label:'Champions',       color:'#10b981', count:8,  pct:'28%', revenue:'£38,240', barW:'72%', barColor:'#10b981'},
    {emoji:'⭐', label:'Loyal Customers', color:'#f59e0b', count:7,  pct:'25%', revenue:'£29,100', barW:'58%', barColor:'#f59e0b'},
    {emoji:'⚠️', label:'At Risk',         color:'#f97316', count:6,  pct:'21%', revenue:'£12,800', barW:'38%', barColor:'#f97316'},
    {emoji:'❄️', label:'Lost / Inactive', color:'#9c9490', count:7,  pct:'25%', revenue:'£9,280',  barW:'25%', barColor:'#b5b0ac'},
  ];
  const rows = [
    ['Acme Ltd',      'Champion',  'rgba(16,185,129,0.1)','#10b981', '27 Apr 2025','3','£3,794','5-5-5'],
    ['Ironclad Inc',  'Champion',  'rgba(16,185,129,0.1)','#10b981', '26 May 2025','2','£4,190','5-4-5'],
    ['NovaTech',      'Loyal',     'rgba(245,158,11,0.1)','#f59e0b', '17 Jun 2025','2','£3,493','4-4-4'],
    ['Delta Systems', 'At Risk',   'rgba(249,115,22,0.1)','#f97316', '15 Jan 2025','2','£1,196','2-2-3'],
    ['BrightStar Inc','Lost',      'rgba(107,101,96,0.1)','#6b6560', '8 Jan 2025', '1','£999',  '1-1-2'],
  ];
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 200); return () => clearTimeout(t); }, []);

  return (
    <div style={{padding:'20px 28px', overflowY:'auto', height:'100%'}}>
      <div style={{fontSize:'20px',fontWeight:'800',color:'#1a1714',marginBottom:'18px'}}>🎯 RFM Customer Segmentation</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'16px'}}>
        {segs.map((s, i) => (
          <div key={s.label} style={{background:'#fff',borderRadius:'12px',border:'1px solid #e8e4e0',padding:'16px',opacity:visible?1:0,transition:`opacity 0.4s ease ${i*0.1}s`}}>
            <div style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.5px',color:s.color,marginBottom:'6px'}}>{s.emoji} {s.label}</div>
            <div style={{fontSize:'30px',fontWeight:'800',color:'#1a1714'}}>{s.count}</div>
            <div style={{fontSize:'12px',color:'#9c9490',marginTop:'3px'}}>{s.pct} · {s.revenue}</div>
            <div style={{height:'5px',borderRadius:'100px',marginTop:'10px',background:'#f0ede9',overflow:'hidden'}}>
              <div style={{height:'100%',background:s.barColor,width:visible?s.barW:'0%',transition:`width 0.8s ease ${i*0.15+0.3}s`}} />
            </div>
          </div>
        ))}
      </div>
      <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e8e4e0',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{background:'#f7f6f5'}}>
            <tr>{['Customer','Segment','Last Purchase','Orders','Total Spend','RFM Score'].map(h => (
              <th key={h} style={{padding:'10px 14px',fontSize:'11px',fontWeight:'700',color:'#9c9490',textAlign:'left',borderBottom:'1px solid #e8e4e0',textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map(([cust,seg,bg,col,date,orders,spend,score]) => (
              <tr key={cust}>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'#1a1714',borderBottom:'1px solid #f0ede9'}}>{cust}</td>
                <td style={{padding:'10px 14px',borderBottom:'1px solid #f0ede9'}}>
                  <span style={{background:bg,color:col,borderRadius:'20px',padding:'3px 10px',fontSize:'11px',fontWeight:'700'}}>{seg}</span>
                </td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'#6b6560',borderBottom:'1px solid #f0ede9'}}>{date}</td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'#1a1714',borderBottom:'1px solid #f0ede9'}}>{orders}</td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'#1a1714',borderBottom:'1px solid #f0ede9'}}>{spend}</td>
                <td style={{padding:'10px 14px',fontSize:'13px',color:'#6b6560',borderBottom:'1px solid #f0ede9',fontFamily:'monospace'}}>{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScreenAI() {
  const cards = [
    {icon:'📈', title:'Revenue Growth',    text:'Revenue grew 18.4% quarter-on-quarter, driven by Analytics Pro which accounts for 52% of total sales.'},
    {icon:'⚠️', title:'Churn Risk',         text:'7 customers haven\'t purchased in 90+ days. BrightStar Inc and Delta Systems are high-value at-risk accounts — immediate outreach recommended.'},
    {icon:'🎯', title:'Sales Opportunity', text:'8 Champion customers have never purchased the Data Suite. Cross-sell potential of £8,000+ based on AOV benchmarks.'},
  ];
  const [typed, setTyped] = useState('');
  const [cardsVisible, setCardsVisible] = useState(false);

  useEffect(() => {
    setTyped(''); setCardsVisible(false);
    const t1 = setTimeout(() => setCardsVisible(true), 200);
    let i = 0;
    const t2 = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setTyped(AI_TEXT.slice(0, i));
        if (i >= AI_TEXT.length) clearInterval(iv);
      }, 16);
      return () => clearInterval(iv);
    }, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={{padding:'20px 28px', overflowY:'auto', height:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'18px'}}>
        <div style={{fontSize:'20px',fontWeight:'800',color:'#1a1714'}}>AI Insights</div>
        <span style={{background:'linear-gradient(135deg,#f59e0b,#ec4899)',color:'#fff',borderRadius:'8px',padding:'5px 12px',fontSize:'12px',fontWeight:'700'}}>🤖 GPT-4o Powered</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px',marginBottom:'16px'}}>
        {cards.map((c, i) => (
          <div key={c.title} style={{background:'#fff',borderRadius:'12px',border:'1px solid #e8e4e0',padding:'18px',opacity:cardsVisible?1:0,transition:`opacity 0.4s ease ${i*0.15}s`}}>
            <div style={{fontSize:'24px',marginBottom:'10px'}}>{c.icon}</div>
            <div style={{fontSize:'13px',fontWeight:'700',color:'#1a1714',marginBottom:'7px'}}>{c.title}</div>
            <div style={{fontSize:'12px',color:'#6b6560',lineHeight:'1.6'}}>{c.text}</div>
          </div>
        ))}
      </div>
      <div style={{background:'#fff',border:'1px solid #e8e4e0',borderRadius:'12px',padding:'18px'}}>
        <div style={{fontSize:'13px',fontWeight:'700',color:'#1a1714',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
          💬 Executive Summary
          <span style={{fontSize:'11px',color:'#9c9490',fontWeight:'400'}}>Generated in 1.2s</span>
        </div>
        <div style={{fontSize:'13px',color:'#6b6560',lineHeight:'1.8',whiteSpace:'pre-wrap'}}>
          {typed}
          {typed.length < AI_TEXT.length && <span style={{display:'inline-block',width:'2px',height:'14px',background:'#f59e0b',verticalAlign:'middle',animation:'blink 0.8s infinite',marginLeft:'2px'}} />}
        </div>
      </div>
    </div>
  );
}

// ─── Shell ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {icon:'🏠', label:'Hub Home',           screen:'dashboard'},
  {icon:'📊', label:'Executive Dashboard', screen:'exec'},
  {icon:'🧩', label:'Dashboard Builder',  screen:null},
  {icon:'🔀', label:'Data Blending',      screen:null},
  {icon:'📋', label:'Data Table',         screen:null},
  {icon:'📈', label:'KPI Dashboard',      screen:null},
  {icon:'📝', label:'Data Summary',       screen:null},
  {icon:'✅', label:'Data Quality',       screen:null},
];

const SCREEN_TITLES = { dashboard:'Hub Home', upload:'Upload Data', processing:'Analysing…', exec:'Executive Dashboard', rfm:'RFM Segmentation', ai:'AI Insights' };

export default function DemoPlayer() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const go = (idx) => {
    clearTimeout(timerRef.current);
    setCurrent(idx);
  };

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      go((current + 1) % SCREENS.length);
    }, SCREENS[current].duration);
    return () => clearTimeout(timerRef.current);
  }, [current]);

  const screenId = SCREENS[current].id;
  const title = SCREEN_TITLES[screenId];

  return (
    <div style={{display:'flex', height:'100%', fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow:'hidden'}}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Sidebar */}
      <div style={{width:'210px',minWidth:'210px',background:'#1a1714',display:'flex',flexDirection:'column',borderRight:'1px solid rgba(245,158,11,0.1)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'18px 16px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{width:'30px',height:'30px',background:'linear-gradient(135deg,#f59e0b,#d97706)',borderRadius:'7px',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'800',fontSize:'15px',color:'#1a1714'}}>D</div>
          <div>
            <div style={{fontSize:'13px',fontWeight:'700',color:'#f5f0eb'}}>DataHub Pro</div>
            <div style={{fontSize:'10px',color:'#6b6560'}}>v3.8 Analytics Platform</div>
          </div>
        </div>
        <div style={{padding:'14px 10px 4px',fontSize:'10px',color:'#6b6560',letterSpacing:'1px',textTransform:'uppercase'}}>Home</div>
        {NAV_ITEMS.slice(0,3).map(n => <SidebarItem key={n.label} icon={n.icon} label={n.label} active={n.screen === screenId} />)}
        <div style={{padding:'14px 10px 4px',fontSize:'10px',color:'#6b6560',letterSpacing:'1px',textTransform:'uppercase'}}>Data</div>
        {NAV_ITEMS.slice(3).map(n => <SidebarItem key={n.label} icon={n.icon} label={n.label} active={n.screen === screenId} />)}
        <div style={{marginTop:'auto',padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.06)',fontSize:'12px',color:'#6b6560'}}>
          <strong style={{display:'block',color:'#9c9490'}}>Demo User</strong>
          DataHub Demo Co
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f7f6f5',overflow:'hidden'}}>
        {/* Topbar */}
        <div style={{background:'#fff',borderBottom:'1px solid #e8e4e0',padding:'0 24px',height:'52px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontSize:'15px',fontWeight:'700',color:'#1a1714'}}>{title}</div>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <button style={{background:'#ec4899',color:'#fff',border:'none',borderRadius:'8px',padding:'7px 14px',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>+ Upload Data</button>
            <div style={{width:'30px',height:'30px',background:'linear-gradient(135deg,#f59e0b,#d97706)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'12px',color:'#1a1714'}}>D</div>
          </div>
        </div>

        {/* Screen content */}
        <div style={{flex:1,overflow:'hidden',position:'relative'}}>
          {screenId === 'dashboard'  && <ScreenDashboard key={current} />}
          {screenId === 'upload'     && <ScreenUpload    key={current} />}
          {screenId === 'processing' && <ScreenProcessing key={current} />}
          {screenId === 'exec'       && <ScreenExec      key={current} />}
          {screenId === 'rfm'        && <ScreenRFM       key={current} />}
          {screenId === 'ai'         && <ScreenAI        key={current} />}
        </div>

        {/* Progress bar */}
        <div style={{background:'#1a1714',borderTop:'1px solid rgba(245,158,11,0.15)',padding:'10px 20px',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
          <span style={{fontSize:'11px',color:'#6b6560',whiteSpace:'nowrap'}}>Demo</span>
          <div style={{display:'flex',gap:'6px',flex:1}}>
            {SCREENS.map((s, i) => (
              <div
                key={s.id}
                onClick={() => go(i)}
                title={s.label}
                style={{flex:1,height:'3px',background:'rgba(245,158,11,0.15)',borderRadius:'100px',overflow:'hidden',cursor:'pointer'}}
              >
                <div style={{
                  height:'100%',borderRadius:'100px',background:'#f59e0b',
                  width: i < current ? '100%' : i === current ? '100%' : '0%',
                  transition: i === current ? `width ${s.duration}ms linear` : 'none',
                  animationFillMode: 'forwards',
                }} />
              </div>
            ))}
          </div>
          <span style={{fontSize:'11px',color:'#f59e0b',fontWeight:'600',whiteSpace:'nowrap'}}>{SCREENS[current].label}</span>
          <button
            onClick={() => go(0)}
            style={{background:'rgba(245,158,11,0.12)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.25)',borderRadius:'6px',padding:'4px 10px',fontSize:'11px',cursor:'pointer'}}
          >↩ Restart</button>
        </div>
      </div>
    </div>
  );
}
