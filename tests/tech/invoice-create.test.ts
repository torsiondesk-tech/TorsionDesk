import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'

vi.mock('@/app/(tech)/tech/invoices/actions', () => ({
  createInvoiceFromJobAction: vi.fn(),
  sendCustomerCommunicationAction: vi.fn(),
  squarePaymentAction: vi.fn(),
  listTechInvoicesAction: vi.fn(),
}))

import { createInvoiceFromJobAction } from '@/app/(tech)/tech/invoices/actions'

const orgId = 'org_invoice'
const userId = 'user_invoice'

describe('invoice_create outbox sync', () => {
  let db: ReturnType<typeof createTechDb>

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('calls createInvoiceFromJobAction and marks synced on success', async () => {
    const mocked = vi.mocked(createInvoiceFromJobAction)
    mocked.mockResolvedValue({ success: true, invoiceId: 'inv-1' })

    await enqueueOutboxItem(orgId, {
      type: 'invoice_create',
      payload: { jobId: 'job-1' },
    })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledWith('job-1')

    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]?.syncStatus).toBe('synced')
  })

  it('keeps the item pending when Phase 7 reports not available yet', async () => {
    const mocked = vi.mocked(createInvoiceFromJobAction)
    mocked.mockResolvedValue({ success: false, error: 'Invoices are not available yet.' })

    await enqueueOutboxItem(orgId, {
      type: 'invoice_create',
      payload: { jobId: 'job-2' },
    })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledWith('job-2')

    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]?.syncStatus).toBe('pending')
    expect(items[0]?.retryCount).toBe(0)
  })
})
