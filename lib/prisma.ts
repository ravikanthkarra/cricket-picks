import path from 'path'
import { PrismaClient } from '@prisma/client'

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim()

  console.log('[prisma] TURSO_DATABASE_URL defined:', !!tursoUrl)
  console.log('[prisma] TURSO_AUTH_TOKEN defined:', !!tursoToken)
  console.log('[prisma] NODE_ENV:', process.env.NODE_ENV)

  if (tursoUrl) {
    // Production (Turso) — use libsql
    const { PrismaLibSql } = require('@prisma/adapter-libsql')
    const adapter = new PrismaLibSql({ url: tursoUrl, authToken: tursoToken })
    return new PrismaClient({ adapter } as any)
  } else {
    // Local development — use better-sqlite3
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
    const localUrl = process.env.DATABASE_URL || 'file:./dev.db'
    const absolutePath = path.resolve(process.cwd(), localUrl.replace(/^file:/, ''))
    const adapter = new PrismaBetterSqlite3({ url: `file:${absolutePath}` })
    return new PrismaClient({ adapter } as any)
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
