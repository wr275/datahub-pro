import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const TOUR_KEY = 'datahub_tour_done'
const STEPS = [
  { title: 'Welcome to DataHub Pro! 👋', body: "Let's take a quick tour — 4 steps to get you started.", target: null },
  { title: 'Step 1 — Upload your data', body: "Click '+ Upload Data' to import a CSV or Excel file. Every tool flows from your data.", target: 'upload-btn', pos: 'below' },
  { title: 'Step 2 — Explore DATA tools', body: 'Clean, filter, summarise and chart any dataset. Great starting points: Data Table, KPI Dashboard.', target: 'nav-data', pos: 'right' },
  { title: 'Step 3 — Build dashboards', body: 'Drag widgets onto a canvas, then share with a public link or copy the embed code.', target: 'nav-dashboard', pos: 'right' },
  { title: "You're all set! 🚀", body: 'All 50+ tools live in the sidebar. Use the Search bar to find anything fast.', target: null }
]

export default function OnboardingTour() {
  const [step, setStep] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(() => setShow(true), 700)
      return () => clearTimeout(t)
    }
  }, [])

  const finish = () => { localStorage.setItem(TOUR_KEY, '1'); setShow(false) }
  const next = () => step < STEPS.length - 1 ? setStep(s => s + 1) : finish()
  const prev = () => setStep(s => s - 1)

  if (!show) return null
  const cur = STEPS[step]
  const el = cur.target ? document.querySelector('[data-tour="' + cur.target + '"]') : null
  const r = el ? el.getBoundingClientRect() : null
  const P = 10
  const sp = r ? { top: r.top - P, left: r.left - P, w: r.width + P * 2, h: r.height + P * 2 } : null

  let tipStyle = {
    position: 'fixed', background: '#fff', borderRadius: 14,
    boxShadow: '0 20px 60px rgba(0,0,0,0.28)', padding: '22px 22px 16px', zIndex: 100000
  }
  if (!sp) {
    tipStyle = { ...tipStyle, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 360 }
  } else if (cur.pos === 'below') {
    tipStyle = { ...tipStyle, top: sp.top + sp.h + 12, left: Math.max(8, sp.left + sp.w / 2 - 155), width: 310 }
  } else {
    tipStyle = { ...tipStyle, top: Math.max(8, sp.top + sp.h / 2 - 95), left: sp.left + sp.w + 14, width: 300 }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
      {sp ? (
        <>
          <div onClick={finish} style={{ position: 'fixed', top: 0, left: 0, right: 0, height: sp.top, background: 'rgba(0,0,0,0.55)' }} />
          <div onClick={finish} style={{ position: 'fixed', top: sp.top + sp.h, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div onClick={finish} style={{ position: 'fixed', top: sp.top, left: 0, width: sp.left, height: sp.h, background: 'rgba(0,0,0,0.55)' }} />
          <div onClick={finish} style={{ position: 'fixed', top: sp.top, left: sp.left + sp.w, right: 0, height: sp.h, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'fixed', top: sp.top, left: sp.left, width: sp.w, height: sp.h, borderRadius: 10, boxShadow: '0 0 0 3px #e91e8c, 0 0 0 6px rgba(233,30,140,0.2)', pointerEvents: 'none' }} />
        </>
      ) : (
        <div onClick={finish} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      )}
      <div style={tipStyle}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 7, height: 7, borderRadius: 4, background: i === step ? '#e91e8c' : '#e5e7eb', transition: 'width 0.2s' }} />
          ))}
        </div>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1446', marginBottom: 7 }}>{cur.title}</div>
        <div style={{ fontSize: '0.83rem', color: '#4b5563', lineHeight: 1.6, marginBottom: 18 }}>{cur.body}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={finish} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>Skip tour</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={prev} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: '0.82rem', cursor: 'pointer' }}>Back</button>
            )}
            <button onClick={next} style={{ padding: '6px 18px', borderRadius: 8, border: 'none', background: '#e91e8c', color: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 700 }}>
              {step === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
