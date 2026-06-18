'use client'

import { createTechDb, type OutboxItem, type CachedJob } from './dexie'
import { transitionJobStatusAction, listTechJobsAction } from '@/app/(tech)/tech/jobs/actions'
import { createBrowserClient } from '@/lib/supabase/browser'
import { toISODate, parseCalendarDate } from '@/lib/utils'

export interface StatusUpdatePayload {
  jobId: string
  toStatus: string
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

export async function hydrateTechData(orgId: string, userId: string): Promise<void> {
  const db = createTechDb(orgId)
  await db.open()
  const { rows } = await listTechJobsAction(orgId, userId)
  const cached: CachedJob[] = rows.map((row) => ({
    id: row.id,
    tenantId: orgId,
    jobNo: row.jobNo,
    customerId: row.customerId,
    contactId: null,
    serviceLocationId: null,
    status: row.status,
    description: row.description,
    startDate: row.startDate ? toISODate(parseCalendarDate(row.startDate)!) : null,
    arrivalWindowStart: (row as { arrivalWindowStart?: string | null }).arrivalWindowStart ?? null,
    arrivalWindowEnd: (row as { arrivalWindowEnd?: string | null }).arrivalWindowEnd ?? null,
    notesForTechs: null,
    completionNotes: null,
    assigneeUserIds: [userId],
  }))
  await db.jobs.clear()
  await db.jobs.bulkPut(cached)
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
