'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { transitionEstimateStatusAction } from '../actions'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'

const ESTIMATE_STATUSES = [
  'estimate_requested',
  'estimate_provided',
  'estimate_accepted',
  'estimate_won',
  'estimate_lost',
] as const

interface EstimateStatusDropdownProps {
  estimateId: string
  currentStatus: string
  onStatusChange?: (newStatus: string) => void
}

export function EstimateStatusDropdown({
  estimateId,
  currentStatus,
  onStatusChange,
}: EstimateStatusDropdownProps) {
  const [displayed, setDisplayed] = useState(currentStatus)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: string | null) => {
    if (!next || next === displayed) return
    setError(null)
    startTransition(async () => {
      const result = await transitionEstimateStatusAction(estimateId, next)
      if (result.error) {
        setError(result.error)
      } else {
        setDisplayed(next)
        onStatusChange?.(next)
      }
    })
  }

  const others = ESTIMATE_STATUSES.filter((s) => s !== displayed)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Badge variant={estimateStatusBadgeVariant(displayed)}>
          {estimateStatusLabel(displayed)}
        </Badge>
      </div>

      {others.length > 0 && (
        <Select value="" onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Change status…" />
          </SelectTrigger>
          <SelectContent>
            {others.map((s) => (
              <SelectItem key={s} value={s}>
                {estimateStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
