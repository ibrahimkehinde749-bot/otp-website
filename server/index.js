import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import {
  purchaseNumber,
  getOrder,
  completeOrder,
  cancelOrder,
  getBalance,
  getAllOrders,
  getCountries,
  getServices,
} from './service/smsdigitsService.js'
import {
  getWalletBalance,
  getWalletTransactions,
  initFlutterwavePayment,
  verifyFlutterwavePayment,
} from './service/walletService.js'
import {
  registerUser,
  authenticateUser,
  findUserById,
  updateUser,
} from './service/authService.js'
import {
  getNumPoolBalance,
  getNumPoolServices,
  getNumPoolCountries,
  buyNumPoolNumber,
  getNumPoolSmsStatus,
  cancelNumPoolOrder,
  getNumPoolPricing,
  lookupNumPool,
} from './service/numpoolService.js'
import { ApiError, UnauthorizedError } from './service/apiError.js'
import jwt from 'jsonwebtoken'

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ success: true, message: 'OTP backend is running' })
})

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' })
})

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Missing token' })
  const token = auth.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    req.user = payload
    next()
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

function wrap(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req, res)
      res.json({ success: true, data: result })
    } catch (error) {
      console.error('[SMSDIGITS API]', error)
      if (error instanceof ApiError) {
        return res.status(error.status).json({ success: false, error: error.message })
      }
      res.status(500).json({ success: false, error: 'An unexpected server error occurred.' })
    }
  }
}

app.get('/api/balance', wrap(async () => await getBalance()))
app.get('/api/orders', wrap(async () => await getAllOrders()))
app.get('/api/countries', wrap(async (req) => {
  const countries = await getNumPoolCountries(req.query.service)
  return countries.map(({ id, name, price }) => ({ id, name, price }))
}))
app.get('/api/services', wrap(async () => {
  const services = await getServices()
  return services.map(({ code, id, name }) => ({ id: id ?? code, name }))
}))
app.post('/api/purchase', wrap(async (req) => await purchaseNumber(req.body)))
app.get('/api/orders/:orderId', wrap(async (req) => await getOrder(req.params.orderId)))
app.post('/api/orders/:orderId/complete', wrap(async (req) => await completeOrder(req.params.orderId)))
app.post('/api/orders/:orderId/cancel', wrap(async (req) => await cancelOrder(req.params.orderId)))

app.get('/api/wallet', wrap(async () => getWalletBalance()))
app.get('/api/wallet/transactions', wrap(async () => getWalletTransactions()))
app.post('/api/wallet/deposit', wrap(async (req) => await initFlutterwavePayment(req.body)))
app.post('/api/wallet/verify', wrap(async (req) => await verifyFlutterwavePayment(req.body)))

app.get('/api/numpool/balance', wrap(async () => await getNumPoolBalance()))
app.get('/api/numpool/services', wrap(async () => await getNumPoolServices()))
app.get('/api/numpool/countries', wrap(async (req) => await getNumPoolCountries(req.query.service)))
app.post('/api/numpool/buy', wrap(async (req) => await buyNumPoolNumber(req.body)))
app.get('/api/numpool/sms/:orderId', wrap(async (req) => await getNumPoolSmsStatus(req.params.orderId)))
app.post('/api/numpool/cancel/:orderId', wrap(async (req) => await cancelNumPoolOrder(req.params.orderId)))

app.post('/api/numpool/lookup', wrap(async (req) => await lookupNumPool(req.body)))

app.get('/api/numpool/pricing', wrap(async (req) => await getNumPoolPricing(req.query)))

// Authentication routes
app.post('/api/auth/register', wrap(async (req) => {
  const { fullName, email, password, phoneNumber } = req.body
  return await registerUser({ fullName, email, password, phoneNumber })
}))

app.post('/api/auth/login', wrap(async (req) => {
  const { email, password } = req.body
  return await authenticateUser({ email, password })
}))

// Protected profile and update routes
app.get('/api/user/profile', authMiddleware, wrap(async (req) => {
  const user = await findUserById(req.user.id)
  if (!user) throw new Error('User not found')
  const { password, ...safe } = user
  return safe
}))

app.put('/api/user/update', authMiddleware, wrap(async (req) => {
  const updates = req.body
  return await updateUser(req.user.id, updates)
}))

app.post('/api/auth/logout', authMiddleware, wrap(async (req) => {
  // stateless JWT: client should discard token. We return success.
  return { loggedOut: true }
}))

app.listen(port, '0.0.0.0', () => {
  console.log(`SMSDIGITS backend listening on http://0.0.0.0:${port}`)
})
