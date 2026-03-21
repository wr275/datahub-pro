import React, { useState } from 'react'

export default function AISettings() {
  const [settings, setSettings] = useState({
    model: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 2048,
    autoInsights: true,
    narrativeStyle: 'executive',
    language: 'English',
    currency: 'USD',
    dateFormat: 'YYYY-MM-DD',
    decimalPlaces: 2,
    outlierThreshold: 2.5,
    forecastPeriods: 12,
    anomalyMethod: 'zscore',
    cacheResults: true,
    debugMode: false,
  })
  const [saved, setSaved] = useState(false)

  function update(key, val) { setSettings({ ...settings, [key]: val }); setSaved(false) }
  function save() { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const Section = ({ title, children }) => (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: '#0c1446', marginBottom: 16, fontSize: '1rem', borderBottom: '1px solid #f3f4f6', paddingBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  const Row = ({ label, desc, children }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f9fafb' }}>
      <div>
        <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.875rem' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{desc}</div>}
      </div>
      <div>{children}</div>
    </div>
  )

  const Toggle = ({ k }) => (
    <div onClick={() => update(k, !settings[k])} style={{ width: 44, height: 24, borderRadius: 12, background: settings[k] ? '#e91e8c' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: settings[k] ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>AI Settings</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Configure AI behaviour and analysis preferences</p>
        </div>
        <button onClick={save} style={{ padding: '9px 24px', background: saved ? '#10b981' : '#e91e8c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', transition: 'background 0.3s' }}>{saved ? '✓ Saved!' : 'Save Changes'}</button>
      </div>

      <Section title="🤖 AI Model Configuration">
        <Row label="Language Model" desc="AI model used for insights and narratives">
          <select value={settings.model} onChange={e => update('model', e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
            {['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Row>
        <Row label="Temperature" desc={`Controls creativity: ${settings.temperature} (0 = deterministic, 1 = creative)`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min="0" max="1" step="0.1" value={settings.temperature} onChange={e => update('temperature', parseFloat(e.target.value))} style={{ width: 120 }} />
            <span style={{ fontWeight: 700, color: '#0c1446', minWidth: 30 }}>{settings.temperature}</span>
          </div>
        </Row>
        <Row label="Max Tokens" desc="Maximum response length for AI-generated text">
          <select value={settings.maxTokens} onChange={e => update('maxTokens', parseInt(e.target.value))} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
            {[512, 1024, 2048, 4096].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Row>
        <Row label="Auto-generate Insights" desc="Automatically generate insights when a file is loaded">
          <Toggle k="autoInsights" />
        </Row>
        <Row label="Default Narrative Style">
          <select value={settings.narrativeStyle} onChange={e => update('narrativeStyle', e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
            {['executive', 'technical', 'story'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </Row>
      </Section>

      <Section title="📊 Analysis Defaults">
        <Row label="Anomaly Detection Method">
          <select value={settings.anomalyMethod} onChange={e => update('anomalyMethod', e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
            <option value="zscore">Z-Score</option>
            <option value="iqr">IQR (Tukey)</option>
          </select>
        </Row>
        <Row label="Outlier Threshold" desc={`Current: ${settings.outlierThreshold} standard deviations`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min="1" max="4" step="0.1" value={settings.outlierThreshold} onChange={e => update('outlierThreshold', parseFloat(e.target.value))} style={{ width: 120 }} />
            <span style={{ fontWeight: 700, color: '#0c1446', minWidth: 30 }}>{settings.outlierThreshold}</span>
          </div>
        </Row>
        <Row label="Default Forecast Periods">
          <input type="number" value={settings.forecastPeriods} onChange={e => update('forecastPeriods', parseInt(e.target.value) || 12)} min="3" max="60" style={{ width: 70, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} />
        </Row>
        <Row label="Decimal Places">
          <select value={settings.decimalPlaces} onChange={e => update('decimalPlaces', parseInt(e.target.value))} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
            {[0, 1, 2, 3, 4].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Row>
      </Section>

      <Section title="🌍 Regional Settings">
        <Row label="Language">
          <select value={settings.language} onChange={e => update('language', e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
            {['English', 'Spanish', 'French', 'German', 'Portuguese'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Row>
        <Row label="Currency">
          <select value={settings.currency} onChange={e => update('currency', e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
            {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'PKR'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Row>
        <Row label="Date Format">
          <select value={settings.dateFormat} onChange={e => update('dateFormat', e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}>
            {['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MMM-YYYY'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Row>
      </Section>

      <Section title="⚙️ System">
        <Row label="Cache Analysis Results" desc="Store computation results for faster re-runs">
          <Toggle k="cacheResults" />
        </Row>
        <Row label="Debug Mode" desc="Show additional technical information and logs">
          <Toggle k="debugMode" />
        </Row>
      </Section>
    </div>
  )
}
