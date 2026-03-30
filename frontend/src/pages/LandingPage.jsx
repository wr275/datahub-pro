import { useEffect, useRef, useState } from 'react';
import './LandingPage.css';
import DemoPlayer from '../components/DemoPlayer';

export default function LandingPage() {
  const navRef = useRef(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Nav scroll effect
    const handleScroll = () => {
      if (navRef.current) {
        navRef.current.classList.toggle('scrolled', window.scrollY > 20);
      }
    };
    window.addEventListener('scroll', handleScroll);

    // Immediately reveal elements already visible in the viewport (above fold)
    document.querySelectorAll('.reveal').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('visible');
      }
    });

    // Observer handles below-fold elements as user scrolls
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      observer.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* ══════════ NAV ══════════ */}
      <nav className="dhp-nav" id="main-nav" ref={navRef}>
        <a href="/" className="nav-logo">
          <div className="nav-logo-mark">D</div>
          DataHub Pro
        </a>
        <ul className="nav-links">
          <li><a href="#how-it-works">How it Works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#integrations">Integrations</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
        <div className="nav-right">
          <button className="btn-ghost" onClick={() => window.location.href = '/login'}>Sign in</button>
          <button className="btn-nav" onClick={() => setContactOpen(true)}>Request a trial →</button>
        </div>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <div className="hero">
        <div className="hero-left">
          <div className="eyebrow reveal">Analytics Platform for SMEs</div>
          <h1 className="dhp-h1 reveal reveal-delay-1">
            Stop guessing.<br />Start <span className="hi">knowing</span><br />your numbers.
          </h1>
          <p className="hero-sub reveal reveal-delay-2">
            50 analytics tools that turn your existing Excel and CSV files into clear, actionable intelligence — no analyst, no BI team, no waiting.
          </p>
          <div className="cta-row reveal reveal-delay-3">
            <button className="btn-primary" onClick={() => setContactOpen(true)}>Request a free trial →</button>
            <button className="btn-secondary" onClick={() => setDemoOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
              </svg>
              Watch 2-min demo
            </button>
          </div>
          <div className="trust-row reveal reveal-delay-4">
            <span className="trust-item"><span className="trust-icon">✓</span> Approval required</span>
            <span className="trust-item"><span className="trust-icon">✓</span> GDPR compliant</span>
            <span className="trust-item"><span className="trust-icon">✓</span> No obligation</span>
            <span className="trust-item"><span className="trust-icon">✓</span> Response within 1 day</span>
          </div>
        </div>

        <div className="hero-right reveal reveal-delay-2">
          <div className="terminal">
            <div className="term-bar">
              <div className="term-dot" style={{background:'#f87171'}}></div>
              <div className="term-dot" style={{background:'#fbbf24'}}></div>
              <div className="term-dot" style={{background:'#34d399'}}></div>
              <div className="term-title">datahubpro — Q1_2026_sales.csv → executive_dashboard</div>
            </div>
            <div className="term-body">
              <div className="kpi-grid">
                <div className="kpi-tile amber-border">
                  <div className="kpi-label">total_revenue</div>
                  <div className="kpi-val amber">£284,320</div>
                  <div className="kpi-change up">▲ +18.4% vs last quarter</div>
                </div>
                <div className="kpi-tile">
                  <div className="kpi-label">active_customers</div>
                  <div className="kpi-val">1,248</div>
                  <div className="kpi-change up">▲ +9.2% growth</div>
                </div>
                <div className="kpi-tile">
                  <div className="kpi-label">avg_order_value</div>
                  <div className="kpi-val">£228</div>
                  <div className="kpi-change dn">▼ -2.1% pressure</div>
                </div>
                <div className="kpi-tile amber-border">
                  <div className="kpi-label">churn_rate</div>
                  <div className="kpi-val amber">3.2%</div>
                  <div className="kpi-change up">▲ improving trend</div>
                </div>
              </div>
              <div className="data-grid">
                <div className="data-block">
                  <div className="data-title">// rfm_segments</div>
                  <div className="data-row"><span className="data-key">champions</span><span className="data-val a">38%</span></div>
                  <div className="data-row"><span className="data-key">loyal</span><span className="data-val g">25%</span></div>
                  <div className="data-row"><span className="data-key">at_risk</span><span className="data-val r">19%</span></div>
                  <div className="data-row"><span className="data-key">lost</span><span className="data-val r">11%</span></div>
                  <div className="data-row"><span className="data-key">new</span><span className="data-val g">7%</span></div>
                </div>
                <div className="data-block">
                  <div className="data-title">// q2_forecast</div>
                  <div className="mini-bar-row">
                    <div className="mb-label-row"><span>Jan</span><span style={{color:'#fff'}}>£82K</span></div>
                    <div className="mb-track"><div className="mb-fill" style={{width:'82%'}}></div></div>
                    <div className="mb-label-row"><span>Feb</span><span style={{color:'#fff'}}>£91K</span></div>
                    <div className="mb-track"><div className="mb-fill" style={{width:'91%'}}></div></div>
                    <div className="mb-label-row"><span>Mar</span><span style={{color:'#fff'}}>£111K</span></div>
                    <div className="mb-track"><div className="mb-fill" style={{width:'100%'}}></div></div>
                    <div className="mb-label-row"><span>Apr ›</span><span style={{color:'var(--amber)'}}>£121K</span></div>
                    <div className="mb-track"><div className="mb-fill proj" style={{width:'100%'}}></div></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="term-footer">
              <div className="tf-status"><span className="tf-dot"></span>Analysis complete · 1.2s</div>
              <div className="tf-info">50 tools available</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ TRUSTED BY ══════════ */}
      <div className="trusted-strip">
        <div className="strip-inner">
          <span className="strip-label">Works instantly with</span>
          <div className="strip-divider"></div>
          <div className="strip-logos">
            <div className="strip-chip"><span className="chip-icon">📊</span> Microsoft Excel</div>
            <div className="strip-chip"><span className="chip-icon">📋</span> Google Sheets</div>
            <div className="strip-chip"><span className="chip-icon">📄</span> CSV / TSV</div>
            <div className="strip-chip"><span className="chip-icon">🏦</span> Xero Export</div>
            <div className="strip-chip"><span className="chip-icon">📱</span> QuickBooks</div>
            <div className="strip-chip"><span className="chip-icon">🔷</span> Sage</div>
            <div className="strip-chip"><span className="chip-icon">🛒</span> Shopify Reports</div>
          </div>
        </div>
      </div>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="dhp-section" id="how-it-works">
        <div className="container">
          <div className="reveal">
            <div className="section-label">How it works</div>
            <h2 className="dhp-h2">From spreadsheet to<br /><span className="hi">insight in 3 steps</span></h2>
            <p className="section-sub">No data engineering. No SQL. No waiting weeks for a dashboard. Just your file and the answers you need.</p>
          </div>
          <div className="steps">
            <div className="step reveal reveal-delay-1">
              <div className="step-num">01 / UPLOAD</div>
              <div className="step-icon">📁</div>
              <div className="step-title">Drop your file</div>
              <p className="step-desc">Upload any Excel, CSV, or export from your accounting tool. DataHub Pro reads your data instantly — no formatting required.</p>
            </div>
            <div className="step reveal reveal-delay-2">
              <div className="step-num">02 / ANALYSE</div>
              <div className="step-icon">⚡</div>
              <div className="step-title">Pick your tools</div>
              <p className="step-desc">Choose from 50 analytics tools — RFM segmentation, revenue forecasting, cohort analysis, churn prediction — all pre-built and ready.</p>
            </div>
            <div className="step reveal reveal-delay-3">
              <div className="step-num">03 / ACT</div>
              <div className="step-icon">🎯</div>
              <div className="step-title">Get your insights</div>
              <p className="step-desc">Download boardroom-ready reports, export visualisations, or share a live dashboard link. Decisions backed by real data, not guesswork.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section className="dhp-section" id="features">
        <div className="container">
          <div className="reveal">
            <div className="section-label">Features</div>
            <h2 className="dhp-h2">Everything your data<br /><span className="hi">is trying to tell you</span></h2>
          </div>

          {/* Feature 1: Executive Dashboard */}
          <div className="feature-block" style={{marginTop:'60px'}}>
            <div className="reveal">
              <div className="feat-label">Executive Dashboard</div>
              <h3 className="dhp-h3">Your entire business<br />on <span className="hi">one screen</span></h3>
              <p className="feat-desc">Upload your sales data and get an instant executive-level view of revenue, customer count, average order value, and churn — the four numbers every business owner needs to see daily.</p>
              <ul className="feat-list">
                <li>Automatic KPI extraction from any spreadsheet format</li>
                <li>Revenue trend charts with period comparisons</li>
                <li>Customer growth and retention at a glance</li>
                <li>Shareable dashboard link for board presentations</li>
              </ul>
            </div>
            <div className="reveal reveal-delay-2">
              <div className="product-panel">
                <div className="panel-header">
                  <div className="p-dot" style={{background:'#f87171'}}></div>
                  <div className="p-dot" style={{background:'#fbbf24'}}></div>
                  <div className="p-dot" style={{background:'#34d399'}}></div>
                  <div className="panel-title">Executive Dashboard</div>
                </div>
                <div className="panel-body">
                  <div className="panel-tag">⚡ Generated in 0.8s</div>
                  <div className="dash-kpis">
                    <div className="dk">
                      <div className="dk-l">Revenue</div>
                      <div className="dk-v" style={{color:'var(--amber)'}}>£284K</div>
                      <div className="dk-c up">▲ 18.4%</div>
                    </div>
                    <div className="dk">
                      <div className="dk-l">Customers</div>
                      <div className="dk-v">1,248</div>
                      <div className="dk-c up">▲ 9.2%</div>
                    </div>
                    <div className="dk">
                      <div className="dk-l">Churn</div>
                      <div className="dk-v" style={{color:'var(--green)'}}>3.2%</div>
                      <div className="dk-c up">▲ Better</div>
                    </div>
                  </div>
                  <div className="mini-chart">
                    <div className="mc-label">MONTHLY REVENUE · JAN–DEC</div>
                    <div className="bar-chart">
                      <div className="bar-item" style={{height:'38%'}}></div>
                      <div className="bar-item" style={{height:'47%'}}></div>
                      <div className="bar-item" style={{height:'42%'}}></div>
                      <div className="bar-item" style={{height:'61%'}}></div>
                      <div className="bar-item" style={{height:'55%'}}></div>
                      <div className="bar-item" style={{height:'70%'}}></div>
                      <div className="bar-item" style={{height:'65%'}}></div>
                      <div className="bar-item" style={{height:'82%'}}></div>
                      <div className="bar-item" style={{height:'88%'}}></div>
                      <div className="bar-item active" style={{height:'100%'}}></div>
                      <div className="bar-item active" style={{height:'96%'}}></div>
                      <div className="bar-item active" style={{height:'98%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: RFM */}
          <div className="feature-block flip">
            <div className="reveal">
              <div className="feat-label">Customer Intelligence</div>
              <h3 className="dhp-h3">Know exactly <span className="hi">who</span><br />your best customers are</h3>
              <p className="feat-desc">Our RFM (Recency, Frequency, Monetary) engine automatically segments your entire customer base — so you know who to reward, who to rescue, and who you've already lost.</p>
              <ul className="feat-list">
                <li>Champions, Loyal, At-Risk, and Lost segments automatically</li>
                <li>Per-segment revenue contribution breakdown</li>
                <li>Action recommendations for each group</li>
                <li>Track segment migration over time</li>
              </ul>
            </div>
            <div className="reveal reveal-delay-2">
              <div className="product-panel">
                <div className="panel-header">
                  <div className="p-dot" style={{background:'#f87171'}}></div>
                  <div className="p-dot" style={{background:'#fbbf24'}}></div>
                  <div className="p-dot" style={{background:'#34d399'}}></div>
                  <div className="panel-title">RFM Customer Segmentation</div>
                </div>
                <div className="panel-body">
                  <div className="panel-tag">1,248 customers analysed</div>
                  <div className="rfm-grid">
                    <div className="rfm-seg champion">
                      <div className="rfm-name">🏆 Champions</div>
                      <div className="rfm-count" style={{color:'var(--amber)'}}>474</div>
                      <div className="rfm-pct" style={{color:'var(--muted)'}}>38% · £162K revenue</div>
                      <div className="rfm-bar" style={{background:'var(--amber)',width:'100%'}}></div>
                    </div>
                    <div className="rfm-seg loyal">
                      <div className="rfm-name">💙 Loyal</div>
                      <div className="rfm-count" style={{color:'var(--teal)'}}>312</div>
                      <div className="rfm-pct" style={{color:'var(--muted)'}}>25% · £74K revenue</div>
                      <div className="rfm-bar" style={{background:'var(--teal)',width:'65%'}}></div>
                    </div>
                    <div className="rfm-seg at-risk">
                      <div className="rfm-name">⚠️ At Risk</div>
                      <div className="rfm-count" style={{color:'var(--red)'}}>237</div>
                      <div className="rfm-pct" style={{color:'var(--muted)'}}>19% · £31K at stake</div>
                      <div className="rfm-bar" style={{background:'var(--red)',width:'50%'}}></div>
                    </div>
                    <div className="rfm-seg lost">
                      <div className="rfm-name">💤 Lost</div>
                      <div className="rfm-count" style={{color:'var(--muted)'}}>137</div>
                      <div className="rfm-pct" style={{color:'var(--muted)'}}>11% · win-back needed</div>
                      <div className="rfm-bar" style={{background:'var(--muted)',width:'29%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3: Forecasting */}
          <div className="feature-block">
            <div className="reveal">
              <div className="feat-label">Revenue Forecasting</div>
              <h3 className="dhp-h3">See 12 months ahead<br />with <span className="hi">confidence</span></h3>
              <p className="feat-desc">Our forecasting engine analyses your historical revenue patterns to project the next 12 months — with confidence intervals so you know what's likely and what's possible.</p>
              <ul className="feat-list">
                <li>12-month revenue projections from your historical data</li>
                <li>Seasonality detection built in automatically</li>
                <li>Best-case and worst-case scenario bands</li>
                <li>Exportable to PDF for investor and board meetings</li>
              </ul>
            </div>
            <div className="reveal reveal-delay-2">
              <div className="product-panel">
                <div className="panel-header">
                  <div className="p-dot" style={{background:'#f87171'}}></div>
                  <div className="p-dot" style={{background:'#fbbf24'}}></div>
                  <div className="p-dot" style={{background:'#34d399'}}></div>
                  <div className="panel-title">Revenue Forecast · Q1 → Q3 2026</div>
                </div>
                <div className="panel-body">
                  <div className="panel-tag">12-month model · 89% confidence</div>
                  <div className="forecast-rows">
                    <div className="fc-row"><span className="fc-month">Jan</span><div className="fc-track"><div className="fc-fill" style={{width:'74%'}}></div></div><span className="fc-val">£82K</span></div>
                    <div className="fc-row"><span className="fc-month">Feb</span><div className="fc-track"><div className="fc-fill" style={{width:'82%'}}></div></div><span className="fc-val">£91K</span></div>
                    <div className="fc-row"><span className="fc-month">Mar</span><div className="fc-track"><div className="fc-fill" style={{width:'100%'}}></div></div><span className="fc-val">£111K</span></div>
                    <div className="fc-row"><span className="fc-month">Apr</span><div className="fc-track"><div className="fc-fill proj" style={{width:'100%'}}></div></div><span className="fc-val proj">£121K ›</span></div>
                    <div className="fc-row"><span className="fc-month">May</span><div className="fc-track"><div className="fc-fill proj" style={{width:'95%'}}></div></div><span className="fc-val proj">£105K ›</span></div>
                    <div className="fc-row"><span className="fc-month">Jun</span><div className="fc-track"><div className="fc-fill proj" style={{width:'88%'}}></div></div><span className="fc-val proj">£98K ›</span></div>
                  </div>
                  <div style={{marginTop:'12px', display:'flex', gap:'16px', fontFamily:'JetBrains Mono,monospace', fontSize:'10px', color:'var(--muted)'}}>
                    <span style={{display:'flex',alignItems:'center',gap:'5px'}}><span style={{width:'12px',height:'4px',background:'var(--amber)',borderRadius:'2px',display:'inline-block'}}></span>Actual</span>
                    <span style={{display:'flex',alignItems:'center',gap:'5px'}}><span style={{width:'12px',height:'4px',background:'rgba(245,158,11,0.3)',borderRadius:'2px',display:'inline-block'}}></span>Projected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ INTEGRATIONS ══════════ */}
      <section className="dhp-section integrations-section" id="integrations">
        <div className="container">
          <div className="reveal" style={{textAlign:'center', maxWidth:'560px', margin:'0 auto'}}>
            <div className="section-label" style={{justifyContent:'center'}}>Integrations</div>
            <h2 className="dhp-h2">Works with the tools<br /><span className="hi">you already use</span></h2>
            <p className="section-sub" style={{margin:'0 auto'}}>No migration. No new software to learn. Just upload the export you already have.</p>
          </div>
          <div className="int-grid">
            <div className="int-card reveal reveal-delay-1">
              <div className="int-icon">📊</div>
              <div className="int-name">Microsoft Excel</div>
              <div className="int-type">.xlsx · .xls</div>
              <span className="int-badge">Native</span>
            </div>
            <div className="int-card reveal reveal-delay-1">
              <div className="int-icon">📋</div>
              <div className="int-name">Google Sheets</div>
              <div className="int-type">Export &amp; upload</div>
              <span className="int-badge">Native</span>
            </div>
            <div className="int-card reveal reveal-delay-2">
              <div className="int-icon">📄</div>
              <div className="int-name">CSV / TSV</div>
              <div className="int-type">Any delimiter</div>
              <span className="int-badge">Native</span>
            </div>
            <div className="int-card reveal reveal-delay-2">
              <div className="int-icon">🏦</div>
              <div className="int-name">Xero</div>
              <div className="int-type">Report exports</div>
              <span className="int-badge">Supported</span>
            </div>
            <div className="int-card reveal reveal-delay-3">
              <div className="int-icon">📱</div>
              <div className="int-name">QuickBooks</div>
              <div className="int-type">Report exports</div>
              <span className="int-badge">Supported</span>
            </div>
            <div className="int-card reveal reveal-delay-3">
              <div className="int-icon">🔷</div>
              <div className="int-name">Sage</div>
              <div className="int-type">Report exports</div>
              <span className="int-badge">Supported</span>
            </div>
            <div className="int-card reveal reveal-delay-3">
              <div className="int-icon">🛒</div>
              <div className="int-name">Shopify</div>
              <div className="int-type">Orders export</div>
              <span className="int-badge">Supported</span>
            </div>
            <div className="int-card reveal reveal-delay-4">
              <div className="int-icon">💳</div>
              <div className="int-name">Stripe</div>
              <div className="int-type">Revenue reports</div>
              <span className="int-badge">Supported</span>
            </div>
            <div className="int-card reveal reveal-delay-4">
              <div className="int-icon">📦</div>
              <div className="int-name">Any ERP</div>
              <div className="int-type">If it exports CSV</div>
              <span className="int-badge">Works</span>
            </div>
            <div className="int-card reveal reveal-delay-4" style={{borderStyle:'dashed', cursor:'default'}}>
              <div className="int-icon">➕</div>
              <div className="int-name">More coming</div>
              <div className="int-type">Direct API sync</div>
              <span className="int-badge">Roadmap</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ STATS BAR ══════════ */}
      <section className="dhp-section" id="stats" style={{padding:'60px 0'}}>
        <div className="container">
          <div className="proof-row reveal" style={{maxWidth:'860px', margin:'0 auto'}}>
            <div className="proof-item">
              <div className="proof-num">50+</div>
              <div className="proof-label">Analytics tools</div>
            </div>
            <div className="proof-item">
              <div className="proof-num">2 min</div>
              <div className="proof-label">Average setup time</div>
            </div>
            <div className="proof-item">
              <div className="proof-num">99%</div>
              <div className="proof-label">Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ ENTERPRISE + GET STARTED ══════════ */}
      <section id="pricing" style={{background:'var(--bg2)', borderTop:'1px solid var(--border)', padding:'100px 0'}}>
        <div className="container">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'32px', alignItems:'stretch'}}>

            {/* Left: Enterprise card */}
            <div className="reveal">
              <div className="section-label">Enterprise</div>
              <div className="price-card featured" style={{height:'100%'}}>
                <div className="price-name">Enterprise</div>
                <div className="price-amount" style={{fontSize:'36px', letterSpacing:'-1px', margin:'10px 0 6px'}}>Custom pricing</div>
                <p className="price-desc" style={{marginBottom:'24px'}}>Tailored to your team size, use case, and integration requirements. Includes dedicated onboarding and ongoing support.</p>
                <div className="price-divider"></div>
                <ul className="price-features" style={{marginBottom:'28px'}}>
                  <li><span className="pf-check">✓</span> All 50 analytics tools included</li>
                  <li><span className="pf-check">✓</span> Unlimited user seats</li>
                  <li><span className="pf-check">✓</span> Unlimited file uploads</li>
                  <li><span className="pf-check">✓</span> Executive dashboard, RFM, forecasting &amp; cohort tools</li>
                  <li><span className="pf-check">✓</span> SSO / SAML authentication</li>
                  <li><span className="pf-check">✓</span> Dedicated onboarding &amp; training</li>
                  <li><span className="pf-check">✓</span> Custom SLA &amp; priority support</li>
                  <li><span className="pf-check">✓</span> API access for custom integrations</li>
                  <li><span className="pf-check">✓</span> GDPR-compliant data handling</li>
                </ul>
                <a href="mailto:hello@datahubpro.co.uk" style={{textDecoration:'none'}}>
                  <button className="btn-price filled" style={{fontSize:'15px', padding:'15px'}}>Get in touch → hello@datahubpro.co.uk</button>
                </a>
                <p style={{fontSize:'12px', color:'var(--muted)', marginTop:'14px', textAlign:'center'}}>We typically respond within one business day.</p>
              </div>
            </div>

            {/* Right: Get Started CTA panel */}
            <div className="reveal reveal-delay-2" id="contact">
              <div className="section-label">Get started</div>
              <div style={{
                background:'var(--bg3)',
                border:'1px solid var(--border)',
                borderRadius:'16px',
                padding:'40px 36px',
                height:'100%',
                display:'flex',
                flexDirection:'column',
                justifyContent:'center'
              }}>
                <h2 className="dhp-h2" style={{marginBottom:'16px', fontSize:'clamp(28px,3vw,40px)'}}>Your data already<br />has <span className="hi">the answers.</span></h2>
                <p style={{fontSize:'16px', color:'var(--muted2)', lineHeight:'1.75', marginBottom:'36px', maxWidth:'380px'}}>Stop running blind. Upload your first file today — get your first insights in under 2 minutes, no analyst required.</p>

                <div style={{display:'flex', flexDirection:'column', gap:'12px', marginBottom:'32px'}}>
                  <button className="btn-primary" onClick={() => setContactOpen(true)} style={{fontSize:"16px", padding:"16px 28px", justifyContent:"center", width:"100%"}}>Request a free trial →</button>
                  <button className="btn-secondary" onClick={() => setDemoOpen(true)} style={{justifyContent:'center'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
                    </svg>
                    Watch the 2-minute demo
                  </button>
                </div>

                <div style={{borderTop:'1px solid var(--border)', paddingTop:'24px', display:'flex', flexDirection:'column', gap:'10px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'10px', fontSize:'13.5px', color:'var(--muted2)'}}>
                    <span style={{color:'var(--green)', fontSize:'11px'}}>✓</span> Trial access approved by our team
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'10px', fontSize:'13.5px', color:'var(--muted2)'}}>
                    <span style={{color:'var(--green)', fontSize:'11px'}}>✓</span> We respond within one business day
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'10px', fontSize:'13.5px', color:'var(--muted2)'}}>
                    <span style={{color:'var(--green)', fontSize:'11px'}}>✓</span> No obligation, no pressure
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'10px', fontSize:'13.5px', color:'var(--muted2)'}}>
                    <span style={{color:'var(--green)', fontSize:'11px'}}>✓</span> GDPR compliant · Data never shared
                  </div>
                </div>

                <p style={{marginTop:'24px', fontSize:'13px', color:'var(--muted)'}}>
                  Questions? <a href="mailto:hello@datahubpro.co.uk" style={{color:'var(--amber)', textDecoration:'none'}}>hello@datahubpro.co.uk</a>
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="dhp-footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <a href="/" className="nav-logo" style={{marginBottom:'14px'}}>
                <div className="nav-logo-mark">D</div>
                DataHub Pro
              </a>
              <p>Enterprise-grade analytics for businesses that don't have an enterprise budget. Upload your spreadsheet. Get your insights. Make better decisions.</p>
            </div>
            <div>
              <div className="footer-col-title">Product</div>
              <ul className="footer-links">
                <li><a href="#features">Features</a></li>
                <li><a href="#how-it-works">How it Works</a></li>
                <li><a href="#integrations">Integrations</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="mailto:hello@datahubpro.co.uk">Changelog</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Company</div>
              <ul className="footer-links">
                <li><a href="mailto:hello@datahubpro.co.uk">About</a></li>
                <li><a href="mailto:hello@datahubpro.co.uk">Blog</a></li>
                <li><a href="mailto:hello@datahubpro.co.uk">Careers</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Legal</div>
              <ul className="footer-links">
                <li><a href="mailto:hello@datahubpro.co.uk">Privacy Policy</a></li>
                <li><a href="mailto:hello@datahubpro.co.uk">Terms of Service</a></li>
                <li><a href="mailto:hello@datahubpro.co.uk">Cookie Policy</a></li>
                <li><a href="mailto:hello@datahubpro.co.uk">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 DataHub Pro. All rights reserved. Registered in England &amp; Wales.</p>
            <div className="footer-legal">
              <a href="mailto:hello@datahubpro.co.uk">Privacy</a>
              <a href="mailto:hello@datahubpro.co.uk">Terms</a>
              <a href="mailto:hello@datahubpro.co.uk">Cookies</a>
            </div>
          </div>
        </div>
      </footer>


      {/* ══════════ CONTACT MODAL ══════════ */}
      {contactOpen && (
        <div
          onClick={() => setContactOpen(false)}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
            display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:9999, padding:'24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#1c1916',
              border:'1px solid rgba(245,158,11,0.3)',
              borderRadius:'18px',
              padding:'44px 40px',
              width:'100%', maxWidth:'440px',
              textAlign:'center',
              position:'relative',
              boxShadow:'0 32px 80px rgba(0,0,0,0.6)'
            }}
          >
            {/* Close */}
            <button onClick={() => setContactOpen(false)} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#78716c', fontSize:'1.3rem', cursor:'pointer', lineHeight:1 }}>✕</button>

            {/* Logo mark */}
            <div style={{ width:48, height:48, background:'#f59e0b', borderRadius:12, display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#000', fontWeight:900, fontSize:'1.3rem', marginBottom:20 }}>D</div>

            <h2 style={{ fontSize:'1.35rem', fontWeight:900, color:'#fafaf9', marginBottom:10 }}>Request Trial Access</h2>
            <p style={{ color:'#a8a29e', fontSize:'0.88rem', lineHeight:1.7, marginBottom:28 }}>
              Trial access is by invitation only. Drop us an email and we'll have your account ready within one business day.
            </p>

            {/* Email box */}
            <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:12, padding:'20px 24px', marginBottom:20 }}>
              <div style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#78716c', marginBottom:8 }}>Email us at</div>
              <a href="mailto:hello@datahubpro.co.uk" style={{ fontSize:'1.1rem', fontWeight:800, color:'#f59e0b', textDecoration:'none' }}>
                hello@datahubpro.co.uk
              </a>
            </div>

            {/* CTA */}
            <a
              href="mailto:hello@datahubpro.co.uk?subject=Trial Access Request&body=Hi, I'd like to request trial access to DataHub Pro.%0A%0AName: %0ACompany: %0APhone (optional): "
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 24px', background:'#f59e0b', color:'#000', borderRadius:10, fontWeight:700, fontSize:'0.95rem', textDecoration:'none', marginBottom:24 }}
            >
              ✉️ Open in email app →
            </a>

            {/* Trust signals */}
            <div style={{ display:'flex', flexDirection:'column', gap:8, textAlign:'left' }}>
              {['We respond within one business day', 'No obligation, no pressure', 'GDPR compliant · Your data stays yours'].map((t, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.8rem', color:'#78716c' }}>
                  <span style={{ color:'#22c55e', fontWeight:700 }}>✓</span> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DEMO MODAL ══════════ */}
      {demoOpen && (
        <div
          onClick={() => setDemoOpen(false)}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
            display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:9999, padding:'20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#1c1916', border:'1px solid rgba(245,158,11,0.3)',
              borderRadius:'16px', overflow:'hidden',
              width:'100%', maxWidth:'1100px', position:'relative',
              display:'flex', flexDirection:'column'
            }}
          >
            {/* Modal header */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)',
              flexShrink:0
            }}>
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <div style={{
                  width:'28px', height:'28px', borderRadius:'7px',
                  background:'linear-gradient(135deg,#f59e0b,#d97706)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:'800', fontSize:'14px', color:'#1a1714'
                }}>D</div>
                <span style={{fontWeight:'700', fontSize:'14px', color:'#f5f0eb'}}>DataHub Pro</span>
                <span style={{
                  background:'rgba(245,158,11,0.15)', color:'#f59e0b',
                  borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:'600'
                }}>Live Product Demo</span>
              </div>
              <button
                onClick={() => setDemoOpen(false)}
                style={{
                  background:'none', border:'none', color:'#6b6560',
                  cursor:'pointer', fontSize:'20px', lineHeight:1, padding:'4px 8px'
                }}
              >✕</button>
            </div>
            {/* Self-playing React demo player */}
            <div style={{height:'min(75vh, 680px)'}}>
              <DemoPlayer />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
