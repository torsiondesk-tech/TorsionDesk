/**
 * INV-04 — recordPaymentAction over-application guard rejects allocations
 * totaling more than the payment amount (RED until
 * src/app/(app)/payments/actions.ts exports it).
 *
 * Contract:
 *   1. Allocations totaling $600 against payment amount $500 returns error
 *      "Total to Be Applied can't exceed the Amount of Payment."
 *   2. Allocations totaling $500 against $500 succeeds (boundary).
 *   3. Allocations totaling $499 against $500 succeeds.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_payment_alloc'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_pay' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ m: 1000 }]),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: 'pay_1', paymentNo: 1001 }]),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing export — RED signal.
import { recordPaymentAction } from '@/app/(app)/payments/actions'

describe('recordPaymentAction over-application guard', () => {
  it('rejects allocations totaling more than payment amount', async () => {
    const result = await recordPaymentAction(ORG_A, {
      customerId: 'cust_1',
      methodId: 'cash',
      amount: '500.00',
      allocations: [
        { invoiceId: 'inv_1', amountApplied: '300.00' },
        { invoiceId: 'inv_2', amountApplied: '300.00' },
      ],
    })
    expect(result.error).toBe("Total to Be Applied can't exceed the Amount of Payment.")
  })

  it('accepts allocations exactly equal to payment amount', async () => {
    const result = await recordPaymentAction(ORG_A, {
      customerId: 'cust_1',
      methodId: 'cash',
      amount: '500.00',
      allocations: [
        { invoiceId: 'inv_1', amountApplied: '250.00' },
        { invoiceId: 'inv_2', amountApplied: '250.00' },
      ],
    })
    expect(result.error).toBeUndefined()
  })

  it('accepts allocations less than payment amount', async () => {
    const result = await recordPaymentAction(ORG_A, {
      customerId: 'cust_1',
      methodId: 'cash',
      amount: '500.00',
      allocations: [{ invoiceId: 'inv_1', amountApplied: '499.00' }],
    })
    expect(result.error).toBeUndefined()
  })
})
