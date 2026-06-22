'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'
import { startSyncLoop, TECH_DATA_UPDATE_FAILED } from '@/app/(tech)/lib/sync'
import { toast } from 'sonner'

const AUTH_STORAGE_KEY = 'td:auth'

interface TechContextValue {
  orgId: string
  userId: string
}

export const TechContext = createContext<TechContextValue | null>(null)

export function useTechContext(): TechContextValue {
  // During SSR/prerender Clerk isn't loaded yet so context is null.
  // Return empty-string defaults — client re-renders with real values before any action fires.
  return useContext(TechContext) ?? { orgId: '', userId: '' }
}

export function TechSyncProvider({ children }: { children: ReactNode }) {
  const { orgId: clerkOrgId, userId: clerkUserId, isLoaded } = useAuth()

  // resolvedAuth is the auth used for startSyncLoop and context.
  // Starts null; populated from localStorage (offline fallback) or Clerk (authoritative).
  // Read from localStorage in useEffect to avoid SSR hydration mismatch.
  const [resolvedAuth, setResolvedAuth] = useState<TechContextValue | null>(null)
  const resolvedRef = useRef<TechContextValue | null>(null)

  // After mount: read stored auth immediately so the sync loop can start offline
  // without waiting for Clerk's JWT validation to complete.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as TechContextValue
        if (stored.orgId && stored.userId && !resolvedRef.current) {
          resolvedRef.current = stored
          setResolvedAuth(stored)
        }
      }
    } catch { /* localStorage unavailable */ }
  }, [])

  // When Clerk loads valid auth: update resolved auth and persist to localStorage.
  // The ref comparison prevents restarting the sync loop when values haven't changed.
  useEffect(() => {
    if (!isLoaded || !clerkOrgId || !clerkUserId) return
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ orgId: clerkOrgId, userId: clerkUserId }))
    } catch { /* ignore */ }
    if (
      resolvedRef.current?.orgId === clerkOrgId &&
      resolvedRef.current?.userId === clerkUserId
    ) return // same auth already running — no need to restart sync loop
    const auth = { orgId: clerkOrgId, userId: clerkUserId }
    resolvedRef.current = auth
    setResolvedAuth(auth)
  }, [isLoaded, clerkOrgId, clerkUserId])

  // Start (or restart) the sync loop whenever resolved auth first becomes available
  // or changes (e.g. different user signs in on the same device).
  useEffect(() => {
    if (!resolvedAuth) return
    const cleanup = startSyncLoop(resolvedAuth.orgId, resolvedAuth.userId)
    return cleanup
  }, [resolvedAuth])

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

  // Prefer Clerk's live auth for context value; fall back to resolved (stored) auth.
  // null on first SSR frame — consumers handle this via useTechContext() defaults.
  const contextValue =
    isLoaded && clerkOrgId && clerkUserId
      ? { orgId: clerkOrgId, userId: clerkUserId }
      : resolvedAuth

  return (
    <TechContext.Provider value={contextValue}>
      {children}
    </TechContext.Provider>
  )
}
