import { db } from './client'
import { tenants, communicationTriggers, communicationSettings } from './schema'

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
const TRIGGER_DEFAULTS = [
  { triggerType: 'job_confirmation', channel: 'email', enabled: true },
  { triggerType: 'tech_notify', channel: 'email', enabled: true },
  { triggerType: 'estimate_send', channel: 'email', enabled: true },
  { triggerType: 'estimate_send', channel: 'sms', enabled: false },
  { triggerType: 'invoice_send', channel: 'email', enabled: true },
  { triggerType: 'invoice_send', channel: 'sms', enabled: false },
  { triggerType: 'payment_receipt', channel: 'email', enabled: true },
  { triggerType: 'on_the_way', channel: 'sms', enabled: true },
  { triggerType: 'appointment_reminder', channel: 'sms', enabled: false },
] as const

export async function provisionTenant(
  orgId: string,
): Promise<{ created: boolean }> {
  const inserted = await db
    .insert(tenants)
    .values({ id: orgId })
    .onConflictDoNothing({ target: tenants.id })
    .returning({ id: tenants.id })

  if (inserted.length > 0) {
    await db
      .insert(communicationTriggers)
      .values(TRIGGER_DEFAULTS.map((d) => ({ tenantId: orgId, ...d })))
      .onConflictDoNothing()

    await db
      .insert(communicationSettings)
      .values({ tenantId: orgId })
      .onConflictDoNothing()
  }

  return { created: inserted.length > 0 }
}
