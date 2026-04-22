import React from 'react'
import { Link } from 'react-router-dom'

// "Request access" landing. Registration is intentionally gated — businesses
// email us and we provision the account via /admin (or the provision-account
// endpoint). Palette mirrors the violet used on datahubpro.co.uk / LandingPage.
export default function Register() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0718 0%, #1a1145 50%, #0a0718 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#14101f', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ width: 52, height: 52, background: '#a855f7', borderRadius: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.4rem', marginBottom: 20, boxShadow: '0 8px 24px rgba(168,85,247,0.35)' }}>D</div>

        {/* Lock */}
        <div style={{ fontSize: '2rem', marginBottom: 14 }}>🔐</div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fafaf9', marginBottom: 10 }}>
          Trial Access is By Invitation
        </h1>
        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 340, margin: '0 auto 32px' }}>
          DataHub Pro is currently available to approved businesses only. Get in touch and we'll set up your account within one business day.
        </p>

        {/* Contact box */}
        <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '24px', marginBottom: 24 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', marginBottom: 12 }}>Contact us to request access</div>
          <a
            href="mailto:hello@datahubpro.co.uk?subject=Trial Access Request&body=Hi, I'd like to request trial access to DataHub Pro.%0A%0AName: %0ACompany: %0APhone (optional): "
            style={{ display: 'block', fontSize: '1.15rem', fontWeight: 800, color: '#a855f7', textDecoration: 'none', marginBottom: 8 }}
          >
            hello@datahubpro.co.uk
          </a>
          <div style={{ fontSize: '0.82rem', color: '#71717a' }}>Click to open email, or copy the address above</div>
        </div>

        {/* CTA */}
        <a
          href="mailto:hello@datahubpro.co.uk?subject=Trial Access Request&body=Hi, I'd like to request trial access to DataHub Pro.%0A%0AName: %0ACompany: %0APhone (optional): "
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px 24px', background: 'linear-gradient(135deg,#a855f7,#9333ea)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none', marginBottom: 28, boxShadow: '0 6px 20px rgba(168,85,247,0.35)' }}
        >
          ✉️ Send us an email →
        </a>

        {/* Trust signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28, textAlign: 'left' }}>
          {['We respond within one business day', 'No obligation, no pressure', 'GDPR compliant · Your data stays yours'].map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#a1a1aa' }}>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span> {text}
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.85rem', color: '#71717a' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#a855f7', fontWeight: 700, textDecoration: 'none' }}>Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
