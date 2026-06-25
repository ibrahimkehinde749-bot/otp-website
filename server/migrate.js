import fs from 'fs'
import path from 'path'
import { query } from './service/db.js'

const {
  DB_HOST,
  DB_PASSWORD,
} = process.env

const missingEnv = []
if (!DB_HOST) missingEnv.push('DB_HOST')
if (!DB_PASSWORD) missingEnv.push('DB_PASSWORD')

if (missingEnv.length > 0) {
  throw new Error(
    `[DB] Missing required environment variables for migration: ${missingEnv.join(', ')}. ` +
    'Please set DB_HOST and DB_PASSWORD before running migrations.'
  )
}

const migrationsDir = path.resolve(process.cwd(), 'migrations')

async function runMigrations() {
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
      // If table already exists or migration is idempotent, skip
      const msg = (err && err.message) ? err.message : ''
      if (err && (err.code === 'ER_TABLE_EXISTS_ERROR' || /already exists/i.test(msg))) {
        console.log(`Skipping ${file} — already exists.`)
        continue
      }
      throw err
    }
  }

  console.log('All migrations completed successfully.')
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  console.error(err.message)
  console.error(err.stack)
  process.exit(1)
})
