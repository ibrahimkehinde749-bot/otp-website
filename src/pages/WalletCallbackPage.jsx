import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

function WalletCallbackPage() {
  const [message, setMessage] = useState('Verifying payment...')
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    async function verify() {
      try {
        const tx_ref = searchParams.get('tx_ref')
        const transaction_id = searchParams.get('transaction_id') || searchParams.get('transactionId')

        if (!tx_ref && !transaction_id) {
          throw new Error('Missing tx_ref or transaction_id in callback URL.')
        }

        const result = await api.wallet.verify({ tx_ref, transaction_id })
        setMessage(`Payment verified. Wallet balance: $${result.balance.toFixed(2)}`)
        setTimeout(() => {
          navigate('/app/wallet')
        }, 2000)
      } catch (err) {
        setError(err.message)
        setMessage('')
      }
    }

    verify()
  }, [navigate, searchParams])

  return (
    <div>
      <h2>Wallet Payment Callback</h2>
      {error && <div className="alert error">{error}</div>}
      {!error && <div className="alert info">{message}</div>}
    </div>
  )
}

export default WalletCallbackPage
