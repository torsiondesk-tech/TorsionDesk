/**
 * INV-04 — recordPaymentAction allocation validation:
 *   1. Over-application guard (total allocated > payment amount) → error
 *   2. Boundary: allocations exactly equal payment amount → success
 *   3. Allocations less than payment amount → success
 *   4. Customer mismatch (invoice owned by different customer) → error
 *   5. Over-balance (allocation > invoice total - already applied) → error
 *   6. Invoice not found (invoiceId returns no row) → error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_payment_alloc'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_pay' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

/**
 * Mock withTenant with a call-order dispatcher.
 *
 * Query sequence inside recordPaymentAction when allocations are present:
 *   select call 1 → nextPaymentNo: from payments → [{ m: 1000 }]
 *   select call 2 → invoice fetch: from invoices → mockInvoiceRows
 *   select call 3+ → alloc SUM: from paymentAllocations → mockAllocSumRows
 *
 * Tests that set mockInvoiceRows / mockAllocSumRows exercise the new validation.
 * Tests that hit the pre-transaction guard (totalApplied > amount) never reach
 * the withTenant callback, so those tests pass regardless of mock state.
 */
let mockInvoiceRows: unknown[] = []
let mockAllocSumRows: unknown[] = []

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    let selectCallCount = 0
    const tx = {
      select: vi.fn((_cols?: unknown) => {
        selectCallCount++
        const callNum = selectCallCount
        return {
          from: vi.fn((_table?: unknown) => ({
            where: vi.fn(async (_cond?: unknown) => {
              if (callNum === 1) {
                // nextPaymentNo max query
                return [{ m: 1000 }]
              }
              if (callNum === 2) {
                // invoice bulk fetch
                return mockInvoiceRows
              }
              // alloc SUM queries (one per invoice id in the set)
              return mockAllocSumRows
            }),
          })),
        }
      }),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: 'pay_1', paymentNo: 1001 }]),
        })),
      })),
    }
    return fn(tx)
  }),
}))

import { recordPaymentAction } from '@/app/(app)/payments/actions'

describe('recordPaymentAction over-application guard', () => {
  beforeEach(() => {
    // Default: two invoices owned by cust_1, $1000 total each, $0 already applied
    mockInvoiceRows = [
      { id: 'inv_1', customerId: 'cust_1', total: '1000.00' },
      { id: 'inv_2', customerId: 'cust_1', total: '1000.00' },
    ]
    mockAllocSumRows = [{ sum: '0' }]
  })

  it('rejects allocations totaling more than payment amount', async () => {
    // Pre-transaction guard fires before withTenant — mock state irrelevant here
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

  it('rejects allocation when invoice belongs to a different customer', async () => {
    mockInvoiceRows = [
      { id: 'inv_other', customerId: 'cust_other', total: '500.00' },
    ]
    mockAllocSumRows = [{ sum: '0' }]

    const result = await recordPaymentAction(ORG_A, {
      customerId: 'cust_1',
      methodId: 'cash',
      amount: '300.00',
      allocations: [{ invoiceId: 'inv_other', amountApplied: '300.00' }],
    })
    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/different customer/i)
  })

  it('rejects allocation that exceeds the invoice open balance', async () => {
    mockInvoiceRows = [
      { id: 'inv_1', customerId: 'cust_1', total: '200.00' },
    ]
    mockAllocSumRows = [{ sum: '0' }]

    const result = await recordPaymentAction(ORG_A, {
      customerId: 'cust_1',
      methodId: 'cash',
      amount: '300.00',
      allocations: [{ invoiceId: 'inv_1', amountApplied: '300.00' }],
    })
    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/balance|exceed/i)
  })

  it('rejects allocation when invoiceId is not found', async () => {
    mockInvoiceRows = [] // no rows returned for invoice fetch

    const result = await recordPaymentAction(ORG_A, {
      customerId: 'cust_1',
      methodId: 'cash',
      amount: '300.00',
      allocations: [{ invoiceId: 'inv_missing', amountApplied: '300.00' }],
    })
    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/not found/i)
  })
})
