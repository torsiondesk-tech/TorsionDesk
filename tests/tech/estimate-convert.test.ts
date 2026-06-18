import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'

vi.mock('@/app/(tech)/tech/estimates/actions', () => ({
  createEstimateAction: vi.fn(),
  convertEstimateToJobAction: vi.fn(),
  listTechEstimatesAction: vi.fn(),
}))

import { convertEstimateToJobAction } from '@/app/(tech)/tech/estimates/actions'

const orgId = 'org_convert'
const userId = 'user_convert'

describe('estimate_conversion outbox sync', () => {
  let db: ReturnType<typeof createTechDb>

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('calls convertEstimateToJobAction and marks synced on success', async () => {
    const mocked = vi.mocked(convertEstimateToJobAction)
    mocked.mockResolvedValue({ success: true, jobId: 'job-1' })

    await enqueueOutboxItem(orgId, {
      type: 'estimate_conversion',
      payload: { estimateId: 'est-1' },
    })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledWith('est-1')

    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]?.syncStatus).toBe('synced')
  })

  it('keeps the item pending when Phase 6 reports not available yet', async () => {
    const mocked = vi.mocked(convertEstimateToJobAction)
    mocked.mockResolvedValue({ success: false, error: 'Estimates are not available yet.' })

    await enqueueOutboxItem(orgId, {
      type: 'estimate_conversion',
      payload: { estimateId: 'est-2' },
    })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledWith('est-2')

    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]?.syncStatus).toBe('pending')
    expect(items[0]?.retryCount).toBe(0)
  })
})