'use client'

import { createTechDb, type OutboxItem, type CachedJob, type CachedEquipment } from './dexie'
import {
  transitionJobStatusAction,
  listTechJobsAction,
  getJobSignatureUploadUrlAction,
  confirmJobSignatureAction,
  saveCompletionNotesAction,
  getEquipmentByServiceLocationAction,
} from '@/app/(tech)/tech/jobs/actions'
import {
  getJobPhotoUploadUrlAction,
  confirmJobPhotoAction,
} from '@/app/(app)/jobs/actions'
import { createBrowserClient } from '@/lib/supabase/browser'
import { toISODate, parseCalendarDate } from '@/lib/utils'

export interface StatusUpdatePayload {
  jobId: string
  toStatus: string
}

export interface PhotoPayload {
  jobId: string
  filename: string
  fileSize: number
  blob: Blob
}

export interface SignaturePayload {
  jobId: string
  filename: string
  fileSize: number
  blob: Blob
  signedBy: string
}

export interface NotePayload {
  jobId: string
  notes: string
}

export async function enqueueOutboxItem(
  orgId: string,
  item: Pick<OutboxItem, 'type' | 'payload'>,
): Promise<void> {
  const db = createTechDb(orgId)
  await db.open()
  await db.outbox.add({
    id: crypto.randomUUID(),
    ...item,
    createdAt: Date.now(),
    retryCount: 0,
    syncStatus: 'pending',
  } as OutboxItem)
}

export async function flushOutbox(orgId: string, userId: string): Promise<void> {
  const db = createTechDb(orgId)
  await db.open()
  const pending = await db.outbox.where('syncStatus').equals('pending').sortBy('createdAt')

  const finalStatusUpdate = new Map<string, { index: number; item: OutboxItem }>()
  pending.forEach((item, idx) => {
    if (item.type === 'job_status_update') {
      const payload = item.payload as StatusUpdatePayload
      finalStatusUpdate.set(payload.jobId, { index: idx, item })
    }
  })

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]

    if (item.type === 'job_status_update') {
      const payload = item.payload as StatusUpdatePayload
      const final = finalStatusUpdate.get(payload.jobId)
      if (final && final.index !== i) {
        await db.outbox.update(item.id, { syncStatus: 'synced' })
        continue
      }
    }

    await db.outbox.update(item.id, { syncStatus: 'syncing' })

    try {
      if (item.type === 'job_status_update') {
        const payload = item.payload as StatusUpdatePayload
        const result = await transitionJobStatusAction(payload.jobId, payload.toStatus)
        if ('error' in result && result.error) {
          throw new Error(result.error)
        }
      } else if (item.type === 'job_photo') {
        await syncPhoto(item)
      } else if (item.type === 'job_signature') {
        await syncSignature(item)
      } else if (item.type === 'job_note') {
        await syncNote(item)
      }
      await db.outbox.update(item.id, { syncStatus: 'synced' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const illegal = message.includes('Illegal transition')
      await db.outbox.update(item.id, {
        syncStatus: 'failed',
        retryCount: item.retryCount + 1,
        error: message,
      })
      if (illegal) {
        console.warn('Illegal transition surfaced to technician', {
          jobId: (item.payload as StatusUpdatePayload).jobId,
          message,
        })
      }
    }
  }
}

async function syncPhoto(item: OutboxItem): Promise<void> {
  const payload = item.payload as PhotoPayload
  const { jobId, filename, fileSize, blob } = payload

  const urlResult = await getJobPhotoUploadUrlAction(jobId, filename, fileSize)
  if ('error' in urlResult && urlResult.error) {
    throw new Error(urlResult.error)
  }
  if (!urlResult.signedUrl || !urlResult.path) {
    throw new Error('Missing signed URL or path')
  }

  const upload = await fetch(urlResult.signedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'content-type': blob.type || 'application/octet-stream' },
  })
  if (!upload.ok) {
    throw new Error(`Direct upload failed: ${upload.status} ${upload.statusText}`)
  }

  const confirmResult = await confirmJobPhotoAction(jobId, urlResult.path)
  if ('error' in confirmResult && confirmResult.error) {
    throw new Error(confirmResult.error)
  }
}

async function syncSignature(item: OutboxItem): Promise<void> {
  const payload = item.payload as SignaturePayload
  const { jobId, filename, fileSize, blob, signedBy } = payload

  const urlResult = await getJobSignatureUploadUrlAction(jobId, filename, fileSize)
  if ('error' in urlResult && urlResult.error) {
    throw new Error(urlResult.error)
  }
  if (!urlResult.signedUrl || !urlResult.path) {
    throw new Error('Missing signed URL or path')
  }

  const upload = await fetch(urlResult.signedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'content-type': blob.type || 'application/octet-stream' },
  })
  if (!upload.ok) {
    throw new Error(`Direct upload failed: ${upload.status} ${upload.statusText}`)
  }

  const confirmResult = await confirmJobSignatureAction(jobId, urlResult.path, signedBy)
  if ('error' in confirmResult && confirmResult.error) {
    throw new Error(confirmResult.error)
  }
}

async function syncNote(item: OutboxItem): Promise<void> {
  const payload = item.payload as NotePayload
  const { jobId, notes } = payload

  const result = await saveCompletionNotesAction(jobId, notes)
  if ('error' in result && result.error) {
    throw new Error(result.error)
  }
}

export async function hydrateTechData(orgId: string, userId: string): Promise<void> {
  const db = createTechDb(orgId)
  await db.open()
  const { rows } = await listTechJobsAction(orgId, userId)
  const cached: CachedJob[] = rows.map((row) => ({
    id: row.id,
    tenantId: orgId,
    jobNo: row.jobNo,
    customerId: row.customerId,
    contactId: (row as { contactId?: string | null }).contactId ?? null,
    serviceLocationId: (row as { serviceLocationId?: string | null }).serviceLocationId ?? null,
    status: row.status,
    description: row.description,
    startDate: row.startDate ? toISODate(parseCalendarDate(row.startDate)!) : null,
    arrivalWindowStart: (row as { arrivalWindowStart?: string | null }).arrivalWindowStart ?? null,
    arrivalWindowEnd: (row as { arrivalWindowEnd?: string | null }).arrivalWindowEnd ?? null,
    notesForTechs: (row as { notesForTechs?: string | null }).notesForTechs ?? null,
    completionNotes: (row as { completionNotes?: string | null }).completionNotes ?? null,
    assigneeUserIds: [userId],
  }))
  await db.jobs.clear()
  await db.jobs.bulkPut(cached)

  const locationIds = Array.from(
    new Set(cached.map((job) => job.serviceLocationId).filter(Boolean) as string[]),
  )

  if (locationIds.length > 0) {
    await db.equipment.clear()
    for (const locationId of locationIds) {
      const rows = await getEquipmentByServiceLocationAction(orgId, locationId)
      const mapped: CachedEquipment[] = rows.map((row) => ({
        id: row.id,
        tenantId: orgId,
        serviceLocationId: row.serviceLocationId,
        kind: row.kind,
        brand: row.brand ?? null,
        installDate: row.installDate ? toISODate(new Date(row.installDate)) : null,
        warrantyExpires: row.warrantyExpires ? toISODate(new Date(row.warrantyExpires)) : null,
        notes: row.notes ?? null,
        widthFt: row.widthFt ? String(row.widthFt) : null,
        heightFt: row.heightFt ? String(row.heightFt) : null,
        material: row.material ?? null,
        style: row.style ?? null,
        color: row.color ?? null,
        modelSeries: row.modelSeries ?? null,
        model: row.model ?? null,
        hp: row.hp ? String(row.hp) : null,
        serial: row.serial ?? null,
        wireSize: row.wireSize ? String(row.wireSize) : null,
        insideDiameter: row.insideDiameter ? String(row.insideDiameter) : null,
        length: row.length ? String(row.length) : null,
        windDirection: row.windDirection,
        cycleRating: row.cycleRating ?? null,
      }))
      if (mapped.length > 0) {
        await db.equipment.bulkPut(mapped)
      }
    }
  }
}

export function startSyncLoop(orgId: string, userId: string): () => void {
  const flush = () => {
    void flushOutbox(orgId, userId)
  }
  const hydrate = () => {
    void hydrateTechData(orgId, userId)
  }

  const onOnline = () => flush()
  const onFocus = () => flush()
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      flush()
    }
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibility)

  flush()
  hydrate()

  const client = createBrowserClient()
  const channel = client.channel(`dispatch:${orgId}`, {
    config: { broadcast: { self: false } },
  })

  channel.on('broadcast', { event: 'job-updated' }, () => {
    hydrate()
  })

  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR') {
      console.warn('Tech dispatch realtime channel error', { orgId, err })
    } else if (status === 'CLOSED') {
      console.warn('Tech dispatch realtime channel closed', { orgId })
    }
  })

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibility)
    client.removeChannel(channel)
  }
}
