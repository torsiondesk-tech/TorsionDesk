import { max, eq } from 'drizzle-orm'
import type { Tx } from '@/db/with-tenant'
import { estimates } from '@/db/schema'

/**
 * Compute the next per-tenant estimate number inside the caller's withTenant tx.
 * Must run inside the same transaction as the estimate insert — never outside.
 * The UNIQUE(tenant_id, estimate_no) constraint is the backstop for the rare race.
 * Seed base is 1000; Phase 10 reseeds above the max imported SF estimate number.
 */
export async function nextEstimateNo(tx: Tx, tenantId: string): Promise<number> {
  const [{ m }] = await tx
    .select({ m: max(estimates.estimateNo) })
    .from(estimates)
    .where(eq(estimates.tenantId, tenantId))
  return (m ?? 1000) + 1
}
