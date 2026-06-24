'use client'

import { createContext, useContext } from 'react'
import type { EstimateStatusValue } from '@/lib/estimates/status'

export type EstimateStatusColorMap = Record<
  EstimateStatusValue,
  { bgColor: string; textColor: string; borderColor: string }
>

const EstimateStatusColorContext = createContext<EstimateStatusColorMap | null>(null)

export function EstimateStatusColorProvider({
  colors,
  children,
}: {
  colors: EstimateStatusColorMap
  children: React.ReactNode
}) {
  return (
    <EstimateStatusColorContext.Provider value={colors}>
      {children}
    </EstimateStatusColorContext.Provider>
  )
}

export function useEstimateStatusColor(status: string): { bgColor: string; textColor: string; borderColor: string } {
  const map = useContext(EstimateStatusColorContext)
  if (!map) {
    return { bgColor: '#d1d5db', textColor: '#1f2937', borderColor: '#9ca3af' }
  }
  return map[status as EstimateStatusValue] ?? { bgColor: '#d1d5db', textColor: '#1f2937', borderColor: '#9ca3af' }
}
