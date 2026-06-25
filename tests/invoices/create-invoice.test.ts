/**
 * INV-01 — createInvoiceFromJobAction copies job line items to the invoice and
 * transitions the job to 'invoiced' (RED until
 * src/app/(app)/invoices/actions.ts exports it).
 *
 * Contract:
 *   1. Calling with a completed job copies job_line_items rows to invoice_line_items,
 *      inserts an invoices row, and transitions the job status to 'invoiced'.
 *   2. Writes 1 customer_events row with kind='invoice'.
 *   3. Throws/errors when job status is not 'completed' or 'partially_completed'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTableName } from 'drizzle-orm'

const ORG_A = 'org_invoice_create'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_create' }))
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
    contactId: string | null
    serviceLocationId: string | null
    status: string
    description: string | null
  }
>()
const lineItemStore: Array<{
  id: string
  tenantId: string
  jobId: string | null
  invoiceId: string | null
  type: string
  title: string | null
  qty: string | null
  rate: string | null
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
const eventStore: Array<{
  tenantId: string
  customerId: string
  kind: string
  title: string | null
  refId: string | null
}> = []

let currentJobId: string | null = 'job_completed'
let nextInvoiceNo = 1001

function resetMocks() {
  jobStore.clear()
  lineItemStore.length = 0
  invoiceStore.clear()
  eventStore.length = 0
  currentJobId = 'job_completed'
  nextInvoiceNo = 1001

  jobStore.set('job_completed', {
    tenantId: ORG_A,
    jobNo: 200,
    customerId: 'cust_1',
    contactId: 'contact_1',
    serviceLocationId: 'loc_1',
    status: 'completed',
    description: 'Spring replacement',
  })

  jobStore.set('job_unscheduled', {
    tenantId: ORG_A,
    jobNo: 201,
    customerId: 'cust_1',
    contactId: null,
    serviceLocationId: null,
    status: 'unscheduled',
    description: 'Panel replacement',
  })

  lineItemStore.push(
    {
      id: 'li_1',
      tenantId: ORG_A,
      jobId: 'job_completed',
      invoiceId: null,
      type: 'product',
      title: 'Spring',
      qty: '2',
      rate: '50.00',
    },
    {
      id: 'li_2',
      tenantId: ORG_A,
      jobId: 'job_completed',
      invoiceId: null,
      type: 'service',
      title: 'Labor',
      qty: '1',
      rate: '75.00',
    },
  )
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
      then: vi.fn(async (onFulfilled?: (value: unknown[]) => unknown) => {
        if (tableName === 'jobs') {
          const job = currentJobId ? jobStore.get(currentJobId) : undefined
          return onFulfilled ? onFulfilled(job ? [job] : []) : [job]
        }
        if (tableName === 'job_line_items') {
          return onFulfilled
            ? onFulfilled(lineItemStore.filter((li) => li.jobId === currentJobId))
            : lineItemStore.filter((li) => li.jobId === currentJobId)
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
            const id = 'inv_new_1'
            invoiceStore.set(id, {
              ...row,
              tenantId: ORG_A,
              invoiceNo: row.invoiceNo ?? nextInvoiceNo,
            })
            return [{ id, invoiceNo: row.invoiceNo ?? nextInvoiceNo }]
          }
          if (tableName === 'invoice_line_items') {
            const rows = Array.isArray(vals) ? vals : [vals]
            for (const r of rows) {
              lineItemStore.push({ ...r, id: `li_${lineItemStore.length}` })
            }
            return rows.map((r: any, i: number) => ({ id: `li_${lineItemStore.length - rows.length + i}`, ...r }))
          }
          if (tableName === 'customer_events') {
            const rows = Array.isArray(vals) ? vals : [vals]
            for (const r of rows) {
              eventStore.push({ ...r, tenantId: ORG_A })
            }
            return rows.map((r: any, i: number) => ({ id: `ev_${i}`, ...r }))
          }
          return []
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          if (currentJobId) {
            const job = jobStore.get(currentJobId)
            if (job) jobStore.set(currentJobId, { ...job, status: 'invoiced' })
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
import { createInvoiceFromJobAction } from '@/app/(app)/invoices/actions'

describe('createInvoiceFromJobAction', () => {
  it('copies line items, inserts invoice row, and transitions job to invoiced', async () => {
    const result = await createInvoiceFromJobAction(ORG_A, 'job_completed')

    expect(result.invoiceId).toBeDefined()
    expect(invoiceStore.has(result.invoiceId!)).toBe(true)

    const invoice = invoiceStore.get(result.invoiceId!)!
    expect(invoice.total).toBe('175.00')

    const copiedItems = lineItemStore.filter(
      (li) => li.invoiceId === result.invoiceId,
    )
    expect(copiedItems).toHaveLength(2)

    const job = jobStore.get('job_completed')!
    expect(job.status).toBe('invoiced')

    expect(eventStore).toHaveLength(1)
    expect(eventStore[0].kind).toBe('invoice')
  })

  it('errors when job status is not completed or partially_completed', async () => {
    currentJobId = 'job_unscheduled'
    const result = await createInvoiceFromJobAction(ORG_A, 'job_unscheduled')
    expect(result.error).toBeDefined()
  })
})
