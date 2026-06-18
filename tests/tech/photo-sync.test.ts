import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type PhotoPayload } from '@/app/(tech)/lib/sync'

vi.mock('@/app/(app)/jobs/actions', () => ({
  transitionJobStatusAction: vi.fn(),
  getJobPhotoUploadUrlAction: vi.fn(),
  confirmJobPhotoAction: vi.fn(),
}))

import {
  getJobPhotoUploadUrlAction,
  confirmJobPhotoAction,
} from '@/app/(app)/jobs/actions'

const orgId = 'org_photo'
const userId = 'user_photo'
const jobId = 'job_photo_1'

describe('photo outbox sync', () => {
  let db: ReturnType<typeof createTechDb>

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await db.delete()
  })

  it('uploads a queued photo via signed URL in order and marks synced', async () => {
    const mockedUrl = vi.mocked(getJobPhotoUploadUrlAction)
    mockedUrl.mockResolvedValue({ signedUrl: 'https://signed.example/photo', path: 'org/job/photo.jpg' })

    const mockedConfirm = vi.mocked(confirmJobPhotoAction)
    mockedConfirm.mockResolvedValue({ success: true })

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
    global.fetch = fetchMock

    const blob = new Blob(['pixel data'], { type: 'image/jpeg' })
    await enqueueOutboxItem(orgId, {
      type: 'job_photo',
      payload: { jobId, filename: 'capture.jpg', fileSize: blob.size, blob } as PhotoPayload,
    })

    await flushOutbox(orgId, userId)

    expect(mockedUrl).toHaveBeenCalledWith(jobId, 'capture.jpg', blob.size)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signed.example/photo',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(mockedConfirm).toHaveBeenCalledWith(jobId, 'org/job/photo.jpg')

    const remaining = await db.outbox.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.syncStatus).toBe('synced')
  })

  it('marks failed and skips confirm when the PUT fails', async () => {
    const mockedUrl = vi.mocked(getJobPhotoUploadUrlAction)
    mockedUrl.mockResolvedValue({ signedUrl: 'https://signed.example/photo', path: 'org/job/photo.jpg' })

    const mockedConfirm = vi.mocked(confirmJobPhotoAction)
    mockedConfirm.mockResolvedValue({ success: true })

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' })
    global.fetch = fetchMock

    const blob = new Blob(['pixel data'], { type: 'image/jpeg' })
    await enqueueOutboxItem(orgId, {
      type: 'job_photo',
      payload: { jobId, filename: 'capture.jpg', fileSize: blob.size, blob } as PhotoPayload,
    })

    await flushOutbox(orgId, userId)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockedConfirm).not.toHaveBeenCalled()

    const remaining = await db.outbox.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.syncStatus).toBe('failed')
    expect(remaining[0]?.retryCount).toBe(1)
  })
})
