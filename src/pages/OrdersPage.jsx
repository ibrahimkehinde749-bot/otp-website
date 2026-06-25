import { useState, useEffect } from 'react'
import { api } from '../api/client.js'

function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true)
        const data = await api.orders.getAll()
        setOrders(data.orders || [])
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [])

  if (loading) return <div><h2>Orders</h2><p>Loading...</p></div>
  if (error) return <div><h2>Orders</h2><div className="alert">{error}</div></div>

  return (
    <div>
      <h2>Orders</h2>
      {orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <div className="orders-table">
          <div className="orders-row header">
            <span>Order ID</span>
            <span>Number</span>
            <span>Country</span>
            <span>Service</span>
            <span>Status</span>
          </div>
          {orders.map(order => (
            <div className="orders-row" key={order.id}>
              <span>{order.id}</span>
              <span>{order.number}</span>
              <span>{order.country}</span>
              <span>{order.service}</span>
              <span>{order.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default OrdersPage
