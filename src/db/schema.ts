import { pgTable, text, pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * `tenants` — the root tenancy table.
 *
 * `id` IS the Clerk organization id (`o.id` in the JWT v2 claim, per RESEARCH A4).
 * Clerk org ids are text strings (e.g. `org_...`), NOT UUIDs — hence `text` PK.
 * Using the org id directly as the PK gives a 1:1 mapping to the tenant GUC that
 * `withTenant` sets, so RLS can compare `id` to `app.current_tenant_id` directly.
 *
 * The RLS policy is fail-closed: `current_setting('app.current_tenant_id', true)`
 * returns NULL (not an error) when the GUC is unset, so an unscoped query matches
 * no rows (RESEARCH Pattern 3 / T-00-01).
 */
export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(), // == Clerk org id (o.id)
    companyName: text('company_name'),
    phone: text('phone'),
    address: text('address'),
    email: text('email'),
    logoUrl: text('logo_url'),
  },
  (t) => [
    pgPolicy('tenant_self_isolation', {
      for: 'all',
      to: 'authenticated',
      using: sql`${t.id} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${t.id} = current_setting('app.current_tenant_id', true)`,
    }),
  ],
).enableRLS()

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
