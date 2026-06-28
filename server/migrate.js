import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query, pool } from './service/db.js'

const __filename = fileURLToPath(import.meta.url)

const {
  DB_HOST,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
} = process.env

const missingEnv = []
if (!DB_HOST) missingEnv.push('DB_HOST')
if (!DB_NAME) missingEnv.push('DB_NAME')
if (!DB_USER) missingEnv.push('DB_USER')
if (!DB_PASSWORD) missingEnv.push('DB_PASSWORD')

if (missingEnv.length > 0) {
  throw new Error(
    `[DB] Missing required environment variables for migration: ${missingEnv.join(', ')}. ` +
    'Please set DB_HOST and DB_PASSWORD before running migrations.'
  )
}

const migrationsDir = path.resolve(process.cwd(), 'migrations')

export async function runMigrations({ closePoolAfter = false } = {}) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`)
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    console.log('No migrations found.')
    return
  }

  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    const sql = fs.readFileSync(filePath, 'utf8')
    console.log(`Applying migration: ${file}`)
    try {
      await query(sql)
      console.log(`Applied: ${file}`)
    } catch (err) {
      console.error(`Migration error in ${file}:`)
      console.error('--- SQL START ---')
      console.error(sql)
      console.error('--- SQL END ---')
      console.error('Error object:', err)
      const msg = err?.message || ''
      if (err && (err.code === 'ER_TABLE_EXISTS_ERROR' || /already exists/i.test(msg))) {
        console.log(`Skipping ${file} — already exists.`)
        continue
      }
      throw err
    }
  }

  console.log('All migrations completed successfully.')

  if (closePoolAfter) {
    await pool.end()
  }
}

async function main() {
  try {
    await runMigrations({ closePoolAfter: true })
    process.exit(0)
  } catch (err) {
    console.error('Migration failed:', err)
    console.error(err.message)
    console.error(err.stack)
    try {
      await pool.end()
    } catch (closeErr) {
      console.error('Failed to close DB pool after migration error:', closeErr)
    }
    process.exit(1)
  }
}

if (process.argv[1] === __filename) {
  main()
}
