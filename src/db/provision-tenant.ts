import { db } from './client'
import { tenants } from './schema'

/**
 * Provision a `tenants` row for a newly created Clerk organization (AUTH-01,
 * D-02).
 *
 * This runs from the verified `organization.created` webhook BEFORE the tenant
 * has any session, so it does NOT go through `withTenant` (there is no tenant GUC
 * to set yet). It executes on the privileged provisioning connection.
 *
 * IDEMPOTENT (T-00-03): Svix delivers webhooks at-least-once and retries, so a
 * replayed `organization.created` for the same org id must NOT create a duplicate.
 * `onConflictDoNothing` on the `id` primary key makes the insert a no-op on replay.
 *
 * @param orgId  The Clerk organization id (`evt.data.id`) — becomes `tenants.id`
 *               and, later, the `o.id` claim / tenant GUC value.
 * @returns `{ created: true }` if a new row was inserted, `{ created: false }` if
 *          the row already existed (replay).
 */
export async function provisionTenant(
  orgId: string,
): Promise<{ created: boolean }> {
  const inserted = await db
    .insert(tenants)
    .values({ id: orgId })
    .onConflictDoNothing({ target: tenants.id })
    .returning({ id: tenants.id })

  return { created: inserted.length > 0 }
}
