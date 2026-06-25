/**
 * INV-05 — recordPaymentAction writes payment row, allocations, and audit trail
 * (RED until src/app/(app)/payments/actions.ts exports it).
 *
 * Contract:
 *   1. Successful call inserts 1 payments row and N payment_allocations rows.
 *   2. enteredAt and enteredByUserId are set from auth().
 *   3. paymentNo is sequential per tenant.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_record_payment'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_record' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const paymentRows: Array<{
  id: string
  tenantId: string
  paymentNo: number
  customerId: string
  method: string
  amount: string
  enteredByUserId: string | null
  enteredAt: string | null
}> = []
const allocationRows: Array<{
  tenantId: string
  paymentId: string
  invoiceId: string
  amountApplied: string
}> = []

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
                // invoice bulk fetch — return invoices owned by cust_1 with ample balance
                return [
                  { id: 'inv_1', customerId: 'cust_1', total: '1000.00' },
                  { id: 'inv_2', customerId: 'cust_1', total: '1000.00' },
                ]
              }
              // alloc SUM query — no existing allocations
              return [{ sum: '0' }]
            }),
          })),
        }
      }),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => ({
          returning: vi.fn(async () => {
            const rows = Array.isArray(vals) ? vals : [vals]
            if (rows[0]?.paymentNo != null || rows[0]?.amount != null) {
              const created = rows.map((r: any, i: number) => {
                const id = `pay_${paymentRows.length + i}`
                paymentRows.push({ ...r, id, tenantId: ORG_A })
                return { id, paymentNo: r.paymentNo }
              })
              return created
            }
            for (const r of rows) {
              allocationRows.push({ ...r, tenantId: ORG_A })
            }
            return rows.map((r: any, i: number) => ({ id: `pa_${allocationRows.length - rows.length + i}`, ...r }))
          }),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing export — RED signal.
import { recordPaymentAction } from '@/app/(app)/payments/actions'

describe('recordPaymentAction', () => {
  it('inserts payment row and allocation rows', async () => {
    const before = paymentRows.length
    const result = await recordPaymentAction(ORG_A, {
      customerId: 'cust_1',
      methodId: 'check',
      amount: '250.00',
      checkRefNo: '1234',
      allocations: [
        { invoiceId: 'inv_1', amountApplied: '200.00' },
        { invoiceId: 'inv_2', amountApplied: '50.00' },
      ],
    })
    expect(result.error).toBeUndefined()
    expect(paymentRows.length).toBe(before + 1)

    const allocations = allocationRows.filter(
      (a) => a.paymentId === result.paymentId,
    )
    expect(allocations).toHaveLength(2)
  })

  it('uses sequential per-tenant paymentNo', async () => {
    const result = await recordPaymentAction(ORG_A, {
      customerId: 'cust_1',
      methodId: 'cash',
      amount: '100.00',
      allocations: [],
    })
    expect(result.paymentNo).toBe(1001)
  })
})
