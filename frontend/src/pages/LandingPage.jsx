import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BRAND = { navy: '#0c1446', pink: '#e91e8c', teal: '#0097b2' }

function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const step = (ts) => {
      if (!startTime) startTime = ts
      const p = Math.min((ts - startTime) / duration, 1)
      setCount(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

function AnimatedStat({ value, suffix, label, start }) {
  const num = useCountUp(value, 1800, start)
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{num.toLocaleString()}{suffix}</div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', marginTop: 6 }}>{label}</div>
    </div>
  )
}

const FEATURES = [
  { icon: '📊', title: 'Executive Dashboard', desc: 'Auto-detect KPIs, revenue trends and top performers from any spreadsheet instantly', badge: 'Popular' },
  { icon: '🤖', title: 'AI-Powered Insights', desc: 'Ask questions in plain English. Get boardroom-ready answers from your data in seconds', badge: 'AI' },
  { icon: '🎯', title: 'RFM Analysis', desc: 'Segment customers by Recency, Frequency and Monetary value to drive retention', badge: null },
  { icon: '📈', title: 'Forecasting Engine', desc: 'Linear regression forecasting with confidence intervals to predict future performance', badge: null },
  { icon: '⚠️', title: 'Anomaly Detection', desc: 'Automatically flag outliers and unusual patterns before they become problems', badge: null },
  { icon: '🔗', title: 'Correlation Matrix', desc: 'Discover hidden relationships between metrics that Excel can never show you', badge: null },
  { icon: '🔄', title: 'Pivot Table Pro', desc: 'Drag-and-drop pivot tables with unlimited dimensions and custom aggregations', badge: null },
  { icon: '💰', title: 'NPV Calculator', desc: 'Model investment scenarios with Net Present Value and IRR analysis in seconds', badge: 'Finance' },
  { icon: '📉', title: 'Cohort Analysis', desc: 'Track how customer groups behave over time to optimise lifetime value', badge: null },
  { icon: '⚗️', title: 'Formula Engine', desc: '200+ Excel-compatible functions running in the browser — no installation needed', badge: null },
  { icon: '📄', title: 'Auto Report', desc: 'One-click PDF reports with AI-written narrative, charts and executive summary', badge: 'AI' },
  { icon: '💧', title: 'Waterfall Charts', desc: 'Visualise contribution analysis and variance breakdowns for any dataset', badge: null },
]

const TESTIMONIALS = [
  { quote: 'We replaced a £60k/year analyst team with DataHub Pro. The ROI was visible within 30 days.', name: 'Sarah Chen', role: 'CFO', company: 'RetailCo UK', avatar: 'SC' },
  { quote: 'The RFM segmentation alone increased our repeat purchase rate by 34% in one quarter.', name: 'Marcus Webb', role: 'Head of Growth', company: 'EcomBrand', avatar: 'MW' },
  { quote: "Finally, a BI tool that doesn't require a PhD in data science. Our whole team adopted it in a week.", name: 'Priya Sharma', role: 'Operations Director', company: 'LogiSME Ltd', avatar: 'PS' },
]

const PLANS = [
  { name: 'Starter', monthly: 49, annual: 39, desc: 'Perfect for small teams', features: ['3 users', '10 uploads/month', 'All 50 analytics tools', 'AI insights (50 queries/mo)', 'Email support', '14-day free trial'], color: '#0097b2', cta: 'Start free trial' },
  { name: 'Growth', monthly: 149, annual: 119, desc: 'For data-driven teams', features: ['10 users', 'Unlimited uploads', 'All 50 analytics tools', 'Unlimited AI insights', 'Scheduled PDF reports', 'Priority support', '14-day free trial'], color: '#e91e8c', popular: true, cta: 'Start free trial' },
  { name: 'Enterprise', monthly: 499, annual: 399, desc: 'Full enterprise capability', features: ['Unlimited users', 'Unlimited uploads', 'All 50 analytics tools', 'Unlimited AI + custom models', 'SSO / SAML', 'UK/EU data residency', 'Dedicated CSM', 'SLA 99.9% uptime', 'Custom onboarding'], color: '#0c1446', cta: 'Book a demo' },
]

const ALL_TOOLS = [
  '📋 Data View','📊 Data Summary','✅ Data Quality','🧹 Data Cleaner','🔀 Data Blending','🔍 Advanced Filter',
  '📊 Value Frequency','🔢 KPI Dashboard','🔄 Pivot Table','🤔 What-If Scenarios','⚠️ Anomaly Detection',
  '📅 Period Comparison','📐 Variance Analysis','📈 Regression Analysis','🔗 Correlation Matrix',
  '👥 Cohort Analysis','📉 Trend Analysis','🎯 RFM Analysis','80% Pareto Analysis','🎯 Customer Segmentation',
  '🔮 Forecasting','🏁 Goal Tracker','⚖️ Break-Even Calc','〰️ Rolling Average','📊 Bar Chart',
  '📈 Line Chart','🥧 Pie Chart','🌡️ Heatmap','💧 Waterfall Chart','✦ Scatter Plot',
  '📉 Combo Chart','🔻 Funnel Chart','📦 Box Plot','💰 NPV Calculator','⚗️ Formula Engine',
  '📗 Excel Functions','🔧 Formula Builder AI','💬 Ask Your Data','📄 Auto Report','✍️ AI Narrative',
  '🎨 Conditional Format','🧠 AI Insights','⏰ Scheduled Reports','🔌 Integrations',
  '👥 Workspace & Roles','📜 Audit Log','⚙️ AI Settings','📊 Executive Dashboard','🎨 Dashboard Builder','🏠 Hub Home',
]

export default function LandingPage() {
  const { user } = useAuth()
  const [annual, setAnnual] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.3 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(12,20,70,0.97)', backdropFilter: 'blur(12px)', padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#e91e8c,#0097b2)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem' }}>D</div>
          DataHub Pro
        </div>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {[['Features','#features'],['Pricing','#pricing'],['All Tools','#tools']].map(([l,h]) => (
            <a key={h} href={h} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e=>e.target.style.color='#fff'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.7)'}>{l}</a>
          ))}
          {user ? (
            <Link to="/hub" style={{ background: 'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', padding: '9px 22px', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', boxShadow: '0 4px 14px rgba(233,30,140,0.4)' }}>Go to Dashboard →</Link>
          ) : (<>
            <Link to="/login" style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
            <Link to="/register" style={{ background: 'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', padding: '9px 22px', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', boxShadow: '0 4px 14px rgba(233,30,140,0.4)' }}>Start free trial →</Link>
          </>)}
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(150deg,#080e30 0%,#0c1446 50%,#0d1f6e 100%)', padding: '100px 40px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, background: 'radial-gradient(circle,rgba(233,30,140,0.15) 0%,transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-30%', left: '-10%', width: 500, height: 500, background: 'radial-gradient(circle,rgba(0,151,178,0.12) 0%,transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(233,30,140,0.15)', border: '1px solid rgba(233,30,140,0.35)', color: '#e91e8c', padding: '7px 18px', borderRadius: 24, fontSize: '0.8rem', fontWeight: 700, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, background: '#e91e8c', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 6px #e91e8c' }} />
            50 Analytics Tools · Enterprise-Grade · No Setup Required
          </div>
          <h1 style={{ fontSize: 'clamp(2.4rem,5.5vw,3.8rem)', fontWeight: 900, lineHeight: 1.1, maxWidth: 780, margin: '0 auto 24px', color: '#fff', letterSpacing: '-0.02em' }}>
            Turn Excel spreadsheets into{' '}
            <span style={{ background: 'linear-gradient(135deg,#e91e8c,#0097b2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>boardroom intelligence</span>
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.72)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7 }}>
            50 analytics tools, AI narrative, forecasting, RFM and cohort analysis — all from your existing spreadsheets. No analyst, no BI team, no wait.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            {user
                ? <Link to="/hub" style={{ background: 'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', padding: '15px 36px', borderRadius: 10, fontWeight: 800, fontSize: '1rem', textDecoration: 'none', boxShadow: '0 8px 32px rgba(233,30,140,0.45)' }}>Open Dashboard →</Link>
                : <Link to="/register" style={{ background: 'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', padding: '15px 36px', borderRadius: 10, fontWeight: 800, fontSize: '1rem', textDecoration: 'none', boxShadow: '0 8px 32px rgba(233,30,140,0.45)' }}>Start 14-day free trial →</Link>
              }
            <a href="#features" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '15px 36px', borderRadius: 10, fontWeight: 600, fontSize: '1rem', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.18)' }}>See all 50 tools ↓</a>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}>No credit card required · Cancel anytime · GDPR compliant</p>
        </div>
      </div>

      {/* STATS */}
      <div ref={statsRef} style={{ background: 'linear-gradient(135deg,#0097b2,#0c1446)', padding: '52px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32 }}>
          <AnimatedStat value={50} suffix="+" label="Analytics Tools Included" start={statsVisible} />
          <AnimatedStat value={200} suffix="+" label="Excel-Compatible Functions" start={statsVisible} />
          <AnimatedStat value={14} suffix=" day" label="Free Trial, No Card" start={statsVisible} />
          <AnimatedStat value={99} suffix="%" label="Uptime SLA (Enterprise)" start={statsVisible} />
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ padding: '96px 40px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-block', background: '#f0f2f8', color: BRAND.navy, padding: '6px 16px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 900, color: BRAND.navy, margin: '0 0 16px', letterSpacing: '-0.02em' }}>Everything an SME needs to compete with enterprise</h2>
          <p style={{ color: '#5a6290', fontSize: '1.05rem', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>Built for finance teams, ops leaders and CEOs who want data superpowers without a data team</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 22 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ padding: 28, border: '1px solid #e8eaf4', borderRadius: 16, background: '#fff', position: 'relative', transition: 'all 0.2s', cursor: 'default', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#e91e8c'; e.currentTarget.style.boxShadow='0 8px 32px rgba(233,30,140,0.12)'; e.currentTarget.style.transform='translateY(-3px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#e8eaf4'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform='translateY(0)' }}>
              {f.badge && <span style={{ position: 'absolute', top: 16, right: 16, background: f.badge==='AI'?'linear-gradient(135deg,#7c3aed,#4f46e5)':f.badge==='Finance'?'linear-gradient(135deg,#059669,#047857)':'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700 }}>{f.badge}</span>}
              <div style={{ fontSize: '2rem', marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: BRAND.navy, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: '0.875rem', color: '#5a6290', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ALL 50 TOOLS */}
      <div id="tools" style={{ background: 'linear-gradient(135deg,#f8f9ff,#f0f2f8)', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', background: BRAND.navy, color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, marginBottom: 16 }}>50 Tools Included</div>
            <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.4rem)', fontWeight: 900, color: BRAND.navy, margin: '0 0 16px', letterSpacing: '-0.02em' }}>One platform. Every analysis you will ever need.</h2>
            <p style={{ color: '#5a6290', maxWidth: 500, margin: '0 auto' }}>Every tool included in every plan. No add-ons, no modules, no surprises.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {ALL_TOOLS.map((tool, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 24, padding: '8px 18px', fontSize: '0.82rem', fontWeight: 600, color: BRAND.navy, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.background=BRAND.navy; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor=BRAND.navy }}
                onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color=BRAND.navy; e.currentTarget.style.borderColor='#e8eaf4' }}>
                {tool}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div style={{ padding: '96px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-block', background: '#f0f2f8', color: BRAND.navy, padding: '6px 16px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer Stories</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.4rem)', fontWeight: 900, color: BRAND.navy, margin: 0, letterSpacing: '-0.02em' }}>Trusted by finance teams across the UK</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24 }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e8eaf4', borderRadius: 16, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>{[...Array(5)].map((_,j)=><span key={j} style={{ color:'#f59e0b',fontSize:'1rem' }}>★</span>)}</div>
              <p style={{ color: '#374151', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: 24, fontStyle: 'italic' }}>"{t.quote}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, background: 'linear-gradient(135deg,#e91e8c,#0097b2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>{t.avatar}</div>
                <div>
                  <div style={{ fontWeight: 700, color: BRAND.navy, fontSize: '0.9rem' }}>{t.name}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{t.role} · {t.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" style={{ background: 'linear-gradient(135deg,#f8f9ff,#f0f2f8)', padding: '96px 40px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: BRAND.pink, color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, marginBottom: 16 }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.4rem)', fontWeight: 900, color: BRAND.navy, margin: '0 0 12px', letterSpacing: '-0.02em' }}>Simple, transparent pricing</h2>
          <p style={{ color: '#5a6290', marginBottom: 36 }}>Start free. No credit card. Cancel anytime.</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0, background: '#fff', border: '1px solid #e8eaf4', borderRadius: 32, padding: 4, marginBottom: 48 }}>
            <button onClick={() => setAnnual(false)} style={{ padding: '8px 24px', borderRadius: 24, border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', background: !annual ? BRAND.navy : 'transparent', color: !annual ? '#fff' : '#6b7280', transition: 'all 0.2s' }}>Monthly</button>
            <button onClick={() => setAnnual(true)} style={{ padding: '8px 24px', borderRadius: 24, border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', background: annual ? BRAND.navy : 'transparent', color: annual ? '#fff' : '#6b7280', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8 }}>
              Annual <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem' }}>Save 20%</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {PLANS.map((p, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '32px 28px', border: p.popular ? '2px solid #e91e8c' : '1px solid #e8eaf4', position: 'relative', boxShadow: p.popular ? '0 12px 48px rgba(233,30,140,0.18)' : '0 2px 12px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-4px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                {p.popular && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', padding: '5px 18px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>✦ MOST POPULAR</div>}
                <div style={{ marginBottom: 6, fontSize: '0.78rem', fontWeight: 700, color: '#8b92b3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{p.name}</div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: '2.8rem', fontWeight: 900, color: p.color }}>£{annual ? p.annual : p.monthly}</span>
                  <span style={{ color: '#8b92b3', fontSize: '0.9rem' }}>/month</span>
                </div>
                {annual && <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 700, marginBottom: 12 }}>Save £{(p.monthly - p.annual) * 12}/year</div>}
                <p style={{ color: '#6b7280', fontSize: '0.83rem', marginBottom: 24 }}>{p.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', textAlign: 'left' }}>
                  {p.features.map((f,j) => <li key={j} style={{ padding: '5px 0', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {f}</li>)}
                </ul>
                <Link to="/register" style={{ display: 'block', textAlign: 'center', background: p.popular ? 'linear-gradient(135deg,#e91e8c,#c4166e)' : p.color, color: '#fff', padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', boxShadow: p.popular ? '0 6px 20px rgba(233,30,140,0.35)' : 'none' }}>{p.cta} →</Link>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            {['🔒 SOC2 compliant','🇬🇧 UK data residency (Enterprise)','🛡️ GDPR ready','💳 No lock-in contracts'].map((t,i)=>(
              <div key={i} style={{ color: '#5a6290', fontSize: '0.85rem', fontWeight: 500 }}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: 'linear-gradient(135deg,#0c1446,#1a2a8c)', padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 900, color: '#fff', margin: '0 0 20px', letterSpacing: '-0.02em' }}>Ready to replace your analyst with AI?</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', marginBottom: 36, lineHeight: 1.7 }}>Join hundreds of UK SMEs turning Excel files into competitive intelligence. 14 days free, no card needed.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" style={{ background: 'linear-gradient(135deg,#e91e8c,#c4166e)', color: '#fff', padding: '15px 36px', borderRadius: 10, fontWeight: 800, fontSize: '1rem', textDecoration: 'none', boxShadow: '0 8px 32px rgba(233,30,140,0.45)' }}>Start free trial →</Link>
            <a href="mailto:sales@datahubpro.io" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '15px 36px', borderRadius: 10, fontWeight: 600, fontSize: '1rem', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)' }}>Talk to sales</a>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: '#080e30', padding: '48px 40px 32px', color: 'rgba(255,255,255,0.45)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 40 }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#e91e8c,#0097b2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem' }}>D</div>
                DataHub Pro
              </div>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.7, maxWidth: 260, margin: 0 }}>Enterprise-grade analytics for SMEs. Turn your spreadsheets into strategic intelligence.</p>
            </div>
            {[['Product',['Features','Pricing','All 50 Tools','Security','Changelog']],['Company',['About','Blog','Careers','Partners','Press']],['Legal',['Privacy Policy','Terms of Service','Cookie Policy','GDPR','DPA']]].map(([title,links])=>(
              <div key={title}>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 16, fontSize: '0.85rem' }}>{title}</div>
                {links.map(l=><div key={l} style={{ marginBottom: 10, fontSize: '0.83rem' }}>{l}</div>)}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: '0.82rem' }}>© 2025 DataHub Pro Ltd. Registered in England & Wales.</span>
            <div style={{ display: 'flex', gap: 20, fontSize: '0.82rem' }}>
              <span>🇬🇧 UK-based</span><span>🔒 GDPR Compliant</span><span>🛡️ ISO 27001 Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
