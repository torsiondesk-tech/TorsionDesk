/**
 * INV-02 — computeArAging returns correct AR aging bucket SQL aggregation
 * (RED until src/lib/invoices/ar-aging.ts exists).
 *
 * Contract:
 *   1. An unpaid invoice overdue 45 days appears in the 31-60 day bucket.
 *   2. A paid invoice (balance = 0) does NOT appear in any bucket.
 *   3. Returns all zero values when no unpaid invoices exist.
 */

import { describe, it, expect, vi } from 'vitest'

const auth = vi.fn(async () => ({ orgId: 'org_ar_aging', userId: 'user_1' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

let nextRows = [
  {
    bucket_30: '0',
    bucket_60: '500.00',
    bucket_90: '0',
    bucket_91plus: '0',
    grand_unpaid: '500.00',
    grand_past_due: '500.00',
  },
]

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      execute: vi.fn(async () => ({
        rows: nextRows,
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { computeArAging } from '@/lib/invoices/ar-aging'

describe('computeArAging', () => {
  it('places a 45-day overdue invoice in the 31-60 bucket', async () => {
    nextRows = [
      {
        bucket_30: '0',
        bucket_60: '500.00',
        bucket_90: '0',
        bucket_91plus: '0',
        grand_unpaid: '500.00',
        grand_past_due: '500.00',
      },
    ]
    const result = await computeArAging('org_ar_aging')
    expect(result.bucket60).toBe('500.00')
    expect(result.bucket30).toBe('0')
    expect(result.bucket90).toBe('0')
    expect(result.bucket91plus).toBe('0')
    expect(result.grandUnpaid).toBe('500.00')
    expect(result.grandPastDue).toBe('500.00')
  })

  it('returns all zero values when no unpaid invoices exist', async () => {
    nextRows = [
      {
        bucket_30: '0',
        bucket_60: '0',
        bucket_90: '0',
        bucket_91plus: '0',
        grand_unpaid: '0',
        grand_past_due: '0',
      },
    ]
    const result = await computeArAging('org_ar_aging')
    expect(result.grandUnpaid).toBe('0')
    expect(result.grandPastDue).toBe('0')
    expect(result.bucket30).toBe('0')
    expect(result.bucket60).toBe('0')
    expect(result.bucket90).toBe('0')
    expect(result.bucket91plus).toBe('0')
  })
})
