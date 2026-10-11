import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { catalogSchema } from './schema'

const globalForPg = globalThis as typeof globalThis & { nirbhorPool?: Pool }

function getDatabaseConnectionString() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return connectionString

  const url = new URL(connectionString)
  const sslMode = url.searchParams.get('sslmode')?.toLowerCase()

  if (sslMode === 'prefer' || sslMode === 'require' || sslMode === 'verify-ca') {
    url.searchParams.set('sslmode', 'verify-full')
  }

  return url.toString()
}

export const pool =
  globalForPg.nirbhorPool ??
  new Pool({
    connectionString: getDatabaseConnectionString(),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPg.nirbhorPool = pool
}

export const db = drizzle(pool, { schema: catalogSchema })
