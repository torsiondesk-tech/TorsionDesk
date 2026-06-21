import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTechDb, type CachedJob } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type NotePayload } from '@/app/(tech)/lib/sync'
import { CompletionNotes } from '@/app/(tech)/components/completion-notes'

vi.mock('@/app/(tech)/lib/use-online', () => ({
  useOnline: () => false,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/app/(tech)/tech/jobs/actions', () => ({
  transitionJobStatusAction: vi.fn(),
  listTechJobsAction: vi.fn(),
  getJobSignatureUploadUrlAction: vi.fn(),
  confirmJobSignatureAction: vi.fn(),
  saveCompletionNotesAction: vi.fn(),
  getEquipmentByServiceLocationAction: vi.fn(),
}))

vi.mock('@/app/(app)/jobs/actions', () => ({
  transitionJobStatusAction: vi.fn(),
  getJobPhotoUploadUrlAction: vi.fn(),
  confirmJobPhotoAction: vi.fn(),
}))

import { saveCompletionNotesAction } from '@/app/(tech)/tech/jobs/actions'

const orgId = 'org_notes'
const userId = 'user_notes'
const jobId = 'job_notes_1'

describe('completion notes sync', () => {
  let db: ReturnType<typeof createTechDb>

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()
    const job: CachedJob = {
      id: jobId,
      tenantId: orgId,
      jobNo: 2001,
      customerId: 'cust-1',
      contactId: null,
      serviceLocationId: 'loc-1',
      status: 'on_site',
      description: 'Repair',
      startDate: '2026-06-17',
      arrivalWindowStart: null,
      arrivalWindowEnd: null,
      notesForTechs: null,
      completionNotes: '',
      assigneeUserIds: [userId],
      customerName: null,
      addressLine1: null,
      city: null,
      state: null,
      postalCode: null,
      contactPhone: null,
      contactEmail: null,
      contactFirstName: null,
      contactLastName: null,
    }
    await db.jobs.add(job)
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await db.delete()
  })

  it('queues a note offline and merges it into the cached job row', async () => {
    render(<CompletionNotes orgId={orgId} jobId={jobId} initialNotes="" />)

    const textarea = screen.getByPlaceholderText(/add completion notes/i)
    await userEvent.type(textarea, 'Replaced torsion spring')
    await userEvent.click(screen.getByRole('button', { name: /save notes/i }))

    await waitFor(async () => {
      const items = await db.outbox.where('type').equals('job_note').toArray()
      expect(items).toHaveLength(1)
      const payload = items[0]?.payload as NotePayload
      expect(payload.jobId).toBe(jobId)
      expect(payload.notes).toBe('Replaced torsion spring')
    })

    await waitFor(async () => {
      const job = await db.jobs.get(jobId)
      expect(job?.completionNotes).toBe('Replaced torsion spring')
    })
  })

  it('flushes a queued note via saveCompletionNotesAction and marks synced', async () => {
    const mocked = vi.mocked(saveCompletionNotesAction)
    mocked.mockResolvedValue({ success: true })

    await enqueueOutboxItem(orgId, {
      type: 'job_note',
      payload: { jobId, notes: 'Adjusted opener force' } as NotePayload,
    })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledWith(jobId, 'Adjusted opener force')

    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]?.syncStatus).toBe('synced')
  })
})
