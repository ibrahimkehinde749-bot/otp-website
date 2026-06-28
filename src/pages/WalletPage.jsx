import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

function WalletPage() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [fundingRequests, setFundingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadWalletData() {
      try {
        setLoading(true)
        const [walletData, txData, fundingData] = await Promise.all([
          api.wallet.get(),
          api.wallet.getTransactions(),
          api.wallet.getFundingRequests(),
        ])
        setBalance(walletData?.balance ?? 0)
        setTransactions(txData ?? [])
        setFundingRequests(fundingData ?? [])
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadWalletData()
  }, [])

  const formattedBalance = useMemo(() => `₦${Number(balance || 0).toFixed(2)}`, [balance])

  return (
    <div className="wallet-page">
      <h2>Wallet</h2>
      {error && <div className="alert error">{error}</div>}

      <div className="wallet-card">
        <p className="wallet-balance">{loading ? 'Loading...' : formattedBalance}</p>
        <p>Current balance</p>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => navigate('/app/wallet/fund')}>Fund Wallet</button>
      </div>

      <div className="wallet-grid">
        <section className="wallet-panel">
          <h3>Funding History</h3>
          {fundingRequests.length === 0 ? (
            <p className="muted">No funding requests yet.</p>
          ) : (
            <div className="request-list">
              {fundingRequests.map((request) => (
                <div key={request.id} className="request-item">
                  <div>
                    <strong>₦{Number(request.amount).toFixed(2)}</strong>
                    <div className="muted">{request.paymentReference || 'No reference'}</div>
                  </div>
                  <span className={`status-pill ${request.paymentStatus.toLowerCase()}`}>{request.paymentStatus}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="wallet-panel">
          <h3>Wallet Transaction History</h3>
          {transactions.length === 0 ? (
            <p className="muted">No transactions yet.</p>
          ) : (
            <div className="request-list">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="request-item">
                  <div>
                    <strong>{transaction.description || transaction.provider || 'Transaction'}</strong>
                    <div className="muted">{new Date(transaction.created_at).toLocaleString()}</div>
                  </div>
                  <span className={`status-pill ${transaction.type}`}>{transaction.type === 'credit' ? '+' : '-'}₦{Number(transaction.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default WalletPage
