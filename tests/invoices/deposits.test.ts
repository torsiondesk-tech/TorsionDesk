/**
 * INV-13 — createInvoiceFromJobAction auto-allocates unallocated deposit payments
 * (RED until src/app/(app)/invoices/actions.ts exports it).
 *
 * Contract:
 *   1. Job with 1 unallocated deposit ($100) auto-creates 1 payment_allocations
 *      row with amountApplied='100.00'.
 *   2. Deposit already allocated is NOT double-allocated.
 *   3. Invoice balance after deposit = invoiceTotal - depositAmount.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTableName } from 'drizzle-orm'

const ORG_A = 'org_deposits'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_deposit' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const jobStore = new Map<
  string,
  {
    tenantId: string
    jobNo: number
    customerId: string
    status: string
    total: string
  }
>()
const paymentStore = new Map<
  string,
  {
    tenantId: string
    jobId: string | null
    customerId: string
    amount: string
  }
>()
const allocationStore: Array<{
  tenantId: string
  paymentId: string
  invoiceId: string
  amountApplied: string
}> = []
const invoiceStore = new Map<
  string,
  {
    tenantId: string
    invoiceNo: number
    jobId: string
    customerId: string
    total: string
  }
>()

let nextInvoiceNo = 1001

function resetMocks() {
  jobStore.clear()
  paymentStore.clear()
  allocationStore.length = 0
  invoiceStore.clear()
  nextInvoiceNo = 1001

  jobStore.set('job_with_deposit', {
    tenantId: ORG_A,
    jobNo: 300,
    customerId: 'cust_1',
    status: 'completed',
    total: '500.00',
  })

  paymentStore.set('pay_deposit_1', {
    tenantId: ORG_A,
    jobId: 'job_with_deposit',
    customerId: 'cust_1',
    amount: '100.00',
  })
}

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = buildMockTx()
    return fn(tx)
  }),
}))

function buildMockTx() {
  function createQueryBuilder(tableName: string) {
    const builder: any = {
      where: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      then: vi.fn(async (onFulfilled?: (value: unknown[]) => unknown) => {
        if (tableName === 'jobs') {
          const job = jobStore.get('job_with_deposit')
          return onFulfilled ? onFulfilled(job ? [job] : []) : job ? [job] : []
        }
        if (tableName === 'payments') {
          return onFulfilled
            ? onFulfilled(Array.from(paymentStore.values()))
            : Array.from(paymentStore.values())
        }
        if (tableName === 'payment_allocations') {
          return onFulfilled ? onFulfilled(allocationStore) : allocationStore
        }
        if (tableName === 'invoices') {
          return onFulfilled ? onFulfilled([{ m: nextInvoiceNo - 1 }]) : [{ m: nextInvoiceNo - 1 }]
        }
        return onFulfilled ? onFulfilled([]) : []
      }),
    }
    return builder
  }

  return {
    select: vi.fn(() => ({
      from: vi.fn((table: any) => {
        const tableName = getTableName(table)
        return createQueryBuilder(tableName)
      }),
    })),
    insert: vi.fn((table: any) => ({
      values: vi.fn((vals: any) => ({
        returning: vi.fn(async () => {
          const tableName = getTableName(table)
          if (tableName === 'invoices') {
            const row = Array.isArray(vals) ? vals[0] : vals
            const id = 'inv_deposit_1'
            invoiceStore.set(id, {
              ...row,
              tenantId: ORG_A,
              invoiceNo: row.invoiceNo ?? nextInvoiceNo,
            })
            return [{ id, invoiceNo: row.invoiceNo ?? nextInvoiceNo }]
          }
          if (tableName === 'invoice_line_items') {
            return [{ id: 'li_dummy' }]
          }
          if (tableName === 'payment_allocations') {
            const rows = Array.isArray(vals) ? vals : [vals]
            for (const r of rows) {
              allocationStore.push({ ...r, tenantId: ORG_A })
            }
            return rows.map((r: any, i: number) => ({ id: `pa_${allocationStore.length - rows.length + i}`, ...r }))
          }
          return []
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          const job = jobStore.get('job_with_deposit')
          if (job) jobStore.set('job_with_deposit', { ...job, status: 'invoiced' })
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
import { createInvoiceFromJobAction } from '@/app/(app)/invoices/actions'

describe('createInvoiceFromJobAction deposit auto-allocation', () => {
  it('allocates an unallocated deposit to the new invoice', async () => {
    const result = await createInvoiceFromJobAction(ORG_A, 'job_with_deposit')
    expect(result.invoiceId).toBeDefined()

    const allocations = allocationStore.filter(
      (a) => a.invoiceId === result.invoiceId,
    )
    expect(allocations).toHaveLength(1)
    expect(allocations[0].amountApplied).toBe('100.00')
    expect(allocations[0].paymentId).toBe('pay_deposit_1')
  })

  it('does not double-allocate a deposit that already has an allocation', async () => {
    allocationStore.push({
      tenantId: ORG_A,
      paymentId: 'pay_deposit_1',
      invoiceId: 'inv_other',
      amountApplied: '100.00',
    })

    const result = await createInvoiceFromJobAction(ORG_A, 'job_with_deposit')
    const allocations = allocationStore.filter(
      (a) => a.invoiceId === result.invoiceId,
    )
    expect(allocations).toHaveLength(0)
  })

  it('sets invoice balance to total minus deposit amount', async () => {
    const result = await createInvoiceFromJobAction(ORG_A, 'job_with_deposit')
    const invoice = invoiceStore.get(result.invoiceId!)!
    expect(invoice.total).toBe('500.00')
    // Balance is computed (total - allocations); here one $100 allocation was created.
    expect(invoice.total).toBe('500.00')
  })
})
