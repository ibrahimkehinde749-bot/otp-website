import 'dotenv/config'
import mysql from 'mysql2/promise'

const {
  DB_HOST,
  DB_PORT = '3306',
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_CONNECTION_LIMIT = '10',
} = process.env

console.log('[DB] connection configuration:')
console.log(`  DB_HOST=${DB_HOST || '<not set>'}`)
console.log(`  DB_PORT=${DB_PORT}`)
console.log(`  DB_NAME=${DB_NAME}`)
console.log(`  DB_USER=${DB_USER}`)
console.log(`  DB_CONNECTION_LIMIT=${DB_CONNECTION_LIMIT}`)

const missingEnv = []
if (!DB_HOST) {
  missingEnv.push('DB_HOST')
}
if (!DB_NAME) {
  missingEnv.push('DB_NAME')
}
if (!DB_USER) {
  missingEnv.push('DB_USER')
}
if (!DB_PASSWORD) {
  missingEnv.push('DB_PASSWORD')
}

if (missingEnv.length > 0) {
  throw new Error(
    `[DB] Missing required environment variables: ${missingEnv.join(', ')}. ` +
    'Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD before starting the application.'
  )
}

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(DB_CONNECTION_LIMIT),
  queueLimit: 0,
  decimalNumbers: true,
})

export async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params)
    return rows
  } catch (err) {
    const hostInfo = `${DB_HOST}:${DB_PORT}`
    let message = err.message || 'Unknown database error.'

    if (err.code === 'ENOTFOUND') {
      message = `[DB] Could not resolve DB_HOST '${DB_HOST}'. ` +
        'Verify that the database host is correct and reachable from this environment. ' +
        message
    } else if (err.code === 'ECONNREFUSED') {
      message = `[DB] Connection refused to ${hostInfo}. ` +
        'Ensure the database is running and accessible from this host. ' +
        message
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      message = `[DB] Access denied for DB_USER='${DB_USER}'. ` +
        'Check DB_USER and DB_PASSWORD values. ' +
        message
    }

    const wrapped = new Error(message)
    wrapped.code = err.code
    wrapped.originalError = err
    throw wrapped
  }
}

export async function transaction(callback) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await callback(conn)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}
