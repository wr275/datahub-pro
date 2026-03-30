import React from 'react'
import { Link } from 'react-router-dom'

export default function Register() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c0a09 0%, #1c1510 50%, #0c0a09 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#1c1916', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ width: 52, height: 52, background: '#f59e0b', borderRadius: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 900, fontSize: '1.4rem', marginBottom: 20 }}>D</div>

        {/* Lock */}
        <div style={{ fontSize: '2rem', marginBottom: 14 }}>🔐</div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fafaf9', marginBottom: 10 }}>
          Trial Access is By Invitation
        </h1>
        <p style={{ color: '#a8a29e', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 340, margin: '0 auto 32px' }}>
          DataHub Pro is currently available to approved businesses only. Get in touch and we'll set up your account within one business day.
        </p>

        {/* Contact box */}
        <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '24px', marginBottom: 24 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#78716c', marginBottom: 12 }}>Contact us to request access</div>
          <a
            href="mailto:hello@datahubpro.co.uk?subject=Trial Access Request&body=Hi, I'd like to request trial access to DataHub Pro.%0A%0AName: %0ACompany: %0APhone (optional): "
            style={{ display: 'block', fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b', textDecoration: 'none', marginBottom: 8 }}
          >
            hello@datahubpro.co.uk
          </a>
          <div style={{ fontSize: '0.82rem', color: '#78716c' }}>Click to open email, or copy the address above</div>
        </div>

        {/* CTA */}
        <a
          href="mailto:hello@datahubpro.co.uk?subject=Trial Access Request&body=Hi, I'd like to request trial access to DataHub Pro.%0A%0AName: %0ACompany: %0APhone (optional): "
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px 24px', background: '#f59e0b', color: '#000', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none', marginBottom: 28 }}
        >
          ✉️ Send us an email →
        </a>

        {/* Trust signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28, textAlign: 'left' }}>
          {['We respond within one business day', 'No obligation, no pressure', 'GDPR compliant · Your data stays yours'].map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#78716c' }}>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span> {text}
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.85rem', color: '#44403c' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#f59e0b', fontWeight: 700, textDecoration: 'none' }}>Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
