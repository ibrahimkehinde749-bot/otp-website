import 'dotenv/config'
import { query } from './db.js'

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

function formatDbTransaction(row) {
  return {
    id: row.id,
    reference: row.reference,
    provider: row.provider,
    amount: Number(row.amount),
    currency: 'NGN',
    type: row.type,
    status: row.status,
    description: row.description,
    extra: row.metadata,
    created_at: row.created_at,
  }
}

export async function getWalletBalance(userId) {
  if (!userId) {
    return {
      balance: walletState.balance,
      currency: 'NGN',
    }
  }

  const rows = await query(
    `SELECT COALESCE(SUM(CASE
      WHEN type = 'credit' THEN amount
      WHEN type = 'debit' THEN -amount
      ELSE 0
    END), 0) AS balance
    FROM wallet_transactions
    WHERE user_id = ? AND status = 'completed'`,
    [userId]
  )

  return {
    balance: Number(rows?.[0]?.balance || 0),
    currency: 'NGN',
  }
}

export async function getWalletTransactions(userId) {
  if (!userId) {
    return walletState.transactions
  }

  const rows = await query(
    `SELECT id, reference, provider, amount, type, status, description, metadata, created_at
     FROM wallet_transactions
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  )

  return rows.map(formatDbTransaction)
}

export async function creditWallet(amount, { userId, reference, provider = 'manual', description = 'Wallet top-up' } = {}) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number.')
  }

  if (userId) {
    const id = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    await query(
      `INSERT INTO wallet_transactions (id, user_id, amount, type, status, reference, provider, description, metadata, created_at)
       VALUES (?, ?, ?, 'credit', 'completed', ?, ?, ?, ?, NOW())`,
      [id, userId, amount.toFixed(2), reference || null, provider, description, null]
    )
    return {
      id,
      reference,
      provider,
      amount,
      currency: 'NGN',
      type: 'credit',
      status: 'completed',
      description,
      extra: null,
      created_at: new Date().toISOString(),
    }
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

export async function debitWallet(amount, { userId, reference, provider = 'purchase', description = 'Purchase debit' } = {}) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number.')
  }

  if (userId) {
    const current = await getWalletBalance(userId)
    if (current.balance < amount) {
      throw new Error('Insufficient wallet balance.')
    }

    const id = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    await query(
      `INSERT INTO wallet_transactions (id, user_id, amount, type, status, reference, provider, description, metadata, created_at)
       VALUES (?, ?, ?, 'debit', 'completed', ?, ?, ?, ?, NOW())`,
      [id, userId, amount.toFixed(2), reference || null, provider, description, null]
    )
    return {
      id,
      reference,
      provider,
      amount,
      currency: 'NGN',
      type: 'debit',
      status: 'completed',
      description,
      extra: null,
      created_at: new Date().toISOString(),
    }
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

export async function initFlutterwavePayment({ amount, currency = 'USD', email = 'user@example.com', fullname = 'Wallet User', phone_number = null, userId }) {
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
    const transaction = await creditWallet(amount, {
      userId,
      reference: tx_ref,
      provider: 'flutterwave-mock',
      description: 'Mock wallet top-up',
    })
    return {
      paymentLink: null,
      transaction_ref: tx_ref,
      mock: true,
      transaction,
      balance: await getWalletBalance(userId),
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

export async function verifyFlutterwavePayment({ transaction_id, tx_ref, userId }) {
  if (!transaction_id && !tx_ref) {
    throw new Error('transaction_id or tx_ref is required.')
  }

  if (process.env.USE_MOCK_DATA === 'true' && !process.env.FLUTTERWAVE_SECRET_KEY) {
    const transaction = await creditWallet(10, {
      userId,
      reference: tx_ref || transaction_id,
      provider: 'flutterwave-mock',
      description: 'Mock wallet verification credit',
    })
    return { verified: true, transaction, balance: await getWalletBalance(userId) }
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
  const transaction = await creditWallet(amount, {
    userId,
    reference,
    provider: 'flutterwave',
    description: 'Wallet top-up via Flutterwave',
  })

  return { verified: true, transaction, balance: await getWalletBalance(userId) }
}
