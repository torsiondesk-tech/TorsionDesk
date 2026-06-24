/**
 * EST-07 — countEstimatesByStatus groups by status and returns zero counts for
 * statuses with no estimates (RED until src/app/(app)/estimates/actions.ts exports it).
 *
 * Contract:
 *   1. Returns { status: string; count: number }[] grouped by status.
 *   2. Includes all estimate statuses with a count of 0 when there are no matching rows.
 *   3. Counts are tenant-scoped.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_dash_a'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_dash' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

const ALL_STATUSES = [
  'estimate_requested',
  'estimate_provided',
  'estimate_accepted',
  'estimate_won',
  'estimate_lost',
]

// Mutable per-tenant status counts.
let tenantCounts = new Map<string, number>([
  ['estimate_requested', 2],
  ['estimate_provided', 1],
  ['estimate_accepted', 0],
  ['estimate_won', 3],
  ['estimate_lost', 0],
])

function resetMocks() {
  tenantCounts = new Map<string, number>([
    ['estimate_requested', 2],
    ['estimate_provided', 1],
    ['estimate_accepted', 0],
    ['estimate_won', 3],
    ['estimate_lost', 0],
  ])
}

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
          groupBy: vi.fn(async () => {
            return Array.from(tenantCounts.entries())
              .filter(([, count]) => count > 0)
              .map(([status, count]) => ({ status, count }))
          }),
        })),
      })),
    })),
  }
}

beforeEach(() => {
  resetMocks()
})

// Not-yet-existing export — RED signal.
import { countEstimatesByStatus } from '@/app/(app)/estimates/actions'

describe('countEstimatesByStatus', () => {
  it('returns counts grouped by status', async () => {
    const result = await countEstimatesByStatus(ORG_A)

    expect(result).toBeDefined()
    expect(result.estimate_requested).toBe(2)
    expect(result.estimate_provided).toBe(1)
    expect(result.estimate_won).toBe(3)
  })

  it('returns zero counts for statuses with no estimates (not missing keys)', async () => {
    const result = await countEstimatesByStatus(ORG_A)

    for (const status of ALL_STATUSES) {
      expect(result).toHaveProperty(status)
    }

    expect(result.estimate_accepted).toBe(0)
    expect(result.estimate_lost).toBe(0)
  })
})
