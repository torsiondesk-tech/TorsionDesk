'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { createTechDb } from './dexie'

export function useTechJobs(orgId: string, userId: string) {
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      const all = await db.jobs.toArray()
      return all
        .filter((job) => job.assigneeUserIds.includes(userId))
        .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    },
    [orgId, userId],
  )
}

export function usePendingCount(orgId: string): number {
  return (
    useLiveQuery(
      async () => {
        const db = createTechDb(orgId)
        await db.open()
        return db.outbox.where('syncStatus').equals('pending').count()
      },
      [orgId],
    ) ?? 0
  )
}

export function useFailedCount(orgId: string): number {
  return (
    useLiveQuery(
      async () => {
        const db = createTechDb(orgId)
        await db.open()
        return db.outbox.where('syncStatus').equals('failed').count()
      },
      [orgId],
    ) ?? 0
  )
}
