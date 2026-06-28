import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { query, transaction } from './db.js'
import { BadRequestError, ConflictError, UnauthorizedError } from './apiError.js'

const SALT_ROUNDS = 10

function createAuthResult(user) {
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' })
  return { token, user }
}

function mapDbRowToUser(row) {
  if (!row) return null
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    password: row.password,
    phoneNumber: row.phone_number,
    registrationDate: row.registration_date,
    accountStatus: row.account_status,
    role: row.role,
    walletBalance: Number(row.wallet_balance || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function registerUser({ fullName, email, password, phoneNumber }) {
  if (!email || !password || !fullName) throw new BadRequestError('fullName, email and password are required')

  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
  if (existing && existing.length > 0) throw new ConflictError('Email already registered')

  const hashed = await bcrypt.hash(password, SALT_ROUNDS)
  const id = crypto.randomUUID()
  const normalizedEmail = String(email).trim().toLowerCase()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const role = adminEmail && normalizedEmail === adminEmail ? 'admin' : 'user'

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO users (id, full_name, email, password, phone_number, registration_date, account_status, wallet_balance, role)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [id, fullName, email, hashed, phoneNumber || null, 'active', '0.00', role]
    )
  })

  const savedUser = await findUserById(id)
  if (!savedUser) throw new Error('Failed to retrieve newly created user')

  const { password: _p, ...safeUser } = savedUser
  return createAuthResult(safeUser)
}

export async function findUserByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
  return mapDbRowToUser(rows && rows[0])
}

export async function findUserById(id) {
  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id])
  return mapDbRowToUser(rows && rows[0])
}

export async function authenticateUser({ email, password }) {
  const user = await findUserByEmail(email)
  if (!user) throw new UnauthorizedError('Invalid credentials')
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) throw new UnauthorizedError('Invalid credentials')
  const { password: _p, ...safe } = user
  return createAuthResult(safe)
}

export async function updateUser(id, updates) {
  const allowed = {}
  if (updates.fullName) allowed.full_name = updates.fullName
  if (updates.phoneNumber) allowed.phone_number = updates.phoneNumber
  if (updates.accountStatus) allowed.account_status = updates.accountStatus
  if (updates.email) allowed.email = updates.email

  if (updates.password) {
    allowed.password = await bcrypt.hash(updates.password, SALT_ROUNDS)
  }

  const keys = Object.keys(allowed)
  if (keys.length === 0) {
    const user = await findUserById(id)
    const { password: _p, ...safe } = user || {}
    return safe
  }

  const sets = keys.map(k => `${k} = ?`).join(', ')
  const params = keys.map(k => allowed[k])
  params.push(id)

  await query(`UPDATE users SET ${sets}, updated_at = NOW() WHERE id = ?`, params)
  const updated = await findUserById(id)
  const { password: _pp, ...safe } = updated || {}
  return safe
}
