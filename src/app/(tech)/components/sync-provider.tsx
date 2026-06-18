'use client'

import { useEffect, type ReactNode } from 'react'
import { startSyncLoop } from '@/app/(tech)/lib/sync'

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

  return <>{children}</>
}
