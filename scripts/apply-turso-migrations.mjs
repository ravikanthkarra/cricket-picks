import { createClient } from '@libsql/client'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN')
  process.exit(1)
}

const client = createClient({ url, authToken })

// Create migrations tracking table
await client.execute(`
  CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    finished_at DATETIME,
    migration_name TEXT NOT NULL,
    logs TEXT,
    rolled_back_at DATETIME,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    applied_steps_count INTEGER DEFAULT 0
  )
`)

const migrationsDir = join(process.cwd(), 'prisma/migrations')
const folders = readdirSync(migrationsDir)
  .filter(f => !f.endsWith('.toml'))
  .sort()

for (const folder of folders) {
  const sqlPath = join(migrationsDir, folder, 'migration.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  // Check if already applied
  const existing = await client.execute({
    sql: 'SELECT id FROM _prisma_migrations WHERE migration_name = ?',
    args: [folder],
  })
  if (existing.rows.length > 0) {
    console.log(`  skipping ${folder} (already applied)`)
    continue
  }

  console.log(`  applying ${folder}...`)
  // Split on semicolons and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const stmt of statements) {
    await client.execute(stmt)
  }

  await client.execute({
    sql: `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
          VALUES (?, ?, ?, datetime('now'), 1)`,
    args: [crypto.randomUUID(), folder, folder],
  })
  console.log(`  ✓ ${folder}`)
}

console.log('\nAll migrations applied.')
client.close()
