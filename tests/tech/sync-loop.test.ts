import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'

vi.mock('@/app/(app)/jobs/actions', () => ({
  transitionJobStatusAction: vi.fn(),
}))

import { transitionJobStatusAction } from '@/app/(app)/jobs/actions'

describe('flushOutbox', () => {
  const orgId = 'org_test'
  const userId = 'user_test'
  let db: ReturnType<typeof createTechDb>

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await db.delete()
  })

  it('coalesces same-job status updates to the latest and processes FIFO', async () => {
    const mocked = vi.mocked(transitionJobStatusAction)
    mocked.mockResolvedValue({ success: true })

    await enqueueOutboxItem(orgId, {
      type: 'job_status_update',
      payload: { jobId: 'job-A', toStatus: 'scheduled' },
    })
    await enqueueOutboxItem(orgId, {
      type: 'job_status_update',
      payload: { jobId: 'job-A', toStatus: 'dispatched' },
    })
    await enqueueOutboxItem(orgId, {
      type: 'job_status_update',
      payload: { jobId: 'job-A', toStatus: 'on_site' },
    })
    await enqueueOutboxItem(orgId, {
      type: 'job_status_update',
      payload: { jobId: 'job-B', toStatus: 'scheduled' },
    })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledTimes(2)
    expect(mocked).toHaveBeenCalledWith('job-A', 'on_site')
    expect(mocked).toHaveBeenCalledWith('job-B', 'scheduled')

    const remaining = await db.outbox.where('syncStatus').equals('pending').count()
    expect(remaining).toBe(0)
    const all = await db.outbox.toArray()
    expect(all.every((item) => item.syncStatus === 'synced')).toBe(true)
  })

  it('marks failed and increments retryCount on error', async () => {
    const mocked = vi.mocked(transitionJobStatusAction)
    mocked.mockResolvedValue({ error: 'Illegal transition' })

    await enqueueOutboxItem(orgId, {
      type: 'job_status_update',
      payload: { jobId: 'job-C', toStatus: 'invoiced' },
    })
    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledTimes(1)
    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]?.syncStatus).toBe('failed')
    expect(items[0]?.retryCount).toBe(1)
    expect(items[0]?.error).toContain('Illegal transition')
  })

  it('reports pending count accurately', async () => {
    const mocked = vi.mocked(transitionJobStatusAction)
    mocked.mockResolvedValue({ success: true })

    await enqueueOutboxItem(orgId, {
      type: 'job_status_update',
      payload: { jobId: 'job-D', toStatus: 'on_site' },
    })
    let pending = await db.outbox.where('syncStatus').equals('pending').count()
    expect(pending).toBe(1)

    await flushOutbox(orgId, userId)
    pending = await db.outbox.where('syncStatus').equals('pending').count()
    expect(pending).toBe(0)
  })
})
