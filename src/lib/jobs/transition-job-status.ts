import { auth } from '@clerk/nextjs/server'
import { eq, and } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import { jobs, jobStatusHistory, customerEvents } from '@/db/schema'
import { ALLOWED_TRANSITIONS, isLegalTransition, dispatchSideEffects, statusLabel } from './transitions'
import type { JobStatusValue } from './transitions'

/**
 * The single server write path for `jobs.status`.
 *
 * D-01: Status is writable ONLY here. All UI paths (job form, dispatch popup,
 * tech PWA) must call this function.
 *
 * Steps:
 * 1. Fetch the job scoped to the tenant.
 * 2. Validate the transition against ALLOWED_TRANSITIONS.
 * 3. Update `jobs.status`.
 * 4. Insert a `job_status_history` row.
 * 5. Insert a `customer_events` row (kind='job').
 * 6. Dispatch named side-effect stubs.
 *
 * All writes are wrapped in one `withTenant` transaction.
 */
export async function transitionJobStatus(
  jobId: string,
  toStatus: string,
  userId: string,
): Promise<void> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('Unauthorized')

  // V5: validate toStatus is a known enum member before the map lookup
  const validStatuses = Object.keys(ALLOWED_TRANSITIONS) as string[]
  if (!validStatuses.includes(toStatus)) {
    throw new Error(`Illegal transition: unknown → ${toStatus}`)
  }

  return withTenant(orgId, async (tx) => {
    // 1. Select current status and customerId (tenant isolation via withTenant GUC + explicit eq)
    const rows = await tx
      .select({ status: jobs.status, customerId: jobs.customerId })
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
      .limit(1)

    if (rows.length === 0) {
      throw new Error('Job not found')
    }

    const job = rows[0]
    const from = job.status

    // 2. Validate transition
    if (!isLegalTransition(from, toStatus)) {
      throw new Error(`Illegal transition: ${from} → ${toStatus}`)
    }

    // 3. Update job status
    await tx
      .update(jobs)
      .set({ status: toStatus as JobStatusValue, updatedAt: new Date() })
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))

    // 4. Record history
    await tx.insert(jobStatusHistory).values({
      tenantId: orgId,
      jobId,
      fromStatus: from,
      toStatus: toStatus as JobStatusValue,
      changedBy: userId,
    })

    // 5. Co-located customer activity event (D-17/18)
    await tx.insert(customerEvents).values({
      tenantId: orgId,
      customerId: job.customerId,
      kind: 'job',
      title: `Status: ${statusLabel(from)} → ${statusLabel(toStatus)}`,
      refId: jobId,
    })

    // 6. Dispatch side effects (named stubs)
    await dispatchSideEffects(from, toStatus as JobStatusValue, jobId)
  })
}
