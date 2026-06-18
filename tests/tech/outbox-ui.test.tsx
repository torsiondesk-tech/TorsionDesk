import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createTechDb, OUTBOX_TYPES } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem } from '@/app/(tech)/lib/sync'
import { OfflineBadge } from '@/app/(tech)/components/offline-badge'

vi.mock('@/app/(tech)/lib/use-online', () => ({
  useOnline: vi.fn(),
}))

vi.mock('@/app/(tech)/lib/use-tech-data', () => ({
  usePendingCount: vi.fn(),
  useFailedCount: vi.fn(),
}))

import { useOnline } from '@/app/(tech)/lib/use-online'
import { usePendingCount, useFailedCount } from '@/app/(tech)/lib/use-tech-data'

const orgId = 'org_outbox_ui'
const userId = 'user_outbox_ui'

describe('outbox visual flagging (TECH-14)', () => {
  let db: ReturnType<typeof createTechDb>

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('contains all nine queued outbox types and no Square card type', () => {
    expect(OUTBOX_TYPES).toHaveLength(9)
    expect(OUTBOX_TYPES).toContain('invoice_create')
    expect(OUTBOX_TYPES).toContain('send_record')
    expect(OUTBOX_TYPES).toContain('manual_payment')
    expect(OUTBOX_TYPES).not.toContain('square_card_payment')
  })

  it('shows the pending count when items are queued', async () => {
    const mockedOnline = vi.mocked(useOnline)
    mockedOnline.mockReturnValue(true)

    const mockedPending = vi.mocked(usePendingCount)
    const mockedFailed = vi.mocked(useFailedCount)
    mockedFailed.mockReturnValue(0)

    const types = OUTBOX_TYPES.filter(
      (t) =>
        t !== 'job_photo' &&
        t !== 'job_signature',
    )

    for (const type of types) {
      await enqueueOutboxItem(orgId, {
        type,
        payload: { id: type },
      })
    }

    const pending = await db.outbox.where('syncStatus').equals('pending').count()
    mockedPending.mockReturnValue(pending)

    render(<OfflineBadge orgId={orgId} userId={userId} />)

    expect(screen.getByText(`${pending} pending`)).toBeInTheDocument()
  })

  it('shows Offline when the device is offline', () => {
    const mockedOnline = vi.mocked(useOnline)
    mockedOnline.mockReturnValue(false)

    const mockedPending = vi.mocked(usePendingCount)
    const mockedFailed = vi.mocked(useFailedCount)
    mockedPending.mockReturnValue(0)
    mockedFailed.mockReturnValue(0)

    render(<OfflineBadge orgId={orgId} userId={userId} />)

    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows Sync failed retry when there are failed items', () => {
    const mockedOnline = vi.mocked(useOnline)
    mockedOnline.mockReturnValue(true)

    const mockedPending = vi.mocked(usePendingCount)
    const mockedFailed = vi.mocked(useFailedCount)
    mockedPending.mockReturnValue(0)
    mockedFailed.mockReturnValue(1)

    render(<OfflineBadge orgId={orgId} userId={userId} />)

    expect(screen.getByText('Sync failed — retry')).toBeInTheDocument()
  })
})
