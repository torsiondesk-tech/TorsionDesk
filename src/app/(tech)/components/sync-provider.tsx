'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
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

  // Clerk reads the JWT from cookies — works offline. Render null for the brief
  // frame before Clerk's client JS hydrates (avoids context consumers throwing).
  if (!isLoaded || !orgId || !userId) return null

  return <TechContext.Provider value={{ orgId, userId }}>{children}</TechContext.Provider>
}
