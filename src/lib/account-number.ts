import { sql, max, eq } from 'drizzle-orm'
import type { Tx } from '@/db/with-tenant'
import { customers } from '@/db/schema'

/**
 * Compute the next per-tenant account number inside the caller's withTenant tx.
 * Must run inside the same transaction as the customer insert — never outside.
 * The UNIQUE(tenant_id, account_no) constraint is the backstop for the rare race.
 */
export async function nextAccountNo(tx: Tx, tenantId: string): Promise<number> {
  const [{ m }] = await tx
    .select({ m: max(customers.accountNo) })
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
  return (m ?? 1000) + 1 // seed base 1000; Phase 10 reseeds above max imported
}
