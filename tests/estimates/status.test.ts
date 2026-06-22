/**
 * EST-02 — updateEstimateStatusAction writes the status change and a single
 * customer_events row (RED until src/app/(app)/estimates/actions.ts exports it).
 *
 * Contract:
 *   1. Updates the estimate status column.
 *   2. Writes exactly 1 customer_events row with kind='estimate'.
 *   3. Event title contains '#EST-{N}' and the new status label.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTableName } from 'drizzle-orm'

const ORG_A = 'org_status_a'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_status' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

const estimateStore = new Map<
  string,
  {
    tenantId: string
    estimateNo: number
    customerId: string
    status: string
  }
>()

const eventStore: Array<{
  tenantId: string
  customerId: string
  kind: string
  title: string
  refId: string
  actor: string | null
}> = []

function resetMocks() {
  estimateStore.clear()
  eventStore.length = 0

  estimateStore.set('est_1', {
    tenantId: ORG_A,
    estimateNo: 42,
    customerId: 'cust_1',
    status: 'estimate_requested',
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
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            const est = estimateStore.get('est_1')
            return est ? [est] : []
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          const est = estimateStore.get('est_1')!
          estimateStore.set('est_1', { ...est, status: 'estimate_provided' })
          return []
        }),
      })),
    })),
    insert: vi.fn((table: any) => ({
      values: vi.fn((vals: any) => ({
        returning: vi.fn(async () => {
          const tableName = getTableName(table)
          if (tableName !== 'customer_events') return []
          const rows = Array.isArray(vals) ? vals : [vals]
          for (const row of rows) {
            eventStore.push({ ...row, tenantId: ORG_A, actor: row.actor ?? 'user_status' })
          }
          return rows.map((_: any, i: number) => ({ id: `ev_${i}` }))
        }),
      })),
    })),
  }
}

beforeEach(() => {
  resetMocks()
})

// Not-yet-existing export — RED signal.
import { updateEstimateStatusAction } from '@/app/(app)/estimates/actions'

describe('updateEstimateStatusAction', () => {
  it('writes exactly 1 customer_events row with kind=estimate and title containing #EST-42', async () => {
    await updateEstimateStatusAction(ORG_A, 'est_1', 'estimate_provided')

    const est = estimateStore.get('est_1')!
    expect(est.status).toBe('estimate_provided')

    expect(eventStore).toHaveLength(1)
    const event = eventStore[0]!
    expect(event.kind).toBe('estimate')
    expect(event.customerId).toBe('cust_1')
    expect(event.title).toContain('#EST-42')
    expect(event.title).toContain('Provided')
    expect(event.refId).toBe('est_1')
  })
})
