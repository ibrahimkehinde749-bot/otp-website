import { useState, useEffect } from 'react'
import { api } from '../api/client.js'

function WalletPage() {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [amount, setAmount] = useState('10.00')
  const [paymentLink, setPaymentLink] = useState(null)
  const [transactionMessage, setTransactionMessage] = useState('')

  useEffect(() => {
    async function loadBalance() {
      try {
        setLoading(true)
        const data = await api.balance.get()
        setBalance(data.balance || 0)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadBalance()
  }, [])

  async function handleDeposit(event) {
    event.preventDefault()
    try {
      setError(null)
      setTransactionMessage('Creating payment...')
      const data = await api.wallet.deposit({ amount: Number(amount) })

      if (data.paymentLink) {
        setPaymentLink(data.paymentLink)
        setTransactionMessage('Payment initialized. Complete the payment in the new tab.')
      } else if (data.mock) {
        setTransactionMessage('Mock deposit completed. Wallet balance updated.')
        setPaymentLink(null)
        setBalance(data.balance)
      } else {
        setTransactionMessage('Deposit request completed.')
      }
    } catch (err) {
      setError(err.message)
      setTransactionMessage('')
    }
  }

  return (
    <div>
      <h2>Wallet</h2>
      {error && <div className="alert error">{error}</div>}
      <div className="wallet-card">
        <p className="wallet-balance">₦{loading ? '...' : (balance ?? 0).toFixed(2)}</p>
        <p>Current balance</p>
      </div>

      <form className="wallet-form" onSubmit={handleDeposit}>
        <label>
          Amount
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button type="submit">Deposit</button>
      </form>

      {transactionMessage && <div className="alert info">{transactionMessage}</div>}
      {paymentLink && (
        <div className="alert success">
          <p>Complete payment here:</p>
          <a href={paymentLink} target="_blank" rel="noreferrer">{paymentLink}</a>
        </div>
      )}
    </div>
  )
}

export default WalletPage
