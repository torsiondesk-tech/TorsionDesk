'use client'

import { useState, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { PoolTabs } from './pool-tabs'
import { PoolCard } from './pool-card'
import type { WeekJob, PoolCounts } from '../actions'

interface JobPoolProps {
  jobs: WeekJob[]
  counts: PoolCounts
  onJobClick?: (job: WeekJob) => void
}

export function JobPool({ jobs, counts, onJobClick }: JobPoolProps) {
  const [activeTab, setActiveTab] = useState<string>('all')
  const { isOver, setNodeRef } = useDroppable({ id: 'job-pool' })

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'all':
        return jobs
      case 'unscheduled':
        return jobs.filter((j) => !j.startDate)
      case 'unassigned':
        return jobs.filter((j) => j.techIds.length === 0)
      case 'withOpenPOs':
        return [] // TODO: Phase 7
      case 'partiallyCompleted':
        return jobs.filter((j) => j.status === 'partially_completed')
      case 'paused':
        return jobs.filter((j) => j.status === 'paused')
      case 'markedForFollowUp':
        return [] // TODO: needs_follow_up not in enum
      default:
        return []
    }
  }, [jobs, activeTab])

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Job Pool</h2>
        <span className="text-sm text-muted-foreground">{counts.total} total</span>
      </div>

      <PoolTabs counts={counts} activeTab={activeTab} onTabChange={setActiveTab} />

      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1 rounded-md transition-colors content-start',
          isOver && 'bg-primary/10 ring-2 ring-primary/20',
        )}
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No jobs in this tab.</p>
        ) : (
          filtered.map((job) => <PoolCard key={job.id} job={job} onClick={onJobClick} />)
        )}
      </div>
    </div>
  )
}
