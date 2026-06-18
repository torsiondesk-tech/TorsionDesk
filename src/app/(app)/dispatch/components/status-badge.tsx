'use client'

import { statusLabel } from '@/lib/jobs/transitions'
import { cn } from '@/lib/utils'
import { useStatusColor } from '../contexts/status-color-context'

interface StatusBadgeProps {
  status: string
  className?: string
}

/** Dispatch-board status pill. Uses the status-color context so the badge
 *  always contrasts with the tinted job card — important in dark mode where
 *  the generic shadcn badge variants can wash out against the card surface. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = useStatusColor(status)

  return (
    <span
      className={cn(
        'inline-flex h-5 items-center justify-center overflow-hidden rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap leading-none',
        className,
      )}
      style={{
        backgroundColor: color.borderColor,
        color: color.textColor,
        borderColor: color.textColor,
      }}
    >
      {statusLabel(status)}
    </span>
  )
}
