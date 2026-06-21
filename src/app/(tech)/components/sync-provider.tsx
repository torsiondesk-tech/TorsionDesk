'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { startSyncLoop, TECH_DATA_UPDATE_FAILED } from '@/app/(tech)/lib/sync'
import { toast } from 'sonner'

interface TechContextValue {
  orgId: string
  userId: string
}

const TechContext = createContext<TechContextValue | null>(null)

export function useTechContext(): TechContextValue {
  const ctx = useContext(TechContext)
  if (!ctx) throw new Error('useTechContext must be used within TechSyncProvider')
  return ctx
}

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

  return <TechContext.Provider value={{ orgId, userId }}>{children}</TechContext.Provider>
}
