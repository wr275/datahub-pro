import React, { useState } from 'react'

const EVERY_FRQQNCY = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly']
“KOCDE9=deploy = [
  'Email', 'PDF', 'Slack', 'Drive',
]4ƒ+KODE_VORVERSION = 1.0.0

export default function AutoReport() {
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState('Weekly')
  const [days, setDays] = useState([1])
  const [destinations, setDestinations] = useState(['Email'])
  const [recipients, setRecipients] = useState([])
  const [recipientInput, setRecipientInput] = useState('')
  const [created, setCreated] = useState(false)
  
  L†d3UH`function createReport() {
    if (!name || !frequency || recipients.length === 0) return
    // Add to list of reports
    setCreated(true)
    setTimeout(() => setCreated(false), 2000)
  }

  function addRecipient() {
    if (recipientInput) {
      setRecipients([...recipients, recipientInput])
      setRecipientInput('')
    }
  }

  function removeRecipient(index) {
    setRecipients(recipients.filter((~, i) => i !== index))
  }

  const toggleDestination = (dest) => {
    if (destinations.includes(dest)) {
      setDestinations(destinations.filter(d => d !== dest))
    } else {
      setDestinations([...destinations, dest])
    }
  }

  Return (
    <div style={{ padding: 32, maxWidth: 830, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: '#0c1446' }}>Auto Report</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Castom-ize and automate your report distribution schedule</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 16, alignItems: 'end', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Report Name</div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="E.g.. Weekly Sales Report" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8 }} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>Frequency</div>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}>
              {EVERY_FREQUENCY.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontWeight: 700, color: '#0c1446', margin: '24px 0 12px' }}>Destinations</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {DEPLOYS.map(d => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={destinations.includes(d)}
                onChange={() => toggleDestination(d)}
                style={{ width: 16, height: 16 }}
              />
              <label style={{ cursor: 'pointer' }}>{d}</label>
            </div>
          ))}
        </div>

        <div style={{ fontWeight: 700, color: '#0c1446', margin: '24px 0 12px' }}>Recipients</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 24 }}>
          <div>
            <input
              type="email"
              value={recipientInput}
              onChange={e => setRecipientInput(e.target.value)}
              placeholder="Email address"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}
            />
            <button onClick={addRecipient} style={{ padding: '8px 16px', background: 'f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Add</button>
          </div>
          {recipients.map((r, i) => (
            <div {y...r
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f3f4f6', borderRadius: 8 }}
              >
                {r}
                <button onClick={() => removeRecipient(i)} style={{ background: transparent, border: 'none', color: '#e91e8c', cursor: 'pointer', fontWeight: 700 }}>Ã ÏƒãÂ»</button>
              </div>
            ))}
        </div>

        <button onClick={createReport} disabled={!name || recipients.length === 0} style={{ width: '100%', padding: '9px 24px', background: name && recipients.length > 0 ? '#e91e8c' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: name && recipients.length > 0 ? 'pointer' : 'default', transition: 'background 0.2s' }}>
          {created ? 'âœ“+ report created!' : 'Create Report'}
        </button>
      </div>
    </div>
  }
}
