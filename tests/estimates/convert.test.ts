/**
 * EST-05 — convertEstimateToJobAction creates a job, advances status to won,
 * and writes 2 customer_events (RED until src/app/(app)/estimates/actions.ts exports it).
 *
 * Contract:
 *   1. Calling with a non-Lost estimate creates a job row.
 *   2. Sets estimate status to estimate_won.
 *   3. Writes exactly 2 customer_events rows:
 *      - "Estimate #EST-{N} moved to Won"
 *      - "Estimate #EST-{N} converted to Job #JOB-{M}"
 *   4. Returns { jobId: string }.
 *   5. Throws when estimate status is estimate_lost.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTableName } from 'drizzle-orm'

const ORG_A = 'org_convert_a'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_convert' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// Mutable estimate store so tests can seed records.
const estimateStore = new Map<
  string,
  {
    tenantId: string
    estimateNo: number
    customerId: string
    status: string
    description: string | null
    poNumber: string | null
    serviceLocationId: string | null
    contactId: string | null
    notesForTechs: string | null
  }
>()

const jobStore = new Map<string, { tenantId: string; jobNo: number; estimateId: string | null }>()
const eventStore: Array<{
  tenantId: string
  customerId: string
  kind: string
  title: string
  refId: string
  actor: string | null
}> = []

let nextJobNo = 3000
let currentEstimateId: string | null = 'est_ok'

function resetMocks() {
  estimateStore.clear()
  jobStore.clear()
  eventStore.length = 0
  nextJobNo = 3000
  currentEstimateId = 'est_ok'

  estimateStore.set('est_ok', {
    tenantId: ORG_A,
    estimateNo: 42,
    customerId: 'cust_1',
    status: 'estimate_accepted',
    description: 'Spring replacement',
    poNumber: 'PO-123',
    serviceLocationId: 'loc_1',
    contactId: 'contact_1',
    notesForTechs: 'Bring torque wrench',
  })

  estimateStore.set('est_lost', {
    tenantId: ORG_A,
    estimateNo: 43,
    customerId: 'cust_1',
    status: 'estimate_lost',
    description: 'Panel replacement',
    poNumber: null,
    serviceLocationId: null,
    contactId: null,
    notesForTechs: null,
  })
}

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = buildMockTx()
    return fn(tx)
  }),
}))

function buildMockTx() {
  // Shared query builder so chained calls (where/orderBy/limit/await) all resolve.
  function createQueryBuilder(tableName: string, caller: string) {
    type LimitFn = (n: number) => Promise<unknown[]>
    const limit: LimitFn = async () => {
      if (tableName === 'estimates') {
        const est = currentEstimateId ? estimateStore.get(currentEstimateId) : undefined
        return est ? [est] : []
      }
      if (tableName === 'jobs') {
        return [{ m: null }]
      }
      return []
    }

    const builder: any = {
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(limit),
      then: vi.fn(async (onFulfilled?: (value: unknown[]) => unknown) => {
        const rows = await limit(0)
        return onFulfilled ? onFulfilled(rows) : rows
      }),
    }
    return builder
  }

  return {
    select: vi.fn(() => ({
      from: vi.fn((table: any) => {
        const tableName = getTableName(table)
        return createQueryBuilder(tableName, 'limit')
      }),
    })),
    insert: vi.fn((table: any) => ({
      values: vi.fn((vals: any) => ({
        returning: vi.fn(async () => {
          const tableName = getTableName(table)
          if (tableName === 'jobs') {
            const id = 'job_new_1'
            const jobNo = nextJobNo++
            jobStore.set(id, { ...vals, tenantId: ORG_A, jobNo, estimateId: null })
            return [{ id, jobNo }]
          }
          if (tableName === 'line_item_groups') {
            const rows = Array.isArray(vals) ? vals : [vals]
            return rows.map((r: any, i: number) => ({ id: `group_${i}`, ...r }))
          }
          if (tableName === 'customer_events') {
            const rows = Array.isArray(vals) ? vals : [vals]
            for (const row of rows) {
              eventStore.push({ ...row, tenantId: ORG_A, actor: row.actor ?? 'user_convert' })
            }
            return rows.map((r: any, i: number) => ({ id: `ev_${i}` }))
          }
          return []
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          if (currentEstimateId) {
            const est = estimateStore.get(currentEstimateId)!
            estimateStore.set(currentEstimateId, { ...est, status: 'estimate_won' })
          }
          return []
        }),
      })),
    })),
  }
}

beforeEach(() => {
  resetMocks()
})

// Not-yet-existing export — RED signal.
import { convertEstimateToJobAction } from '@/app/(app)/estimates/actions'

describe('convertEstimateToJobAction', () => {
  it('creates a job row, sets status to won, writes 2 customer_events, and returns jobId', async () => {
    const result = await convertEstimateToJobAction(ORG_A, 'est_ok')

    expect(result.jobId).toBeDefined()
    expect(jobStore.has(result.jobId!)).toBe(true)

    const est = estimateStore.get('est_ok')!
    expect(est.status).toBe('estimate_won')

    expect(eventStore).toHaveLength(2)
    const titles = eventStore.map((e) => e.title)
    expect(titles).toContain('Estimate #EST-42 moved to Won')
    expect(titles.some((t) => /Estimate #EST-42 converted to Job #JOB-/.test(t))).toBe(true)
  })

  it('throws when estimate status is estimate_lost', async () => {
    currentEstimateId = 'est_lost'
    await expect(convertEstimateToJobAction(ORG_A, 'est_lost')).rejects.toThrow(/lost|cannot/i)
  })
})
