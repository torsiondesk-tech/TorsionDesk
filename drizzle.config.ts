import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL environment variable is required')
}

/**
 * drizzle-kit config — schema source, dialect, and the DB connection used for
 * `db:generate` (SQL migrations) and `db:push`.
 *
 * Migrations should target the DIRECT connection (:5432), not the transaction
 * pooler — but the same DATABASE_URL is read here; switch to the direct URL when
 * running long migrations in production (RESEARCH Pitfall 3).
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
