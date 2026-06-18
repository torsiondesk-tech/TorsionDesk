'use client'

import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { toast } from 'sonner'

interface SyncToastProps {
  orgId: string
}

export function SyncToast({ orgId }: SyncToastProps) {
  const previous = useRef<{
    pending: number
    failed: number
  }>({ pending: 0, failed: 0 })

  const snapshot = useLiveQuery(
    async () => {
      const db = createTechDb(orgId)
      await db.open()
      const pending = await db.outbox.where('syncStatus').equals('pending').count()
      const failed = await db.outbox.where('syncStatus').equals('failed').count()
      return { pending, failed }
    },
    [orgId],
  ) ?? { pending: 0, failed: 0 }

  useEffect(() => {
    const prev = previous.current

    if (snapshot.failed > 0 && snapshot.failed !== prev.failed) {
      toast.error('Sync failed — retry from the top bar')
    } else if (snapshot.pending > 0 && prev.pending === 0) {
      toast.info(`${snapshot.pending} change${snapshot.pending === 1 ? '' : 's'} queued — will sync when online`)
    } else if (snapshot.pending === 0 && prev.pending > 0) {
      toast.success('All changes synced')
    }

    previous.current = snapshot
  }, [snapshot])

  return null
}
