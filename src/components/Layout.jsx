import { Link, Navigate, Outlet } from 'react-router-dom'

function Layout({ user, onLogout }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">RH OTP</div>
        <nav>
          <Link to="dashboard">Dashboard</Link>
          <Link to="wallet">Wallet</Link>
          <Link to="purchase">Purchase Number</Link>
          <Link to="orders">Orders</Link>
        </nav>
        <button className="ghost-button" onClick={onLogout}>Logout</button>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>Welcome, {user?.fullName || user?.email || 'Guest'}</div>
        </header>
        <div className="page-card">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
