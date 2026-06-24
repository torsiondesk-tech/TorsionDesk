'use client'

import { useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { estimateStatusLabel } from '@/lib/estimates/status'
import { cn } from '@/lib/utils'
import type { WeekEstimate } from '../actions'

type BadgeStyle = { bg: string; text: string; border: string }

function statusBadgeStyle(status: string): BadgeStyle {
  switch (status) {
    case 'estimate_requested':
      return { bg: '#d1d5db', text: '#1f2937', border: '#9ca3af' } // gray
    case 'estimate_provided':
      return { bg: '#bfdbfe', text: '#1e3a8a', border: '#60a5fa' } // blue
    case 'estimate_accepted':
      return { bg: '#99f6e4', text: '#134e4a', border: '#2dd4bf' } // teal
    case 'estimate_won':
      return { bg: '#bbf7d0', text: '#14532d', border: '#4ade80' } // green
    case 'estimate_lost':
      return { bg: '#fecaca', text: '#7f1d1d', border: '#f87171' } // red
    default:
      return { bg: '#d1d5db', text: '#1f2937', border: '#9ca3af' }
  }
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

  const badge = statusBadgeStyle(estimate.status)

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
          EST-{estimate.estimateNo}
        </span>
        <span
          className="inline-flex h-4 shrink-0 items-center rounded-full border px-1.5 text-[10px] font-semibold whitespace-nowrap leading-none"
          style={{ backgroundColor: badge.bg, color: badge.text, borderColor: badge.border }}
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
