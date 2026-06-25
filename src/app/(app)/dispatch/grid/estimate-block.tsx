'use client'

import { useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { estimateStatusLabel } from '@/lib/estimates/status'
import { useEstimateStatusColor } from '../contexts/estimate-status-color-context'
import { cn } from '@/lib/utils'
import type { WeekEstimate } from '../actions'

function formatWindow(start: Date | string | null, end: Date | string | null): string {
  if (!start && !end) return ''
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
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

  const color = useEstimateStatusColor(estimate.status)

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
        isDragging && !isOverlay && 'opacity-30',
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
          EST-{estimate.estimateNo}
        </span>
        <span
          className="inline-flex h-4 shrink-0 items-center rounded-full border px-1.5 text-[10px] font-semibold whitespace-nowrap leading-none"
          style={{ backgroundColor: color.bgColor, color: color.textColor, borderColor: color.borderColor, filter: 'brightness(0.88)' }}
        >
          {estimateStatusLabel(estimate.status)}
        </span>
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
