'use client'

import { useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { StatusBadge } from '../components/status-badge'
import { cn } from '@/lib/utils'
import { useStatusColor } from '../contexts/status-color-context'
import type { WeekJob } from '../actions'

function formatWindow(start: Date | string | null, end: Date | string | null): string {
  if (!start && !end) return ''
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const toDate = (d: Date | string | null): Date | null => {
    if (!d) return null
    return d instanceof Date ? d : new Date(d)
  }
  const s = start ? fmt.format(toDate(start)!) : ''
  const e = end ? fmt.format(toDate(end)!) : ''
  return s && e ? `${s} – ${e}` : s || e || ''
}

interface PoolCardContentProps {
  job: WeekJob
  isOverlay?: boolean
}

/** Presentational card body — used directly by the drag overlay so the
 *  dragged ghost is exactly the same size and shape as the pool card. */
export function PoolCardContent({ job, isOverlay }: PoolCardContentProps) {
  const color = useStatusColor(job.status)

  return (
    <div
      className={cn(
        'w-52 min-h-[104px] cursor-grab rounded-md border p-2 text-xs shadow-sm active:cursor-grabbing transition-all',
        isOverlay && 'shadow-lg rotate-2 scale-105 cursor-grabbing',
      )}
      style={{
        backgroundColor: color.bgColor,
        color: color.textColor,
        borderColor: color.borderColor,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold tabular-nums">
          #{`JOB-${job.jobNo}`}
        </span>
        <StatusBadge status={job.status} />
      </div>
      <div className="truncate font-medium">{job.customerName}</div>
      {job.address && (
        <div className="truncate text-[10px] opacity-80">{job.address}</div>
      )}
      {formatWindow(job.arrivalWindowStart, job.arrivalWindowEnd) && (
        <div className="text-[10px] opacity-80">
          {formatWindow(job.arrivalWindowStart, job.arrivalWindowEnd)}
        </div>
      )}
      {job.description && (
        <div className="truncate text-[10px] opacity-70 mt-0.5">{job.description}</div>
      )}
    </div>
  )
}

interface PoolCardProps {
  job: WeekJob
  onClick?: (job: WeekJob) => void
}

export function PoolCard({ job, onClick }: PoolCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    data: { type: 'pool-job', job },
  })

  const wasDragged = useRef(false)
  useEffect(() => {
    if (isDragging) wasDragged.current = true
  }, [isDragging])

  const handleClick = () => {
    if (wasDragged.current) {
      wasDragged.current = false
      return
    }
    onClick?.(job)
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={cn(
        isDragging && 'opacity-30',
      )}
    >
      <PoolCardContent job={job} />
    </div>
  )
}
