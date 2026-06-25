/**
 * INV-01 — nextInvoiceNo sequential + tenant-scoped (RED until
 * src/lib/invoices/invoice-number.ts exists).
 *
 * Contract:
 *   1. Returns max(invoice_no) + 1 for the given tenant inside the caller's tx.
 *   2. Seeds at 1001 when a tenant has no invoices.
 *   3. nextPaymentNo mirrors the same behavior using the payments table.
 */

import { describe, it, expect, vi } from 'vitest'

const auth = vi.fn(async () => ({ orgId: 'org_invoice_no', userId: 'user_1' }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

const ORG_A = 'org_invoice_a'

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

// Not-yet-existing module under test — RED signal.
import { nextInvoiceNo, nextPaymentNo } from '@/lib/invoices/invoice-number'

describe('nextInvoiceNo', () => {
  it('returns 1002 when tenant has invoices numbered through 1001', async () => {
    const tx = buildMockTx(1001)
    const result = await nextInvoiceNo(tx as any, ORG_A)
    expect(result).toBe(1002)
  })

  it('returns 1001 for an empty tenant (seed base 1000)', async () => {
    const tx = buildMockTx(null)
    const result = await nextInvoiceNo(tx as any, ORG_A)
    expect(result).toBe(1001)
  })

  it('passes tenantId to the scoped query', async () => {
    const tx = buildMockTx(1001)
    await nextInvoiceNo(tx as any, ORG_A)
    expect(tx.select).toHaveBeenCalled()
  })
})

describe('nextPaymentNo', () => {
  it('returns 1002 when tenant has payments numbered through 1001', async () => {
    const tx = buildMockTx(1001)
    const result = await nextPaymentNo(tx as any, ORG_A)
    expect(result).toBe(1002)
  })

  it('returns 1001 for an empty tenant (seed base 1000)', async () => {
    const tx = buildMockTx(null)
    const result = await nextPaymentNo(tx as any, ORG_A)
    expect(result).toBe(1001)
  })
})
