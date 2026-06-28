import 'dotenv/config'
import crypto from 'crypto'
import { query, transaction } from './db.js'

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

export function validateFundingAmount(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number.')
  }
  return Number(amount.toFixed(2))
}

export async function getWalletBalance(userId) {
  if (!userId) {
    return {
      balance: walletState.balance,
      currency: 'NGN',
    }
  }

  const rows = await query('SELECT wallet_balance FROM users WHERE id = ? LIMIT 1', [userId])
  const balance = Number(rows?.[0]?.wallet_balance || 0)

  return {
    balance,
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

export async function creditWallet(amount, { userId, reference, provider = 'manual', description = 'Wallet top-up', status = 'completed' } = {}) {
  const normalizedAmount = validateFundingAmount(amount)

  if (userId) {
    const id = crypto.randomUUID()
    await transaction(async (conn) => {
      await conn.execute(
        `UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE id = ?`,
        [normalizedAmount.toFixed(2), userId]
      )
      await conn.execute(
        `INSERT INTO wallet_transactions (id, user_id, amount, type, status, reference, provider, description, metadata, created_at)
         VALUES (?, ?, ?, 'credit', ?, ?, ?, ?, ?, NOW())`,
        [id, userId, normalizedAmount.toFixed(2), status, reference || null, provider, description, null]
      )
    })
    return {
      id,
      reference,
      provider,
      amount: normalizedAmount,
      currency: 'NGN',
      type: 'credit',
      status,
      description,
      extra: null,
      created_at: new Date().toISOString(),
    }
  }

  walletState.balance += normalizedAmount
  return createTransaction({
    amount: normalizedAmount,
    type: 'credit',
    status,
    reference,
    provider,
    description,
  })
}

export async function debitWallet(amount, { userId, reference, provider = 'purchase', description = 'Purchase debit', status = 'completed' } = {}) {
  const normalizedAmount = validateFundingAmount(amount)

  if (userId) {
    const current = await getWalletBalance(userId)
    if (current.balance < normalizedAmount) {
      throw new Error('Insufficient wallet balance.')
    }

    const id = crypto.randomUUID()
    await transaction(async (conn) => {
      await conn.execute(
        `UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) - ? WHERE id = ?`,
        [normalizedAmount.toFixed(2), userId]
      )
      await conn.execute(
        `INSERT INTO wallet_transactions (id, user_id, amount, type, status, reference, provider, description, metadata, created_at)
         VALUES (?, ?, ?, 'debit', ?, ?, ?, ?, ?, NOW())`,
        [id, userId, normalizedAmount.toFixed(2), status, reference || null, provider, description, null]
      )
    })
    return {
      id,
      reference,
      provider,
      amount: normalizedAmount,
      currency: 'NGN',
      type: 'debit',
      status,
      description,
      extra: null,
      created_at: new Date().toISOString(),
    }
  }

  if (walletState.balance < normalizedAmount) {
    throw new Error('Insufficient wallet balance.')
  }

  walletState.balance -= normalizedAmount
  return createTransaction({
    amount: normalizedAmount,
    type: 'debit',
    status,
    reference,
    provider,
    description,
  })
}

export async function getWalletFundingBankDetails() {
  return {
    bankName: process.env.WALLET_BANK_NAME || 'Opay',
    accountName: process.env.WALLET_ACCOUNT_NAME || 'Ibrahim kehinde',
    accountNumber: process.env.WALLET_ACCOUNT_NUMBER || '7088755649',
    instructions: process.env.WALLET_BANK_INSTRUCTIONS || 'Transfer the amount to the account above, then click “I Have Paid” to submit your funding request.',
  }
}

export async function submitWalletFundingRequest({ userId, amount, paymentReference }) {
  const normalizedAmount = validateFundingAmount(amount)
  const id = crypto.randomUUID()

  await query(
    `INSERT INTO wallet_funding_requests (id, user_id, amount, payment_reference, payment_status, created_at)
     VALUES (?, ?, ?, ?, 'Pending', NOW())`,
    [id, userId, normalizedAmount.toFixed(2), paymentReference || null]
  )

  return {
    id,
    userId,
    amount: normalizedAmount,
    paymentReference: paymentReference || null,
    paymentStatus: 'Pending',
    createdAt: new Date().toISOString(),
  }
}

export async function getWalletFundingRequests({ userId, isAdmin = false } = {}) {
  const whereClause = isAdmin ? '' : 'WHERE r.user_id = ?'
  const params = isAdmin ? [] : [userId]
  const rows = await query(
    `SELECT r.id, r.user_id, r.amount, r.payment_reference, r.payment_status, r.created_at, u.full_name, u.email
     FROM wallet_funding_requests r
     LEFT JOIN users u ON u.id = r.user_id
     ${whereClause}
     ORDER BY r.created_at DESC`,
    params
  )

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    paymentReference: row.payment_reference,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    user: row.full_name ? { fullName: row.full_name, email: row.email } : null,
  }))
}

export async function approveWalletFundingRequest(requestId, { adminUserId } = {}) {
  if (!requestId) throw new Error('Request ID is required.')
  const row = await query('SELECT * FROM wallet_funding_requests WHERE id = ? LIMIT 1', [requestId])
  const request = row?.[0]
  if (!request) throw new Error('Funding request not found.')
  if (request.payment_status !== 'Pending') throw new Error('This funding request has already been processed.')

  const amount = Number(request.amount)
  const id = crypto.randomUUID()

  await transaction(async (conn) => {
    await conn.execute('UPDATE wallet_funding_requests SET payment_status = ?, updated_at = NOW() WHERE id = ?', ['Approved', requestId])
    await conn.execute('UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE id = ?', [amount.toFixed(2), request.user_id])
    await conn.execute(
      `INSERT INTO wallet_transactions (id, user_id, amount, type, status, reference, provider, description, metadata, created_at)
       VALUES (?, ?, ?, 'credit', 'completed', ?, 'manual', ?, ?, NOW())`,
      [id, request.user_id, amount.toFixed(2), `funding-${requestId}`, 'Manual wallet funding approved', null]
    )
  })

  return { id: request.id, paymentStatus: 'Approved', amount }
}

export async function rejectWalletFundingRequest(requestId) {
  if (!requestId) throw new Error('Request ID is required.')
  const row = await query('SELECT * FROM wallet_funding_requests WHERE id = ? LIMIT 1', [requestId])
  const request = row?.[0]
  if (!request) throw new Error('Funding request not found.')
  if (request.payment_status !== 'Pending') throw new Error('This funding request has already been processed.')

  await query('UPDATE wallet_funding_requests SET payment_status = ?, updated_at = NOW() WHERE id = ?', ['Rejected', requestId])
  return { id: request.id, paymentStatus: 'Rejected' }
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
  const normalizedAmount = validateFundingAmount(amount)

  const tx_ref = formatTxRef()
  const payload = {
    tx_ref,
    amount: normalizedAmount.toFixed(2),
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
    const transaction = await creditWallet(normalizedAmount, {
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
