import fs from 'fs'
import path from 'path'
import { query } from './service/db.js'

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
    await query(sql)
    console.log(`Applied: ${file}`)
  }

  console.log('All migrations completed successfully.')
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
