import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import WalletPage from './pages/WalletPage.jsx'
import WalletFundingPage from './pages/WalletFundingPage.jsx'
import AdminFundingPage from './pages/AdminFundingPage.jsx'
import WalletCallbackPage from './pages/WalletCallbackPage.jsx'
import PurchaseNumberPage from './pages/PurchaseNumberPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import { api } from './api/client.js'

function App() {
  const [auth, setAuth] = useState({ user: null, token: null })
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    async function restoreSession() {
      const stored = localStorage.getItem('otp-auth')
      if (!stored) {
        setLoadingSession(false)
        return
      }

      let parsed
      try {
        parsed = JSON.parse(stored)
      } catch {
        localStorage.removeItem('otp-auth')
        setAuth({ user: null, token: null })
        setLoadingSession(false)
        return
      }

      if (!parsed?.token) {
        localStorage.removeItem('otp-auth')
        setAuth({ user: null, token: null })
        setLoadingSession(false)
        return
      }

      try {
        const profile = await api.user.profile()
        const next = { user: profile, token: parsed.token }
        localStorage.setItem('otp-auth', JSON.stringify(next))
        setAuth(next)
      } catch (err) {
        localStorage.removeItem('otp-auth')
        setAuth({ user: null, token: null })
      } finally {
        setLoadingSession(false)
      }
    }

    restoreSession()
  }, [])

  function setSession(user, token) {
    const next = { user, token }
    localStorage.setItem('otp-auth', JSON.stringify(next))
    setAuth(next)
  }

  function clearSession() {
    localStorage.removeItem('otp-auth')
    setAuth({ user: null, token: null })
  }

  if (loadingSession) {
    return <div>Loading session...</div>
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<LoginPage onLogin={setSession} />} />
      <Route path="/register" element={<RegisterPage onRegister={setSession} />} />
      <Route path="/app" element={<Layout user={auth.user} onLogout={clearSession} />}>
        <Route index element={auth.user ? <Navigate to="dashboard" /> : <Navigate to="/login" />} />
        <Route path="dashboard" element={<DashboardPage user={auth.user} onSessionExpired={clearSession} />} />
        <Route path="wallet" element={<WalletPage user={auth.user} />} />
        <Route path="wallet/fund" element={<WalletFundingPage user={auth.user} />} />
        <Route path="wallet/callback" element={<WalletCallbackPage />} />
        <Route path="purchase" element={<PurchaseNumberPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="admin/wallet-funding" element={auth.user?.role === 'admin' ? <AdminFundingPage user={auth.user} /> : <Navigate to="/app/dashboard" />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default App
