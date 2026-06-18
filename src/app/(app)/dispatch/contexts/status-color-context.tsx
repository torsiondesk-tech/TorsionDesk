'use client'

import { createContext, useContext } from 'react'
import type { JobStatusValue } from '@/lib/jobs/transitions'

export type StatusColorMap = Record<
  JobStatusValue,
  { bgColor: string; textColor: string; borderColor: string }
>

const StatusColorContext = createContext<StatusColorMap | null>(null)

export function StatusColorProvider({
  colors,
  children,
}: {
  colors: StatusColorMap
  children: React.ReactNode
}) {
  return (
    <StatusColorContext.Provider value={colors}>
      {children}
    </StatusColorContext.Provider>
  )
}

/** Returns the color tuple for a given job status, or a safe fallback. */
export function useStatusColor(status: string): { bgColor: string; textColor: string; borderColor: string } {
  const map = useContext(StatusColorContext)
  if (!map) {
    return { bgColor: '#f8fafc', textColor: '#1e293b', borderColor: '#e2e8f0' }
  }
  return map[status as JobStatusValue] ?? { bgColor: '#f8fafc', textColor: '#1e293b', borderColor: '#e2e8f0' }
}
