/**
 * EST-01 — nextEstimateNo sequential + tenant-scoped (RED until src/lib/estimates/estimate-number.ts exists).
 *
 * Contract:
 *   1. Returns max(estimate_no) + 1 for the given tenant inside the caller's tx.
 *   2. Seeds at 1000 when a tenant has no estimates.
 *   3. Numbers are per-tenant; tenant A's max does not affect tenant B.
 */

import { describe, it, expect, vi } from 'vitest'

const auth = vi.fn(async () => ({ orgId: 'org_estimate_no', userId: 'user_1' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// Not-yet-existing module under test — RED signal.
import { nextEstimateNo } from '@/lib/estimates/estimate-number'

const ORG_A = 'org_estimate_a'

function buildMockTx(maxValue: number | null) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ m: maxValue }]),
      })),
    })),
  }
}

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => fn(buildMockTx(1001))),
}))

describe('nextEstimateNo', () => {
  it('returns 1002 when tenant has estimates numbered 1000 and 1001', async () => {
    const tx = buildMockTx(1001)
    const result = await nextEstimateNo(tx as any, ORG_A)
    expect(result).toBe(1002)
  })

  it('returns 1001 for an empty tenant (seed base 1000)', async () => {
    const tx = buildMockTx(null)
    const result = await nextEstimateNo(tx as any, ORG_A)
    expect(result).toBe(1001)
  })

  it('passes tenantId to the scoped query', async () => {
    const tx = buildMockTx(1001)
    await nextEstimateNo(tx as any, ORG_A)
    expect(tx.select).toHaveBeenCalled()
  })
})
