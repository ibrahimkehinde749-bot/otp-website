import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

function WalletFundingPage() {
  const navigate = useNavigate()
  const [bankDetails, setBankDetails] = useState(null)
  const [amount, setAmount] = useState('1000')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadBankDetails() {
      try {
        setLoading(true)
        const data = await api.wallet.getBankDetails()
        setBankDetails(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadBankDetails()
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      setSubmitting(true)
      await api.wallet.fund({ amount: Number(amount), paymentReference: reference })
      setMessage('Funding request submitted. Wait for admin approval before the balance is credited.')
      setReference('')
      setAmount('1000')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2>Fund Wallet</h2>
      <button type="button" className="ghost-button" onClick={() => navigate('/app/wallet')}>
        Back to Wallet
      </button>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {loading ? (
        <p>Loading bank details...</p>
      ) : bankDetails ? (
        <div className="wallet-funding-card">
          <h3>Manual Bank Deposit</h3>
          <div className="info-grid">
            <div className="info-card">
              <h3>Bank Name</h3>
              <p>{bankDetails.bankName}</p>
            </div>
            <div className="info-card">
              <h3>Account Name</h3>
              <p>{bankDetails.accountName}</p>
            </div>
            <div className="info-card">
              <h3>Account Number</h3>
              <p>{bankDetails.accountNumber}</p>
            </div>
          </div>
          <div className="alert info">
            <p>{bankDetails.instructions}</p>
          </div>

          <form className="purchase-form" onSubmit={handleSubmit}>
            <label>
              Amount to Transfer
              <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label>
              Payment Reference (optional)
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. transfer note" />
            </label>
            <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'I Have Paid'}</button>
          </form>
        </div>
      ) : null}
    </div>
  )
}

export default WalletFundingPage
