import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { catalogSchema } from './schema'

const globalForPg = globalThis as typeof globalThis & { nirbhorPool?: Pool }

export const pool =
  globalForPg.nirbhorPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPg.nirbhorPool = pool
}

export const db = drizzle(pool, { schema: catalogSchema })
