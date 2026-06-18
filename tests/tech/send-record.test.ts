import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'

vi.mock('@/app/(tech)/tech/invoices/actions', () => ({
  createInvoiceFromJobAction: vi.fn(),
  sendCustomerCommunicationAction: vi.fn(),
  squarePaymentAction: vi.fn(),
  listTechInvoicesAction: vi.fn(),
}))

import { sendCustomerCommunicationAction } from '@/app/(tech)/tech/invoices/actions'

const orgId = 'org_send'
const userId = 'user_send'

describe('send_record outbox sync', () => {
  let db: ReturnType<typeof createTechDb>

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('calls sendCustomerCommunicationAction with the queued payload and marks synced', async () => {
    const mocked = vi.mocked(sendCustomerCommunicationAction)
    mocked.mockResolvedValue({ success: true })

    await enqueueOutboxItem(orgId, {
      type: 'send_record',
      payload: { kind: 'invoice', refId: 'inv-1', channel: 'email' },
    })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'invoice',
        refId: 'inv-1',
        channel: 'email',
      }),
    )

    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]?.syncStatus).toBe('synced')
  })

  it('keeps the item pending when Phase 8 reports not available yet', async () => {
    const mocked = vi.mocked(sendCustomerCommunicationAction)
    mocked.mockResolvedValue({ success: false, error: 'Sending is not available yet.' })

    await enqueueOutboxItem(orgId, {
      type: 'send_record',
      payload: { kind: 'estimate', refId: 'est-1', channel: 'sms' },
    })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'estimate',
        refId: 'est-1',
        channel: 'sms',
      }),
    )

    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]?.syncStatus).toBe('pending')
    expect(items[0]?.retryCount).toBe(0)
  })
})
