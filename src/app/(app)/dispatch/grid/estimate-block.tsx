'use client'

import { useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import { cn } from '@/lib/utils'
import type { WeekEstimate } from '../actions'

function blockColor(status: string): string {
  if (status === 'cancelled') return 'bg-muted text-muted-foreground opacity-60 border-muted'
  if (
    ['delayed', 'on_the_way', 'on_site', 'started', 'paused', 'resumed', 'partially_completed', 'completed'].includes(
      status,
    )
  )
    return 'bg-blue-50 text-blue-800 border-blue-200 hover:border-blue-300'
  if (['invoiced', 'paid_in_full', 'job_closed'].includes(status))
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-300'
  return 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
}

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

interface EstimateBlockProps {
  estimate: WeekEstimate
  isOverlay?: boolean
  onClick?: (estimate: WeekEstimate) => void
}

export function EstimateBlock({ estimate, isOverlay, onClick }: EstimateBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: estimate.id,
    data: { estimate, type: 'estimate' },
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
    onClick?.(estimate)
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={cn(
        'min-h-[104px] cursor-grab rounded-md border p-2 text-xs shadow-sm active:cursor-grabbing transition-all',
        'bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300',
        isDragging && !isOverlay && 'opacity-30',
        isOverlay && 'shadow-lg rotate-2 scale-105 cursor-grabbing',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold tabular-nums">
          #{`EST-${estimate.estimateNo}`}
        </span>
        <Badge variant={estimateStatusBadgeVariant(estimate.status)} className="text-[10px] h-4 px-1">
          {estimateStatusLabel(estimate.status)}
        </Badge>
      </div>
      <div className="truncate font-medium">{estimate.customerName}</div>
      {estimate.address && (
        <div className="truncate text-[10px] opacity-80">{estimate.address}</div>
      )}
      {formatWindow(estimate.arrivalWindowStart, estimate.arrivalWindowEnd) && (
        <div className="text-[10px] opacity-80">
          {formatWindow(estimate.arrivalWindowStart, estimate.arrivalWindowEnd)}
        </div>
      )}
      {estimate.description && (
        <div className="truncate text-[10px] opacity-70 mt-0.5">{estimate.description}</div>
      )}
    </div>
  )
}
