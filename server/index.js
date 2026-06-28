import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
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
import { ApiError } from './service/apiError.js'
import jwt from 'jsonwebtoken'
import { runMigrations } from './migrate.js'

export const app = express()
const port = Number(process.env.PORT || process.env.RAILWAY_PORT) || 4000

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' })
})

app.get('/', (req, res) => {
  res.json({ success: true, message: 'OTP backend is running' })
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

app.get('/api/balance', authMiddleware, wrap(async (req) => await getBalance(req.user.id)))
app.get('/api/orders', authMiddleware, wrap(async (req) => await getAllOrders(req.user.id)))
app.get('/api/countries', wrap(async (req) => {
  const countries = await getNumPoolCountries(req.query.service)
  return countries.map(({ id, name, price }) => ({ id, name, price }))
}))
app.get('/api/services', wrap(async () => {
  const services = await getServices()
  return services.map(({ code, id, name }) => ({ id: id ?? code, name }))
}))
app.post('/api/purchase', authMiddleware, wrap(async (req) => await purchaseNumber(req.body, req.user.id)))
app.get('/api/orders/:orderId', authMiddleware, wrap(async (req) => await getOrder(req.params.orderId)))
app.post('/api/orders/:orderId/complete', wrap(async (req) => await completeOrder(req.params.orderId)))
app.post('/api/orders/:orderId/cancel', wrap(async (req) => await cancelOrder(req.params.orderId)))

app.get('/api/wallet', authMiddleware, wrap(async (req) => getWalletBalance(req.user.id)))
app.get('/api/wallet/transactions', authMiddleware, wrap(async (req) => getWalletTransactions(req.user.id)))
app.post('/api/wallet/deposit', authMiddleware, wrap(async (req) => await initFlutterwavePayment({ ...req.body, userId: req.user.id })))
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

function startServer(portToListen, host = '0.0.0.0', attempt = 1) {
  console.log(`[SERVER] Attempting to listen on ${host}:${portToListen} (attempt ${attempt})`)

  const server = app.listen(portToListen, host)

  server.on('listening', () => {
    console.log(`SMSDIGITS backend listening on http://${host}:${portToListen}`)
  })

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      const nextAttempt = attempt + 1
      const maxAttempts = 10
      if (nextAttempt <= maxAttempts) {
        console.warn(`[SERVER] Port ${portToListen} is busy. Retrying in 2s (attempt ${nextAttempt}/${maxAttempts})...`)
        setTimeout(() => startServer(portToListen, host, nextAttempt), 2000)
        return
      }
    }

    console.error('[SERVER] Failed to start:', error)
    process.exit(1)
  })
}

export async function startApp() {
  console.log('[SERVER] Starting application')

  process.on('unhandledRejection', (reason) => {
    console.error('[SERVER] Unhandled rejection:', reason)
  })

  process.on('uncaughtException', (error) => {
    console.error('[SERVER] Uncaught exception:', error)
    process.exit(1)
  })

  try {
    await runMigrations()
  } catch (err) {
    console.error('[SERVER] Migration failed:', err)
    process.exit(1)
  }

  startServer(port)
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  startApp()
}
