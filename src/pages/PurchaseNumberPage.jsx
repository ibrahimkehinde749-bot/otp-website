import { useState, useEffect } from 'react'
import { api } from '../api/client.js'

function PurchaseNumberPage() {
  const [form, setForm] = useState({ country: '', service: '', operator: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [countries, setCountries] = useState([])
  const [services, setServices] = useState([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [numpoolBalance, setNumPoolBalance] = useState(null)
  const [pricing, setPricing] = useState(null)
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupForm, setLookupForm] = useState({ query: '' })
  const [statusResult, setStatusResult] = useState(null)
  const [manualOrderId, setManualOrderId] = useState('')
  const [autoPolling, setAutoPolling] = useState(false)
  const [pollOrderId, setPollOrderId] = useState('')
  const [lastRefreshAt, setLastRefreshAt] = useState(null)
  const [nextRefreshIn, setNextRefreshIn] = useState(0)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setDataLoading(true)
        setError('')

        const servicesData = await api.numpool.services.getAll()
        const walletData = await api.wallet.get()
        const balanceData = await api.numpool.balance.get()

        setServices(servicesData)
        setWalletBalance(walletData.balance || 0)
        setNumPoolBalance(balanceData.balance || 0)

        if (servicesData.length > 0) {
          const defaultService = servicesData[0].id
          setForm(prev => ({ ...prev, service: defaultService }))
          await loadCountries(defaultService)
        }
      } catch (err) {
        console.error('Error fetching NumPool services:', err)
        setError(err.message)
      } finally {
        setDataLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (!autoPolling || !pollOrderId) return

    setNextRefreshIn(5)
    const interval = setInterval(() => {
      setNextRefreshIn((current) => {
        if (current <= 1) {
          handlePollSmsStatus(pollOrderId, { auto: true })
          return 5
        }
        return current - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [autoPolling, pollOrderId])

  async function loadCountries(serviceId) {
    if (!serviceId) {
      setCountries([])
      setForm(prev => ({ ...prev, country: '' }))
      return
    }

    try {
      setError('')
      const countriesData = await api.countries.getAll(serviceId)
      setCountries(countriesData)
      if (countriesData.length > 0) {
        setForm(prev => ({ ...prev, country: String(countriesData[0].id) }))
      }
    } catch (err) {
      console.error('Error loading NumPool countries:', err)
      setError(err.message)
      setCountries([])
      setForm(prev => ({ ...prev, country: '' }))
    }
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (name === 'service') {
      loadCountries(value)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.service || !form.country) {
      setError('Please select a service and country before purchasing.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setMessage('')

      const result = await api.numpool.buy({
        service: form.service,
        country: Number(form.country),
        operator: form.operator || undefined,
      })

      setSuccess(result)
      const selectedCountry = countries.find(c => String(c.id) === String(form.country))?.name || form.country
      const selectedService = services.find(s => s.id === form.service)?.name || form.service
      setMessage(`Successfully purchased ₦{selectedService} number from ₦{selectedCountry}.`)

      const [walletData, balanceData] = await Promise.all([
        api.wallet.get(),
        api.numpool.balance.get(),
      ])

      setWalletBalance(walletData.balance || 0)
      setNumPoolBalance(balanceData.balance || 0)
      setForm(prev => ({ ...prev, operator: '' }))
      setStatusResult(null)
      setPollOrderId(result.order_id)
      setLastRefreshAt(new Date())
      setAutoPolling(true)
    } catch (err) {
      setError(err.message)
      setMessage('')
      setSuccess(null)
    } finally {
      setLoading(false)
    }
  }

  function handleLookupChange(event) {
    setLookupForm(prev => ({ ...prev, [event.target.name]: event.target.value }))
  }

  async function fetchPricing() {
    try {
      setPricingLoading(true)
      setError('')
      const pricingData = await api.numpool.pricing({})
      setPricing(pricingData)
    } catch (err) {
      setError(err.message)
    } finally {
      setPricingLoading(false)
    }
  }

  async function handleLookup() {
    if (!lookupForm.query) return

    try {
      setLookupLoading(true)
      setError('')
      const result = await api.numpool.lookup({ query: lookupForm.query })
      setLookupResult(result)
    } catch (err) {
      setError(err.message)
      setLookupResult(null)
    } finally {
      setLookupLoading(false)
    }
  }

  async function handlePollSmsStatus(orderId = success?.order_id, options = {}) {
    const id = orderId || manualOrderId
    if (!id) {
      setError('Please provide an order ID to poll status.')
      return
    }

    const { auto = false, refreshId = false } = options
    if (refreshId) {
      setPollOrderId(id)
    }

    try {
      if (!auto) {
        setStatusLoading(true)
      }
      setError('')
      const status = await api.numpool.smsStatus(id)
      setStatusResult(status)
      setLastRefreshAt(new Date())

      const done = status?.status === 'received' || status?.status === 'cancelled'
      if (auto && done) {
        setAutoPolling(false)
      }
    } catch (err) {
      setError(err.message)
      setStatusResult(null)
      if (auto) {
        setAutoPolling(false)
      }
    } finally {
      if (!auto) {
        setStatusLoading(false)
      }
    }
  }

  async function handleCancelOrder(orderId = success?.order_id) {
    const id = orderId || manualOrderId
    if (!id) {
      setError('Please provide an order ID to cancel.')
      return
    }

    try {
      setCancelLoading(true)
      setError('')
      const cancelResult = await api.numpool.cancel(id)
      setStatusResult(cancelResult)
      setMessage(`Order ${id} was cancelled successfully.`)
      const balanceData = await api.numpool.balance.get()
      setNumPoolBalance(balanceData.balance || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setCancelLoading(false)
    }
  }

  function renderResult(value) {
    if (value === null || value === undefined) {
      return <span className="result-value">N/A</span>
    }

    if (Array.isArray(value)) {
      return (
        <ul className="result-list">
          {value.map((item, index) => (
            <li key={index}>{renderResult(item)}</li>
          ))}
        </ul>
      )
    }

    if (typeof value === 'object') {
      return (
        <div className="result-object">
          {Object.entries(value).map(([key, item]) => (
            <div key={key} className="result-row">
              <div className="result-key">{key}</div>
              <div className="result-value">{renderResult(item)}</div>
            </div>
          ))}
        </div>
      )
    }

    return <span className="result-value">{String(value)}</span>
  }

  if (dataLoading) {
    return <div><h2>Purchase Virtual Number</h2><p>Loading countries, services, and wallet...</p></div>
  }

  return (
    <div>
      <h2>Purchase Virtual Number</h2>
      <div className="wallet-summary">
        <p>Wallet balance: ${walletBalance.toFixed(2)}</p>
      </div>
      <form className="purchase-form" onSubmit={handleSubmit}>
        <label>
          Country
          <select name="country" value={form.country} onChange={handleChange} disabled={loading}>
            {countries.map(country => (
              <option key={country.id} value={country.id}>{country.name}{country.price != null ? ` — $${country.price}` : ''}</option>
            ))}
          </select>
        </label>
        <label>
          Service
          <select name="service" value={form.service} onChange={handleChange} disabled={loading}>
            {services.map(service => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Purchasing...' : 'Purchase Number'}</button>
      </form>
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}
      {success && (
        <div className="success-card">
          <h3>Order Details</h3>
          <p>Order ID: {success.order_id}</p>
          <p>Number: {success.number}</p>
          <p>Price: ${success.price}</p>
          <p>Status: {success.status || 'pending'}</p>
        </div>
      )}
      <div className="numpool-section">
        <h3>SMS Polling & Order Actions</h3>
        <label>
          Order ID
          <input
            name="manualOrderId"
            value={manualOrderId}
            onChange={(event) => setManualOrderId(event.target.value)}
            placeholder="Use active order or enter another ID"
          />
        </label>
        <div className="button-row">
          <button
            className="secondary-button"
            onClick={() => handlePollSmsStatus(undefined, { refreshId: true })}
            disabled={statusLoading || (!success?.order_id && !manualOrderId)}
          >
            {statusLoading ? 'Checking status…' : 'Poll SMS Status'}
          </button>
          <button
            className="secondary-button"
            onClick={() => handleCancelOrder()}
            disabled={cancelLoading || (!success?.order_id && !manualOrderId)}
          >
            {cancelLoading ? 'Cancelling…' : 'Cancel Order'}
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              const id = success?.order_id || manualOrderId
              if (id) {
                setPollOrderId(id)
                setAutoPolling(prev => !prev)
              }
            }}
            disabled={!success?.order_id && !manualOrderId}
          >
            {autoPolling ? 'Stop Auto Refresh' : 'Start Auto Refresh'}
          </button>
        </div>

        {autoPolling && (
          <div className="status-badge">
            <span>Next refresh</span>
            <strong>{nextRefreshIn}s</strong>
          </div>
        )}

        {statusResult && lastRefreshAt && (
          <div className="status-note">
            Last refresh: {new Date(lastRefreshAt).toLocaleTimeString()}
          </div>
        )}

        {statusResult && (
          <div className="status-card">
            <h4>Order Status</h4>
            <p>Order ID: {statusResult.order_id || manualOrderId}</p>
            <p>Status: {statusResult.status ?? String(statusResult.ok ? 'cancelled' : 'unknown')}</p>
            {statusResult.code && <p>Code: {statusResult.code}</p>}
            {statusResult.full_sms && <p>Message: {statusResult.full_sms}</p>}
            {statusResult.number && <p>Number: {statusResult.number}</p>}
            {statusResult.refunded != null && <p>Refunded: ${statusResult.refunded}</p>}
          </div>
        )}
      </div>
      <div className="sample-list">
        <h3>Available countries ({countries.length})</h3>
        <ul>
          {countries.map((country) => (
            <li key={country.code}>{country.name}</li>
          ))}
        </ul>
      </div>
      <div className="numpool-section">
        <h3>NumPool Pricing</h3>
        <button className="secondary-button" onClick={fetchPricing} disabled={pricingLoading}>
          {pricingLoading ? 'Loading pricing...' : 'Refresh Pricing'}
        </button>
        {pricing && (
          <div className="pricing-card">
            {renderResult(pricing)}
          </div>
        )}
      </div>
      <div className="numpool-section">
        <h3>NumPool Lookup</h3>
        <label>
          Lookup query
          <input
            name="query"
            value={lookupForm.query}
            onChange={handleLookupChange}
            placeholder="Search by number, country, or service"
          />
        </label>
        <button className="secondary-button" onClick={handleLookup} disabled={lookupLoading || !lookupForm.query}>
          {lookupLoading ? 'Looking up...' : 'Run Lookup'}
        </button>
        {lookupResult && (
          <div className="pricing-card">
            {renderResult(lookupResult)}
          </div>
        )}
      </div>
    </div>
  )
}

export default PurchaseNumberPage
