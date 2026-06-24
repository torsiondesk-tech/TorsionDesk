'use client'

import Link from 'next/link'
import { estimateStatusLabel } from '@/lib/estimates/status'
import type { WeekEstimate } from '../actions'

type BadgeStyle = { bg: string; text: string; border: string }

function statusBadgeStyle(status: string): BadgeStyle {
  switch (status) {
    case 'estimate_requested':  return { bg: '#d1d5db', text: '#1f2937', border: '#9ca3af' }
    case 'estimate_provided':   return { bg: '#bfdbfe', text: '#1e3a8a', border: '#60a5fa' }
    case 'estimate_accepted':   return { bg: '#99f6e4', text: '#134e4a', border: '#2dd4bf' }
    case 'estimate_won':        return { bg: '#bbf7d0', text: '#14532d', border: '#4ade80' }
    case 'estimate_lost':       return { bg: '#fecaca', text: '#7f1d1d', border: '#f87171' }
    default: return { bg: '#d1d5db', text: '#1f2937', border: '#9ca3af' }
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

interface EstimatePoolCardProps {
  estimate: WeekEstimate
}

export function EstimatePoolCard({ estimate }: EstimatePoolCardProps) {
  const badge = statusBadgeStyle(estimate.status)
  const window = formatWindow(estimate.arrivalWindowStart, estimate.arrivalWindowEnd)

  return (
    <Link
      href={`/estimates/${estimate.id}`}
      className="block w-full sm:w-52 min-h-[104px] rounded-md border p-2 text-xs shadow-sm transition-all bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-400 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold tabular-nums">EST-{estimate.estimateNo}</span>
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
      {window && (
        <div className="text-[10px] opacity-80">{window}</div>
      )}
      {estimate.description && (
        <div className="truncate text-[10px] opacity-70 mt-0.5">{estimate.description}</div>
      )}
    </Link>
  )
}
