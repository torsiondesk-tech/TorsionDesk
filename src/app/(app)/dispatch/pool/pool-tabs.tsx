'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { PoolCounts } from '../actions'

const TABS: { key: keyof PoolCounts | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unscheduled', label: 'Unscheduled' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'withOpenPOs', label: 'With Open POs' },
  { key: 'partiallyCompleted', label: 'Partially Completed' },
  { key: 'paused', label: 'Paused' },
  { key: 'markedForFollowUp', label: 'Marked For Follow Up' },
]

interface PoolTabsProps {
  counts: PoolCounts
  activeTab: string
  onTabChange: (tab: string) => void
}

export function PoolTabs({ counts, activeTab, onTabChange }: PoolTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b pb-2 overflow-x-auto">
      {TABS.map((t) => {
        const count = t.key === 'all' ? counts.total : (counts[t.key] ?? 0)
        const isActive = activeTab === t.key
        return (
          <button
            key={t.key}
            data-testid={`pool-tab-${t.key}`}
            onClick={() => onTabChange(t.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t.label}
            {count > 0 && (
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className="h-4 min-w-[1rem] px-1 text-[10px]"
              >
                {count}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
