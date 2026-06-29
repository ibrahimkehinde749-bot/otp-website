import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { query, transaction } from './db.js'
import { BadRequestError, ConflictError, UnauthorizedError } from './apiError.js'

const SALT_ROUNDS = 10
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const usersFilePath = path.resolve(__dirname, '../data/users.json')

function useMockAuth() {
  return process.env.USE_MOCK_DATA === 'true'
}

async function loadMockUsers() {
  try {
    const file = await readFile(usersFilePath, 'utf8')
    return JSON.parse(file)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []
    }
    throw err
  }
}

async function saveMockUsers(users) {
  await writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf8')
}

function mapRawUserToUser(row) {
  if (!row) return null
  return {
    id: row.id,
    fullName: row.full_name || row.fullName,
    email: row.email,
    password: row.password,
    phoneNumber: row.phone_number || row.phoneNumber || null,
    registrationDate: row.registration_date || row.registrationDate || null,
    accountStatus: row.account_status || row.accountStatus || 'active',
    role: row.role || 'user',
    walletBalance: Number(row.wallet_balance ?? row.walletBalance ?? 0),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  }
}

async function findMockUserByEmail(email) {
  const users = await loadMockUsers()
  const normalizedEmail = String(email).trim().toLowerCase()
  const found = users.find((user) => String(user.email).trim().toLowerCase() === normalizedEmail)
  return mapRawUserToUser(found)
}

async function findMockUserById(id) {
  const users = await loadMockUsers()
  const found = users.find((user) => user.id === id)
  return mapRawUserToUser(found)
}

async function updateMockUser(id, updates) {
  const users = await loadMockUsers()
  const index = users.findIndex((user) => user.id === id)
  if (index === -1) {
    return null
  }
  const existing = users[index]
  const updated = {
    ...existing,
    ...updates,
    email: updates.email || existing.email,
    fullName: updates.fullName || existing.fullName,
    phoneNumber: updates.phoneNumber || existing.phoneNumber,
    accountStatus: updates.accountStatus || existing.accountStatus,
    password: updates.password || existing.password,
    updatedAt: new Date().toISOString(),
  }
  users[index] = updated
  await saveMockUsers(users)
  return mapRawUserToUser(updated)
}

function createAuthResult(user) {
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' })
  return { token, user }
}

export async function registerUser({ fullName, email, password, phoneNumber }) {
  if (!email || !password || !fullName) throw new BadRequestError('fullName, email and password are required')

  const normalizedEmail = String(email).trim().toLowerCase()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const role = adminEmail && normalizedEmail === adminEmail ? 'admin' : 'user'

  if (useMockAuth()) {
    const existing = await findMockUserByEmail(normalizedEmail)
    if (existing) throw new ConflictError('Email already registered')

    const hashed = await bcrypt.hash(password, SALT_ROUNDS)
    const id = crypto.randomUUID()
    const newUser = {
      id,
      fullName,
      email: normalizedEmail,
      password: hashed,
      phoneNumber: phoneNumber || null,
      registrationDate: new Date().toISOString(),
      accountStatus: 'active',
      role,
      walletBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const users = await loadMockUsers()
    users.push(newUser)
    await saveMockUsers(users)

    const { password: _p, ...safeUser } = mapRawUserToUser(newUser)
    return createAuthResult(safeUser)
  }

  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
  if (existing && existing.length > 0) throw new ConflictError('Email already registered')

  const hashed = await bcrypt.hash(password, SALT_ROUNDS)
  const id = crypto.randomUUID()

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
  if (useMockAuth()) {
    return findMockUserByEmail(email)
  }
  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
  return mapRawUserToUser(rows && rows[0])
}

export async function findUserById(id) {
  if (useMockAuth()) {
    return findMockUserById(id)
  }
  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [id])
  return mapRawUserToUser(rows && rows[0])
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
  if (updates.fullName) allowed.fullName = updates.fullName
  if (updates.phoneNumber) allowed.phoneNumber = updates.phoneNumber
  if (updates.accountStatus) allowed.accountStatus = updates.accountStatus
  if (updates.email) allowed.email = updates.email

  if (updates.password) {
    allowed.password = await bcrypt.hash(updates.password, SALT_ROUNDS)
  }

  if (Object.keys(allowed).length === 0) {
    const user = await findUserById(id)
    const { password: _p, ...safe } = user || {}
    return safe
  }

  if (useMockAuth()) {
    const updated = await updateMockUser(id, allowed)
    const { password: _pp, ...safe } = updated || {}
    return safe
  }

  const sets = Object.keys(allowed).map((k) => {
    const column = k === 'fullName' ? 'full_name' : k === 'phoneNumber' ? 'phone_number' : k === 'accountStatus' ? 'account_status' : k
    return `${column} = ?`
  }).join(', ')

  const params = Object.keys(allowed).map((k) => allowed[k])
  params.push(id)

  await query(`UPDATE users SET ${sets}, updated_at = NOW() WHERE id = ?`, params)
  const updated = await findUserById(id)
  const { password: _pp, ...safe } = updated || {}
  return safe
}
