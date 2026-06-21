'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
import { startSyncLoop, TECH_DATA_UPDATE_FAILED } from '@/app/(tech)/lib/sync'
import { toast } from 'sonner'

interface TechContextValue {
  orgId: string
  userId: string
}

export const TechContext = createContext<TechContextValue | null>(null)

export function useTechContext(): TechContextValue {
  const ctx = useContext(TechContext)
  if (!ctx) throw new Error('useTechContext must be used within TechSyncProvider')
  return ctx
}

export function TechSyncProvider({ children }: { children: ReactNode }) {
  const { orgId, userId, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded || !orgId || !userId) return
    const cleanup = startSyncLoop(orgId, userId)
    return cleanup
  }, [isLoaded, orgId, userId])

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

  // Always render children to avoid SSR hydration mismatch.
  // Context value is null until Clerk hydrates; consumers use useContext directly
  // and render nothing when context is null (safe for the <1 frame loading gap).
  return (
    <TechContext.Provider value={isLoaded && orgId && userId ? { orgId, userId } : null}>
      {children}
    </TechContext.Provider>
  )
}
