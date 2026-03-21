import React from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Nav */}
      <nav style={{ background: '#0c1446', padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#e91e8c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>D</div>
          DataHub Pro
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link to="/login" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', textDecoration: 'none' }}>Sign in</Link>
          <Link to="/register" style={{ background: '#e91e8c', color: '#fff', padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none' }}>Start free trial →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0c1446 0%, #1a2a6c 100%)', padding: '80px 40px', textAlign: 'center', color: '#fff' }}>
        <div style={{ display: 'inline-block', background: 'rgba(233,30,140,0.2)', border: '1px solid rgba(233,30,140,0.4)', color: '#e91e8c', padding: '6px 16px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, marginBottom: 24 }}>
          Enterprise Analytics for SMEs
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 900, lineHeight: 1.15, maxWidth: 700, margin: '0 auto 20px' }}>
          Turn your Excel data into boardroom-ready insights
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.8, maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.6 }}>
          30+ analytics tools, AI-powered insights, executive dashboards — all from your existing spreadsheets. No analyst needed.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{ background: '#e91e8c', color: '#fff', padding: '14px 32px', borderRadius: 10, fontWeight: 700, fontSize: '1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Start free 14-day trial →
          </Link>
          <Link to="/login" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '14px 32px', borderRadius: 10, fontWeight: 600, fontSize: '1rem', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)' }}>
            Sign in
          </Link>
        </div>
        <p style={{ marginTop: 20, opacity: 0.6, fontSize: '0.85rem' }}>No credit card required · Cancel anytime</p>
      </div>

      {/* Features */}
      <div style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, color: '#0c1446', marginBottom: 48 }}>Everything an SME needs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
          {[
            { icon: '📊', title: 'Executive Dashboard', desc: 'Auto-detect KPIs, revenue trends, and top performers from any spreadsheet' },
            { icon: '🤖', title: 'AI-Powered Insights', desc: 'Ask questions in plain English. Get answers from your data instantly' },
            { icon: '📈', title: 'Forecasting', desc: 'Linear regression forecasting to predict future performance' },
            { icon: '🎯', title: 'RFM Analysis', desc: 'Segment customers by Recency, Frequency, and Monetary value' },
            { icon: '🔍', title: 'Anomaly Detection', desc: 'Automatically flag outliers and unusual patterns in your data' },
            { icon: '⚡', title: 'Variance Analysis', desc: 'Compare actuals vs budget with favourable/unfavourable breakdowns' },
            { icon: '📉', title: 'Cohort Analysis', desc: 'Track how groups of customers behave over time periods' },
            { icon: '🔗', title: 'Correlation Matrix', desc: 'Discover hidden relationships between your business metrics' },
          ].map((f, i) => (
            <div key={i} style={{ padding: 24, border: '1px solid #e2e5f1', borderRadius: 12, background: '#fff' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0c1446', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a5280', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ background: '#f0f2f8', padding: '80px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0c1446', marginBottom: 8 }}>Simple, transparent pricing</h2>
          <p style={{ color: '#4a5280', marginBottom: 48 }}>Start free. Scale as you grow.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { name: 'Starter', price: '99', desc: '/month', features: ['3 users', '10 uploads/month', 'All analytics tools', 'Email support'], color: '#0097b2' },
              { name: 'Growth', price: '249', desc: '/month', features: ['10 users', 'Unlimited uploads', 'AI features', 'Scheduled reports', 'Priority support'], color: '#e91e8c', popular: true },
              { name: 'Enterprise', price: null, desc: 'Contact us', features: ['Unlimited users', 'Unlimited uploads', 'SSO / SAML', 'Data residency', 'Dedicated support', 'SLA guarantee'], color: '#0c1446' },
            ].map((p, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 28, border: p.popular ? '2px solid #e91e8c' : '1px solid #e2e5f1', position: 'relative' }}>
                {p.popular && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#e91e8c', color: '#fff', padding: '4px 16px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>MOST POPULAR</div>}
                <h3 style={{ fontWeight: 800, color: '#0c1446', marginBottom: 8 }}>{p.name}</h3>
                <div style={{ marginBottom: 20 }}>{p.price ? <><span style={{ fontSize: '2.2rem', fontWeight: 900, color: p.color }}>£{p.price}</span><span style={{ color: '#8b92b3' }}>{p.desc}</span></> : <span style={{ fontSize: '1.8rem', fontWeight: 900, color: p.color }}>{p.desc}</span>}</div>
                <ul style={{ listStyle: 'none', marginBottom: 24, textAlign: 'left' }}>
                  {p.features.map((f, j) => <li key={j} style={{ padding: '4px 0', fontSize: '0.85rem', color: '#4a5280' }}>✓ {f}</li>)}
                </ul>
                <Link to="/register" style={{ display: 'block', textAlign: 'center', background: p.color, color: '#fff', padding: '10px', borderRadius: 8, fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none' }}>Start free trial</Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#0c1446', padding: '32px 40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
        © 2025 DataHub Pro. Enterprise analytics for SMEs. All rights reserved.
      </div>
    </div>
  )
}
