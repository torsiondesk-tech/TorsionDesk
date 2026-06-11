import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * postgres-js Drizzle client for Supabase.
 *
 * `prepare: false` is REQUIRED for the Supabase transaction pooler (PgBouncer,
 * port 6543) — prepared statements are not supported there and would surface as
 * "prepared statement already exists" in production (RESEARCH Pitfall 3 / T-00-05).
 *
 * Use the transaction pooler (:6543) for serverless (Vercel); the direct
 * connection (:5432) is only for long-running migrations.
 */
const connectionString = process.env.DATABASE_URL!

// A single shared postgres-js client. In serverless the module is reused per
// warm invocation; postgres-js manages its own pool.
const client = postgres(connectionString, { prepare: false })

export const db = drizzle({ client, schema })

export type Database = typeof db
