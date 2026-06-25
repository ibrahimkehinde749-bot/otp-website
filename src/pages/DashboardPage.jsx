import { useState, useEffect } from 'react'
import { api } from '../api/client.js'

function DashboardPage({ user, onSessionExpired }) {
  const [profile, setProfile] = useState(user)
  const [balance, setBalance] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const profileData = await api.user.profile()
        const [balanceData, ordersData] = await Promise.all([
          api.balance.get().catch(() => ({ balance: 0 })),
          api.orders.getAll().catch(() => ({ orders: [] })),
        ])
        setProfile(profileData)
        setBalance(balanceData.balance || 0)
        setOrders(ordersData.orders || [])
        setError(null)
      } catch (err) {
        if (err.message === 'Missing token' || err.message === 'Invalid token' || err.message.includes('401')) {
          onSessionExpired()
        } else {
          setError(err.message)
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [onSessionExpired])

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome back, {profile?.fullName || profile?.email || 'user'}.</p>
      {error && <div className="alert">{error}</div>}
      <div className="info-grid">
        <div className="info-card">
          <h3>Account</h3>
          <p>Email: {profile?.email || 'user@example.com'}</p>
          <p>Status: {profile?.accountStatus || 'active'}</p>
          <p>Registered: {profile?.registrationDate ? new Date(profile.registrationDate).toLocaleDateString() : 'N/A'}</p>
        </div>
        <div className="info-card">
          <h3>Overview</h3>
          <p>Wallet balance: ₦{loading ? '...' : (balance ?? 0).toFixed(2)}</p>
          <p>Orders: {loading ? '...' : orders.length} active</p>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
