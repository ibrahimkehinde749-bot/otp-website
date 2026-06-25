const BASE_URL = process.env.NUMPOOL_API_URL || 'https://numpool.com/api/v1'
const API_KEY = process.env.NUMPOOL_API_KEY

function getHeaders() {
  if (!API_KEY) {
    throw new Error('NUMPOOL_API_KEY is required in the backend environment')
  }

  return {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  }
}

function ensurePath(path) {
  if (!path || typeof path !== 'string') {
    throw new Error('NumPool request path is required')
  }
  if (!path.startsWith('/')) {
    throw new Error('NumPool request path must start with /')
  }
  if (path.includes('..')) {
    throw new Error('NumPool request path contains invalid segments')
  }
  return path
}

function buildUrl(path, query) {
  const sanitized = ensurePath(path)
  let url = `${BASE_URL}${sanitized}`
  if (query && typeof query === 'object') {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    }
    const queryString = params.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }
  return url
}

async function numpoolRequest({ path, method = 'GET', body, query }) {
  const url = buildUrl(path, query)
  const options = {
    method: method.toUpperCase(),
    headers: getHeaders(),
  }

  if (body !== undefined && body !== null) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)
  const text = await response.text()

  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch (err) {
    throw new Error(`NumPool response parse failed: ${err.message}`)
  }

  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText
    throw new Error(`NumPool request failed: ${response.status} ${message}`)
  }

  return data
}

export async function getNumPoolBalance() {
  return await numpoolRequest({ path: '/balance', method: 'GET' })
}

export async function getNumPoolServices() {
  return await numpoolRequest({ path: '/services', method: 'GET' })
}

export async function getNumPoolCountries(service) {
  const query = service ? { service } : undefined
  return await numpoolRequest({ path: '/countries', method: 'GET', query })
}

export async function buyNumPoolNumber({ service, country, operator }) {
  if (!service || !country) {
    throw new Error('service and country are required to buy a NumPool number.')
  }
  return await numpoolRequest({
    path: '/buy',
    method: 'POST',
    body: {
      service,
      country,
      ...(operator ? { operator } : {}),
    },
  })
}

export async function getNumPoolSmsStatus(orderId) {
  if (!orderId) {
    throw new Error('orderId is required to check SMS status.')
  }
  return await numpoolRequest({ path: `/sms/${encodeURIComponent(orderId)}`, method: 'GET' })
}

export async function cancelNumPoolOrder(orderId) {
  if (!orderId) {
    throw new Error('orderId is required to cancel a NumPool order.')
  }
  return await numpoolRequest({ path: `/cancel/${encodeURIComponent(orderId)}`, method: 'POST' })
}

export async function getNumPoolPricing(query) {
  return await numpoolRequest({ path: '/pricing', method: 'GET', query })
}

export async function lookupNumPool(body) {
  return await numpoolRequest({ path: '/lookup', method: 'POST', body })
}
