'use client'

import { useEffect, type ReactNode } from 'react'
import { startSyncLoop, TECH_DATA_UPDATE_FAILED } from '@/app/(tech)/lib/sync'
import { toast } from 'sonner'

interface TechSyncProviderProps {
  orgId: string
  userId: string
  children: ReactNode
}

export function TechSyncProvider({ orgId, userId, children }: TechSyncProviderProps) {
  useEffect(() => {
    if (!orgId || !userId) return
    const cleanup = startSyncLoop(orgId, userId)
    return cleanup
  }, [orgId, userId])

  useEffect(() => {
    const onDataFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail as { error?: string; orgId?: string } | undefined
      console.error('[sync-provider] hydration failed:', detail?.error ?? 'unknown', detail)
      toast.error('Job sync failed — pull down to retry')
    }
    window.addEventListener(TECH_DATA_UPDATE_FAILED, onDataFailed)
    return () => {
      window.removeEventListener(TECH_DATA_UPDATE_FAILED, onDataFailed)
    }
  }, [])

  return <>{children}</>
}
