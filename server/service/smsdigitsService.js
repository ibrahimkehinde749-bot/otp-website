function getBaseUrl() {
  return process.env.SMSDIGITS_API_BASE_URL || 'https://smsdigits.com/api/v1'
}

function useMockData() {
  return process.env.USE_MOCK_DATA === 'true'
}

function log(message, data) {
  const output = `[SMSDIGITS SERVICE] ${message}` + (data ? ` ${JSON.stringify(data)}` : '')
  console.log(output)
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
  }
}

function parseBoolean(value) {
  return String(value).trim().toLowerCase() === 'true'
}

function tryUseMockData() {
  return parseBoolean(process.env.USE_MOCK_DATA)
}

function buildUrlWithQuery(url, key, apiKey) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(apiKey)}`
}

function buildRequestOptions(options, authVariant, apiKey) {
  const requestOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  }

  if (authVariant.type === 'header') {
    const headerValue = authVariant.prefix ? `${authVariant.prefix}${apiKey}` : apiKey
    requestOptions.headers[authVariant.name] = headerValue
  }

  return requestOptions
}

const authVariants = [
  { type: 'query', name: 'api_key' },
  { type: 'query', name: 'key' },
  { type: 'query', name: 'access_token' },
  { type: 'header', name: 'X-API-KEY' },
  { type: 'header', name: 'api-key' },
  { type: 'header', name: 'Authorization', prefix: 'Bearer ' },
]

import { debitWallet } from './walletService.js'

async function request(path, options = {}) {
  // prefer SMSDIGITS env var; fall back to the old SMSCODEX key if present
  const apiKey = process.env.SMSDIGITS_API_KEY || process.env.SMSCODEX_API_KEY || 'ab12a6805698ad32e6310cda1bb4a3f1'

  const baseUrl = `${getBaseUrl()}${path}`
  const errors = []

  for (const authVariant of authVariants) {
    const url = authVariant.type === 'query'
      ? buildUrlWithQuery(baseUrl, authVariant.name, apiKey)
      : baseUrl

    const requestOptions = buildRequestOptions(options, authVariant, apiKey)
    log('Requesting', { url, authVariant, options: requestOptions })

    let response
    try {
      response = await fetch(url, requestOptions)
    } catch (err) {
      log('SMSDIGITS fetch error', { url, err: err.message })
      if (tryUseMockData()) {
        log('Falling back to mock data')
        return null
      }
      throw new Error(`SMSDIGITS fetch failed: ${err.message}`)
    }

    const text = await response.text()
    if (response.ok) {
      try {
        const result = JSON.parse(text)
        log('SMSDIGITS response', result)
        return result
      } catch (err) {
        log('SMSDIGITS response parse failed', { text, err: err.message })
        throw new Error('Failed to parse SMSDIGITS response JSON.')
      }
    }

    log('SMSDIGITS request failed', { url, authVariant, status: response.status, body: text })

    if (response.status === 401 || response.status === 403) {
      errors.push({ authVariant, status: response.status, body: text })
      continue
    }

    if (tryUseMockData()) {
      log('Falling back to mock data due to non-auth failure')
      return null
    }

    throw new Error(`SMSDIGITS request failed: ${response.status} ${text}`)
  }

  if (tryUseMockData()) {
    log('Falling back to mock data after all auth variants failed')
    return null
  }

  const authErrorDetails = errors.map(e => `${e.authVariant.name}:${e.status}`).join(', ')
  throw new Error(`SMSDIGITS request failed after auth attempts: ${authErrorDetails}`)
}

// Mock data functions
function getMockBalance() {
  return { balance: 25.50, currency: 'USD' }
}

function getMockOrdersList() {
  return {
    orders: [
      {
        id: 'ORD-001',
        number: '+1 555 0123456',
        country: 'USA',
        service: 'WhatsApp',
        status: 'active',
        price: 0.99,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        sms_list: [
          { code: '123456', received_at: new Date().toISOString() }
        ]
      },
      {
        id: 'ORD-002',
        number: '+44 7700 900123',
        country: 'UK',
        service: 'Telegram',
        status: 'pending',
        price: 1.49,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7200000).toISOString(),
        sms_list: []
      }
    ]
  }
}

function getMockPurchaseResponse() {
  const randomNum = Math.random().toString(36).substring(7)
  return {
    order_id: `ORD-${randomNum}`,
    number: `+1 555 ${Math.floor(Math.random() * 9000000) + 1000000}`,
    price: 0.99,
    expires_in: 3600,
    expires_at: new Date(Date.now() + 3600000).toISOString()
  }
}

export async function purchaseNumber(details) {
  if (!details?.country || !details?.service) {
    throw new Error('country and service are required to purchase a number.')
  }

  const result = await request('/marketplace/fast-purchase/api', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(details),
  })

  const purchaseResult = result || getMockPurchaseResponse()
  const price = Number(purchaseResult.price ?? 0)
  if (Number.isNaN(price) || price <= 0) {
    throw new Error('Purchase result did not return a valid price.')
  }

  try {
    debitWallet(price, {
      reference: purchaseResult.order_id,
      provider: 'purchase',
      description: 'Purchase checkout debit',
    })
  } catch (err) {
    if (err.message.includes('Insufficient wallet balance')) {
      throw new Error('Insufficient wallet balance. Please fund your wallet before purchasing.')
    }
    throw err
  }

  return purchaseResult
}

export async function getOrder(orderId) {
  if (!orderId) {
    throw new Error('orderId is required to get order status.')
  }

  const result = await request(`/marketplace/orders/${encodeURIComponent(orderId)}`, {
    headers: getAuthHeaders(),
  })

  if (result) return result
  const mockList = getMockOrdersList()
  return mockList.orders.find(o => o.id === orderId) || mockList.orders[0]
}

export async function completeOrder(orderId) {
  if (!orderId) {
    throw new Error('orderId is required to complete an order.')
  }

  const result = await request(`/marketplace/orders/${encodeURIComponent(orderId)}/complete`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })

  return result || { status: 'completed', order_id: orderId }
}

export async function cancelOrder(orderId) {
  if (!orderId) {
    throw new Error('orderId is required to cancel an order.')
  }

  const result = await request(`/marketplace/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })

  return result || { status: 'cancelled', order_id: orderId }
}

export async function getBalance() {
  const result = await request('/balance', {
    headers: getAuthHeaders(),
  })

  return result || getMockBalance()
}

export async function getAllOrders() {
  const result = await request('/orders', {
    headers: getAuthHeaders(),
  })

  return result || getMockOrdersList()
}

export function getCountries() {
  return [
    { code: 'US', name: 'USA' },
    { code: 'GB', name: 'UK' },
    { code: 'DE', name: 'Germany' },
    { code: 'IN', name: 'India' },
    { code: 'FR', name: 'France' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'JP', name: 'Japan' },
    { code: 'BR', name: 'Brazil' },
    { code: 'MX', name: 'Mexico' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'KR', name: 'South Korea' },
    { code: 'RU', name: 'Russia' },
  ]
}

export function getServices() {
  return [
    { code: 'whatsapp', name: 'WhatsApp' },
    { code: 'telegram', name: 'Telegram' },
    { code: 'sms', name: 'SMS' },
    { code: 'viber', name: 'Viber' },
    { code: 'instagram', name: 'Instagram' },
    { code: 'facebook', name: 'Facebook' },
    { code: 'discord', name: 'Discord' },
    { code: 'gmail', name: 'Gmail' },
    { code: 'signal', name: 'Signal' },
    { code: 'line', name: 'LINE' },
    { code: 'wechat', name: 'WeChat' },
    { code: 'qq', name: 'QQ' },
    { code: 'tiktok', name: 'TikTok' },
    { code: 'twitter', name: 'Twitter' },
    { code: 'linkedin', name: 'LinkedIn' },
  ]
}
