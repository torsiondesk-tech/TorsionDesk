import { sql, max, eq } from 'drizzle-orm'
import type { Tx } from '@/db/with-tenant'
import { jobs } from '@/db/schema'

/**
 * Compute the next per-tenant job number inside the caller's withTenant tx.
 * Must run inside the same transaction as the job insert — never outside.
 * The UNIQUE(tenant_id, job_no) constraint is the backstop for the rare race.
 * Seed base is 1000; Phase 10 reseeds above the max imported SF job number.
 */
export async function nextJobNo(tx: Tx, tenantId: string): Promise<number> {
  const [{ m }] = await tx
    .select({ m: max(jobs.jobNo) })
    .from(jobs)
    .where(eq(jobs.tenantId, tenantId))
  return (m ?? 1000) + 1
}
