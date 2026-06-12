/**
 * CUST-01 — per-tenant account number assignment (RED until src/lib/account-number.ts exists).
 *
 * Contract: nextAccountNo(tx, tenantId) returns (max(account_no for tenant) ?? 1000) + 1.
 * With no existing rows → 1001. With max 1042 → 1043.
 * Tenant-scoped: a different tenantId reading its own max is independent.
 */

// Mock Clerk auth() — not used directly by nextAccountNo, but imported modules may reference it.
const auth = vi.fn(async () => ({ orgId: 'org_aaaa' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// Not-yet-existing module under test — RED signal.
import { nextAccountNo } from '@/lib/account-number'
import { describe, it, expect, vi } from 'vitest'

function makeFakeTx(maxValue: number | null) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ m: maxValue }]),
      })),
    })),
  } as unknown as Parameters<typeof nextAccountNo>[0]
}

describe('nextAccountNo', () => {
  it('returns 1001 when no rows exist for the tenant', async () => {
    const tx = makeFakeTx(null)
    const result = await nextAccountNo(tx, 'org_aaaa')
    expect(result).toBe(1001)
  })

  it('returns 1043 when max is 1042', async () => {
    const tx = makeFakeTx(1042)
    const result = await nextAccountNo(tx, 'org_aaaa')
    expect(result).toBe(1043)
  })

  it('is independent per tenant', async () => {
    const txA = makeFakeTx(2000)
    const txB = makeFakeTx(500)

    const resultA = await nextAccountNo(txA, 'org_aaaa')
    const resultB = await nextAccountNo(txB, 'org_bbbb')

    expect(resultA).toBe(2001)
    expect(resultB).toBe(501)
  })
})
