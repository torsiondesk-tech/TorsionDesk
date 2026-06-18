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

export function useTechCustomers(orgId: string) {
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      return db.customers.toArray()
    },
    [orgId],
  )
}

export function useTechLocations(orgId: string, customerId?: string | null) {
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      const all = await db.serviceLocations.toArray()
      if (!customerId) return all
      return all.filter((loc) => loc.customerId === customerId)
    },
    [orgId, customerId],
  )
}

export function useTechEstimates(orgId: string) {
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      const rows = await db.estimates.toArray()
      return rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    },
    [orgId],
  )
}

export function useTechEstimate(orgId: string, id: string) {
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      return db.estimates.get(id)
    },
    [orgId, id],
  )
}

export function usePendingEstimateConversion(orgId: string, estimateId: string): number {
  return (
    useLiveQuery(
      async () => {
        const db = createTechDb(orgId)
        await db.open()
        return db.outbox
          .where({ type: 'estimate_conversion', syncStatus: 'pending' })
          .filter((item) => (item.payload as { estimateId?: string }).estimateId === estimateId)
          .count()
      },
      [orgId, estimateId],
    ) ?? 0
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