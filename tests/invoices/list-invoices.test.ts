/**
 * INV-03 — listInvoicesAction computes invoice balance from allocations and
 * filters by balance-derived status (RED until
 * src/app/(app)/invoices/actions.ts exports it).
 *
 * Contract:
 *   1. Balance subquery: invoice.total=200, allocations sum=50 → balance='150.00'.
 *   2. balance=0 → status label 'Paid in Full'.
 *   3. balance>0 and dueDate in past → status label 'Past Due'.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_list_invoices'

const auth = vi.fn(async () => ({ orgId: ORG_A, userId: 'user_list' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = buildMockTx()
    return fn(tx)
  }),
}))

function buildMockTx() {
  const rows = [
    {
      id: 'inv_1',
      tenantId: ORG_A,
      invoiceNo: 1001,
      customerId: 'cust_1',
      customerName: 'Alice',
      jobId: 'job_1',
      invoiceDate: '2026-05-01',
      dueDate: '2026-06-01',
      total: '200.00',
      balance: '150.00',
      paymentLinkUrl: null,
      createdAt: '2026-05-01T00:00:00Z',
    },
    {
      id: 'inv_2',
      tenantId: ORG_A,
      invoiceNo: 1002,
      customerId: 'cust_2',
      customerName: 'Bob',
      jobId: 'job_2',
      invoiceDate: '2026-05-15',
      dueDate: '2026-06-15',
      total: '300.00',
      balance: '0.00',
      paymentLinkUrl: null,
      createdAt: '2026-05-15T00:00:00Z',
    },
    {
      id: 'inv_3',
      tenantId: ORG_A,
      invoiceNo: 1003,
      customerId: 'cust_3',
      customerName: 'Carol',
      jobId: 'job_3',
      invoiceDate: '2026-05-20',
      dueDate: '2026-06-01',
      total: '100.00',
      balance: '100.00',
      paymentLinkUrl: null,
      createdAt: '2026-05-20T00:00:00Z',
    },
  ]

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => rows),
          })),
        })),
      })),
    })),
  }
}

// Not-yet-existing export — RED signal.
import { listInvoicesAction } from '@/app/(app)/invoices/actions'

describe('listInvoicesAction', () => {
  it('computes balance from total minus allocations', async () => {
    const result = await listInvoicesAction(ORG_A)
    const inv = result.rows.find((r) => r.id === 'inv_1')
    expect(inv).toBeDefined()
    expect(inv!.balance).toBe('150.00')
  })

  it('labels a zero-balance invoice as Paid in Full', async () => {
    const result = await listInvoicesAction(ORG_A)
    const inv = result.rows.find((r) => r.id === 'inv_2')
    expect(inv).toBeDefined()
    expect(inv!.status).toBe('Paid in Full')
  })

  it('labels an unpaid overdue invoice as Past Due', async () => {
    const result = await listInvoicesAction(ORG_A)
    const inv = result.rows.find((r) => r.id === 'inv_3')
    expect(inv).toBeDefined()
    expect(inv!.status).toBe('Past Due')
  })
})
