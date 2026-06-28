import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

function AdminFundingPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadRequests() {
    try {
      setLoading(true)
      const data = await api.wallet.admin.getFundingRequests()
      setRequests(data ?? [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  async function handleAction(id, action) {
    try {
      setMessage('')
      if (action === 'approve') {
        await api.wallet.admin.approve(id)
        setMessage('Funding request approved and wallet credited.')
      } else {
        await api.wallet.admin.reject(id)
        setMessage('Funding request rejected.')
      }
      await loadRequests()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h2>Admin Wallet Funding Requests</h2>
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {loading ? (
        <p>Loading requests...</p>
      ) : requests.length === 0 ? (
        <p>No funding requests found.</p>
      ) : (
        <div className="orders-table">
          <div className="orders-row header">
            <span>User</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Reference</span>
            <span>Action</span>
          </div>
          {requests.map((request) => (
            <div key={request.id} className="orders-row">
              <span>{request.user?.fullName || request.user?.email || request.userId}</span>
              <span>₦{Number(request.amount).toFixed(2)}</span>
              <span>{request.paymentStatus}</span>
              <span>{request.paymentReference || '—'}</span>
              <span>
                {request.paymentStatus === 'Pending' ? (
                  <div className="inline-actions">
                    <button type="button" onClick={() => handleAction(request.id, 'approve')}>Approve</button>
                    <button type="button" className="ghost-button" onClick={() => handleAction(request.id, 'reject')}>Reject</button>
                  </div>
                ) : (
                  'Processed'
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminFundingPage
