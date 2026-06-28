const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://otp-website-production.up.railway.app/api'
const API_BASE_URL = configuredBaseUrl.endsWith('/api') ? configuredBaseUrl : `${configuredBaseUrl}/api`

function getAuthToken() {
  const stored = localStorage.getItem('otp-auth')
  if (!stored) return null
  try {
    return JSON.parse(stored).token
  } catch {
    return null
  }
}

async function apiCall(endpoint, options = {}) {
  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let url = `${API_BASE_URL}${endpoint}`
  if (options.query && typeof options.query === 'object') {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    }
    const queryString = params.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  const requestOptions = {
    headers,
    ...options,
  }
  delete requestOptions.query

  let data
  try {
    const response = await fetch(url, requestOptions)
    data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || `API request failed with status ${response.status}`)
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Invalid response from server.')
    }
    if (err instanceof TypeError) {
      throw new Error('Network error or server unreachable.')
    }
    throw err
  }

  return data.data
}

export const api = {
  auth: {
    register: (details) => apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    }),
    login: (details) => apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(details),
    }),
    logout: () => apiCall('/auth/logout', { method: 'POST' }),
  },
  user: {
    profile: () => apiCall('/user/profile'),
    update: (updates) => apiCall('/user/update', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  },
  balance: {
    get: () => apiCall('/balance'),
  },
  orders: {
    getAll: () => apiCall('/orders'),
    get: (id) => apiCall(`/orders/${id}`),
    purchase: (details) => apiCall('/purchase', {
      method: 'POST',
      body: JSON.stringify(details),
    }),
    complete: (id) => apiCall(`/orders/${id}/complete`, { method: 'POST' }),
    cancel: (id) => apiCall(`/orders/${id}/cancel`, { method: 'POST' }),
  },
  wallet: {
    get: () => apiCall('/wallet'),
    getTransactions: () => apiCall('/wallet/transactions'),
    getBankDetails: () => apiCall('/wallet/funding-bank-details'),
    getFundingRequests: () => apiCall('/wallet/funding-requests'),
    fund: (details) => apiCall('/wallet/funding-request', {
      method: 'POST',
      body: JSON.stringify(details),
    }),
    deposit: (details) => apiCall('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify(details),
    }),
    verify: (details) => apiCall('/wallet/verify', {
      method: 'POST',
      body: JSON.stringify(details),
    }),
    admin: {
      getFundingRequests: () => apiCall('/wallet/funding-requests'),
      approve: (id) => apiCall(`/admin/wallet/funding-requests/${id}/approve`, { method: 'POST' }),
      reject: (id) => apiCall(`/admin/wallet/funding-requests/${id}/reject`, { method: 'POST' }),
    },
  },
  numpool: {
    balance: {
      get: () => apiCall('/numpool/balance'),
    },
    services: {
      getAll: () => apiCall('/numpool/services'),
    },
    countries: {
      getAll: (service) => apiCall('/numpool/countries', {
        method: 'GET',
        query: service ? { service } : undefined,
      }),
    },
    buy: (details) => apiCall('/numpool/buy', {
      method: 'POST',
      body: JSON.stringify(details),
    }),
    smsStatus: (orderId) => apiCall(`/numpool/sms/${orderId}`),
    cancel: (orderId) => apiCall(`/numpool/cancel/${orderId}`, {
      method: 'POST',
    }),
    pricing: (query) => apiCall('/numpool/pricing', {
      method: 'GET',
      query,
    }),
    lookup: (body) => apiCall('/numpool/lookup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  },
  countries: {
    getAll: (service) => apiCall('/countries', {
      method: 'GET',
      query: service ? { service } : undefined,
    }),
  },
  services: {
    getAll: () => apiCall('/services'),
  },
}
