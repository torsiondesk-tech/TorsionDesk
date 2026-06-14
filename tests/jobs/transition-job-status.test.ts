/**
 * JOB-03 — transitionJobStatus server action (RED until src/lib/jobs/transition-job-status.ts exists).
 *
 * Contract:
 *   1. Legal transition updates job status + inserts job_status_history row.
 *   2. Illegal transition throws error containing "Illegal transition".
 *   3. Named side-effect dispatcher is called for special transitions (on_the_way).
 *   4. Cross-tenant access throws "Job not found".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_1' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory stores for hermetic assertions
const jobStore = new Map<
  string,
  { tenantId: string; status: string; customerId: string }
>()
const historyStore: Array<{
  tenantId: string
  jobId: string
  fromStatus: string
  toStatus: string
  changedBy: string
}> = []
let dispatchedSideEffects: Array<{
  from: string
  to: string
  jobId: string
}> = []

// Helper to build a chained Drizzle-ish tx that writes to our stores.
function makeFakeTx(orgId: string) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            const job = jobStore.get(`__current__`)
            return job && job.tenantId === orgId ? [{ status: job.status }] : []
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((row: any) => {
        historyStore.push(row)
        return { returning: vi.fn(async () => [row]) }
      }),
    })),
  } as unknown as Parameters<typeof import('@/lib/jobs/transition-job-status').transitionJobStatus>[0] extends {
    jobId: string
  }
    ? never
    : any
}

// We mock withTenant so the real transitionJobStatus can run its logic
// against our in-memory stores.
vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = makeFakeTx(orgId)
    return fn(tx)
  }),
}))

// Mock the transitions module so we can spy on dispatchSideEffects.
vi.mock('@/lib/jobs/transitions', async () => {
  const actual = await vi.importActual('@/lib/jobs/transitions')
  return {
    ...(actual as object),
    dispatchSideEffects: vi.fn(async (_from: string, _to: string, _jobId: string) => {
      dispatchedSideEffects.push({ from: _from, to: _to, jobId: _jobId })
    }),
    isLegalTransition: vi.fn((from: string, to: string) => {
      // Conservative mock: only a few known legal transitions.
      const legal: Record<string, string[]> = {
        unscheduled: ['scheduled'],
        scheduled: ['dispatched'],
        dispatched: ['on_the_way'],
        on_the_way: ['on_site'],
        on_site: ['started'],
        started: ['paused', 'completed'],
        paused: ['resumed'],
        resumed: ['started'],
        completed: ['invoiced'],
        partially_completed: ['completed'],
        invoiced: ['paid_in_full'],
        paid_in_full: ['job_closed'],
        delayed: ['on_the_way'],
        job_closed: [],
        cancelled: [],
      }
      return legal[from]?.includes(to) ?? false
    }),
  }
})

// Not-yet-existing module under test — RED signal.
import {
  transitionJobStatus,
} from '@/lib/jobs/transition-job-status'

describe('transitionJobStatus', () => {
  beforeEach(() => {
    jobStore.clear()
    historyStore.length = 0
    dispatchedSideEffects.length = 0
    auth.mockImplementation(async () => ({ orgId: ORG_A, userId: 'user_1' }))
  })

  it('records a history row for a legal transition', async () => {
    // Seed a job for tenant A
    jobStore.set('job_1', { tenantId: ORG_A, status: 'completed', customerId: 'cust_1' })
    jobStore.set('__current__', { tenantId: ORG_A, status: 'completed', customerId: 'cust_1' })

    await transitionJobStatus('job_1', 'invoiced', 'user_1')

    const history = historyStore.filter((h) => h.jobId === 'job_1')
    expect(history.length).toBeGreaterThanOrEqual(1)
    const row = history[0]
    expect(row).toMatchObject({
      tenantId: ORG_A,
      fromStatus: 'completed',
      toStatus: 'invoiced',
      changedBy: 'user_1',
    })
  })

  it('throws an error containing "Illegal transition" for an illegal target', async () => {
    jobStore.set('job_2', { tenantId: ORG_A, status: 'job_closed', customerId: 'cust_1' })
    jobStore.set('__current__', { tenantId: ORG_A, status: 'job_closed', customerId: 'cust_1' })

    await expect(transitionJobStatus('job_2', 'scheduled', 'user_1')).rejects.toThrow(
      /Illegal transition/i,
    )
  })

  it('throws "Job not found" when the job belongs to a different tenant', async () => {
    jobStore.set('job_3', { tenantId: ORG_B, status: 'completed', customerId: 'cust_1' })
    jobStore.set('__current__', { tenantId: ORG_B, status: 'completed', customerId: 'cust_1' })

    await expect(transitionJobStatus('job_3', 'invoiced', 'user_1')).rejects.toThrow(
      /Job not found/i,
    )
  })

  it('calls dispatchSideEffects for a transition to on_the_way', async () => {
    jobStore.set('job_4', { tenantId: ORG_A, status: 'dispatched', customerId: 'cust_1' })
    jobStore.set('__current__', { tenantId: ORG_A, status: 'dispatched', customerId: 'cust_1' })

    await transitionJobStatus('job_4', 'on_the_way', 'user_1')

    expect(dispatchedSideEffects).toContainEqual({
      from: 'dispatched',
      to: 'on_the_way',
      jobId: 'job_4',
    })
  })
})
