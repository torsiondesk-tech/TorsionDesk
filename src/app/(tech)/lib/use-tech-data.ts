'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createTechDb } from './dexie'
import { TECH_DATA_UPDATED } from './sync'

function useTechDataTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const onUpdate = () => setTick((t) => t + 1)
    window.addEventListener(TECH_DATA_UPDATED, onUpdate)
    return () => window.removeEventListener(TECH_DATA_UPDATED, onUpdate)
  }, [])
  return tick
}

export function useTechJobs(orgId: string, userId: string) {
  // No tick dependency — Dexie's native table observation re-runs the query
  // when db.jobs changes without returning undefined (which causes the loading
  // spinner). tick is only needed for hooks that read tables not observed here.
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
  const tick = useTechDataTick()
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      return db.customers.toArray()
    },
    [orgId, tick],
  )
}

export function useTechLocations(orgId: string, customerId?: string | null) {
  const tick = useTechDataTick()
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      const all = await db.serviceLocations.toArray()
      if (!customerId) return all
      return all.filter((loc) => loc.customerId === customerId)
    },
    [orgId, customerId, tick],
  )
}

export function useTechEstimates(orgId: string) {
  const tick = useTechDataTick()
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      const rows = await db.estimates.toArray()
      return rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    },
    [orgId, tick],
  )
}

export function useTechEstimate(orgId: string, id: string) {
  const tick = useTechDataTick()
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      return db.estimates.get(id)
    },
    [orgId, id, tick],
  )
}

export function useTechInvoices(orgId: string) {
  const tick = useTechDataTick()
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      const rows = await db.invoices.toArray()
      return rows.sort((a, b) => (b.issuedAt ?? '').localeCompare(a.issuedAt ?? ''))
    },
    [orgId, tick],
  )
}

export function useTechInvoice(orgId: string, id: string) {
  const tick = useTechDataTick()
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      return db.invoices.get(id)
    },
    [orgId, id, tick],
  )
}

export function useTechJob(orgId: string, jobId: string) {
  return useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      return db.jobs.get(jobId)
    },
    [orgId, jobId],
  )
}

export function useTechEquipmentByLocation(orgId: string, serviceLocationId: string | null) {
  return useLiveQuery(
    async () => {
      if (!serviceLocationId) return [] as import('./dexie').CachedEquipment[]
      const db = createTechDb(orgId)
      await db.open()
      return db.equipment.where({ serviceLocationId }).toArray()
    },
    [orgId, serviceLocationId],
  )
}

export function usePendingEstimateConversion(orgId: string, estimateId: string): number {
  const tick = useTechDataTick()
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
      [orgId, estimateId, tick],
    ) ?? 0
  )
}

export function usePendingCount(orgId: string): number {
  const tick = useTechDataTick()
  return (
    useLiveQuery(
      async () => {
        const db = createTechDb(orgId)
        await db.open()
        return db.outbox.where('syncStatus').equals('pending').count()
      },
      [orgId, tick],
    ) ?? 0
  )
}

export function useFailedCount(orgId: string): number {
  const tick = useTechDataTick()
  return (
    useLiveQuery(
      async () => {
        const db = createTechDb(orgId)
        await db.open()
        return db.outbox.where('syncStatus').equals('failed').count()
      },
      [orgId, tick],
    ) ?? 0
  )
}
