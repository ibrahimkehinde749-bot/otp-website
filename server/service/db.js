import 'dotenv/config'
import mysql from 'mysql2/promise'

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_NAME = 'railway',
  DB_USER = 'root',
  DB_PASSWORD = 'RYBVYPLfeIHbHplzlYIPCcHPiIvtcKCQ',
  DB_CONNECTION_LIMIT = '10',
} = process.env

console.log('[DB] connection configuration:')
console.log(`  DB_HOST=${DB_HOST}`)
console.log(`  DB_PORT=${DB_PORT}`)
console.log(`  DB_NAME=${DB_NAME}`)
console.log(`  DB_USER=${DB_USER}`)
console.log(`  DB_CONNECTION_LIMIT=${DB_CONNECTION_LIMIT}`)

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
  const [rows] = await pool.execute(sql, params)
  return rows
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
