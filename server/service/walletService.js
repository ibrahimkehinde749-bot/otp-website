const walletState = {
  balance: 0,
  currency: 'USD',
  transactions: [],
}

function createTransaction({ amount, type, status, reference, provider, description, extra }) {
  const tx = {
    id: `TX-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
    reference,
    provider,
    amount,
    currency: walletState.currency,
    type,
    status,
    description,
    extra,
    created_at: new Date().toISOString(),
  }
  walletState.transactions.unshift(tx)
  return tx
}

export function getWalletBalance() {
  return {
    balance: walletState.balance,
    currency: walletState.currency,
  }
}

export function getWalletTransactions() {
  return walletState.transactions
}

export function creditWallet(amount, { reference, provider = 'manual', description = 'Wallet top-up' } = {}) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number.')
  }

  walletState.balance += amount
  return createTransaction({
    amount,
    type: 'credit',
    status: 'completed',
    reference,
    provider,
    description,
  })
}

export function debitWallet(amount, { reference, provider = 'purchase', description = 'Purchase debit' } = {}) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number.')
  }

  if (walletState.balance < amount) {
    throw new Error('Insufficient wallet balance.')
  }

  walletState.balance -= amount
  return createTransaction({
    amount,
    type: 'debit',
    status: 'completed',
    reference,
    provider,
    description,
  })
}

function getFlutterwaveSecret() {
  const key = process.env.FLUTTERWAVE_SECRET_KEY
  if (!key) {
    throw new Error('FLUTTERWAVE_SECRET_KEY is required for Flutterwave integration.')
  }
  return key
}

function getBaseUrl() {
  return 'https://api.flutterwave.com/v3'
}

function formatTxRef() {
  return `wallet-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

export async function initFlutterwavePayment({ amount, currency = 'USD', email = 'user@example.com', fullname = 'Wallet User', phone_number = null }) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number.')
  }

  const tx_ref = formatTxRef()
  const payload = {
    tx_ref,
    amount: amount.toFixed(2),
    currency,
    redirect_url: process.env.FLUTTERWAVE_REDIRECT_URL || 'http://localhost:5173/app/wallet/callback',
    customer: {
      email,
      name: fullname,
      phone_number,
    },
    customizations: {
      title: 'Wallet Funding',
      description: 'Add funds to your wallet',
    },
  }

  if (process.env.USE_MOCK_DATA === 'true' && !process.env.FLUTTERWAVE_SECRET_KEY) {
    const transaction = createTransaction({
      amount,
      type: 'credit',
      status: 'completed',
      reference: tx_ref,
      provider: 'flutterwave-mock',
      description: 'Mock wallet top-up',
    })
    walletState.balance += amount
    return {
      paymentLink: null,
      transaction_ref: tx_ref,
      mock: true,
      transaction,
      balance: walletState.balance,
    }
  }

  const response = await fetch(`${getBaseUrl()}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecret()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!response.ok || data.status !== 'success') {
    throw new Error(`Flutterwave init failed: ${data.message || data.status}`)
  }

  return {
    paymentLink: data.data.link,
    transaction_ref: tx_ref,
    status: 'pending',
  }
}

export async function verifyFlutterwavePayment({ transaction_id, tx_ref }) {
  if (!transaction_id && !tx_ref) {
    throw new Error('transaction_id or tx_ref is required.')
  }

  if (process.env.USE_MOCK_DATA === 'true' && !process.env.FLUTTERWAVE_SECRET_KEY) {
    const transaction = creditWallet(10, {
      reference: tx_ref || transaction_id,
      provider: 'flutterwave-mock',
      description: 'Mock wallet verification credit',
    })
    return { verified: true, transaction, balance: walletState.balance }
  }

  const endpoint = transaction_id
    ? `/transactions/${transaction_id}/verify`
    : `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`

  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecret()}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json()
  if (!response.ok || data.status !== 'success') {
    throw new Error(`Flutterwave verification failed: ${data.message || data.status}`)
  }

  const paymentData = transaction_id ? data.data : data.data[0]
  if (paymentData.status !== 'successful') {
    throw new Error(`Payment not successful: ${paymentData.status}`)
  }

  const amount = Number(paymentData.amount)
  const reference = paymentData.tx_ref || paymentData.reference || tx_ref || transaction_id
  const transaction = creditWallet(amount, {
    reference,
    provider: 'flutterwave',
    description: 'Wallet top-up via Flutterwave',
  })

  return { verified: true, transaction, balance: walletState.balance }
}
