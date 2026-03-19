import React, { useState, useEffect } from 'react'
import { billingApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Billing() {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { billingApi.plans().then(res => setPlans(res.data)).catch(() => {}) }, [])

  const handleSubscribe = async (planId) => {
    setLoading(true)
    try {
      const res = await billingApi.createCheckout(planId)
      window.location.href = res.data.checkout_url
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start checkout')
    } finally { setLoading(false) }
  }

  const handlePortal = async () => {
    try {
      const res = await billingApi.portal()
      window.location.href = res.data.portal_url
    } catch { toast.error('Could not open billing portal') }
  }

  const planColors = { starter: '#0097b2', growth: '#e91e8c', enterprise: '#0c1446' }
  const currentPlan = user?.organisation?.subscription_tier

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1446' }}>Billing & Plans</h1>
        <p style={{ color: '#4a5280', marginTop: 4 }}>Manage your subscription and billing details</p>
      </div>

      {/* Current status */}
      <div className="card" style={{ padding: 24, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#8b92b3', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Current Plan</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0c1446', textTransform: 'capitalize' }}>{currentPlan || 'Trial'}</div>
          <div style={{ fontSize: '0.85rem', color: '#4a5280', marginTop: 4 }}>Status: {user?.organisation?.subscription_status || 'Trialing'}</div>
        </div>
        {currentPlan && <button onClick={handlePortal} className="btn-secondary">Manage Billing →</button>}
      </div>

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {plans.map(plan => (
          <div key={plan.id} className="card" style={{ padding: 28, border: plan.id === 'growth' ? '2px solid #e91e8c' : '1px solid #e2e5f1', position: 'relative', overflow: 'hidden' }}>
            {plan.id === 'growth' && <div style={{ position: 'absolute', top: 12, right: 12, background: '#e91e8c', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>POPULAR</div>}
            <div style={{ width: 40, height: 40, background: planColors[plan.id] + '20', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ color: planColors[plan.id], fontSize: '1.2rem' }}>{plan.id === 'starter' ? '🌱' : plan.id === 'growth' ? '🚀' : '🏢'}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0c1446', marginBottom: 6 }}>{plan.name}</h3>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: planColors[plan.id] }}>£{plan.price}</span>
              <span style={{ color: '#8b92b3', fontSize: '0.85rem' }}>/month</span>
            </div>
            <ul style={{ listStyle: 'none', marginBottom: 24 }}>
              {plan.features.map((f, i) => (
                <li key={i} style={{ padding: '5px 0', fontSize: '0.85rem', color: '#4a5280', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={loading || currentPlan === plan.id}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: currentPlan === plan.id ? '#e2e5f1' : planColors[plan.id], color: currentPlan === plan.id ? '#8b92b3' : '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: currentPlan === plan.id ? 'default' : 'pointer' }}
            >
              {currentPlan === plan.id ? 'Current Plan' : loading ? 'Loading...' : 'Subscribe →'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
