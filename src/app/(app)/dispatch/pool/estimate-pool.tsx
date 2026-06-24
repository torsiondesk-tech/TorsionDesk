'use client'

import { useState, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { EstimatePoolCard } from './estimate-pool-card'
import type { WeekEstimate } from '../actions'

type TabKey = 'all' | 'unscheduled' | 'unassigned'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'unscheduled', label: 'Unscheduled' },
  { key: 'unassigned',  label: 'Unassigned' },
]

interface EstimatePoolProps {
  estimates: WeekEstimate[]
  onEstimateClick?: (estimate: WeekEstimate) => void
}

export function EstimatePool({ estimates, onEstimateClick }: EstimatePoolProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const { isOver, setNodeRef } = useDroppable({ id: 'estimate-pool' })

  const counts: Record<TabKey, number> = useMemo(() => ({
    all:         estimates.length,
    unscheduled: estimates.filter((e) => !e.startDate).length,
    unassigned:  estimates.filter((e) => e.techIds.length === 0).length,
  }), [estimates])

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'unscheduled': return estimates.filter((e) => !e.startDate)
      case 'unassigned':  return estimates.filter((e) => e.techIds.length === 0)
      default:            return estimates
    }
  }, [estimates, activeTab])

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Estimate Pool</h2>
        <span className="text-sm text-muted-foreground">{counts.all} total</span>
      </div>

      <div className="flex items-center gap-1 border-b pb-2 overflow-x-auto">
        {TABS.map((t) => {
          const c = counts[t.key]
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {t.label}
              {c > 0 && (
                <Badge
                  variant={isActive ? 'secondary' : 'outline'}
                  className="h-4 min-w-[1rem] px-1 text-[10px]"
                >
                  {c}
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1 rounded-md transition-colors content-start',
          isOver && 'bg-amber-50/60 ring-2 ring-amber-300/40',
        )}
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center w-full">No estimates in this tab.</p>
        ) : (
          filtered.map((e) => <EstimatePoolCard key={e.id} estimate={e} onClick={onEstimateClick} />)
        )}
      </div>
    </div>
  )
}
