import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Files from './pages/Files'
import Analytics from './pages/Analytics'
import Billing from './pages/Billing'
import Team from './pages/Team'
import Settings from './pages/Settings'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#0c1446', fontSize: '1rem', fontWeight: 600 }}>Loading DataHub Pro...</div>
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
        <Route path="/files" element={<PrivateRoute><Layout><Files /></Layout></PrivateRoute>} />
        <Route path="/analytics/:fileId?" element={<PrivateRoute><Layout><Analytics /></Layout></PrivateRoute>} />
        <Route path="/billing" element={<PrivateRoute><Layout><Billing /></Layout></PrivateRoute>} />
        <Route path="/team" element={<PrivateRoute><Layout><Team /></Layout></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
