'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { transitionJobStatusAction, type JobActionState } from '../actions'
import {
  ALLOWED_TRANSITIONS,
  STATUS_GROUPS,
  type JobStatusValue,
} from '@/lib/jobs/transitions'

interface StatusDropdownProps {
  jobId: string
  currentStatus: string
}

function statusBadgeVariant(status: string) {
  const open = STATUS_GROUPS.open as readonly string[]
  const inProgress = STATUS_GROUPS.in_progress as readonly string[]
  const closed = STATUS_GROUPS.closed as readonly string[]

  if (status === 'cancelled') return 'destructive'
  if (open.includes(status)) return 'outline'
  if (inProgress.includes(status)) return 'default'
  if (closed.includes(status)) return 'secondary'
  return 'outline'
}

function statusLabel(status: string) {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function StatusDropdown({ jobId, currentStatus }: StatusDropdownProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const legal = ALLOWED_TRANSITIONS[currentStatus as JobStatusValue] ?? []

  // Group legal next states by their status group
  const openLegal = legal.filter((s) =>
    (STATUS_GROUPS.open as readonly string[]).includes(s),
  )
  const inProgressLegal = legal.filter((s) =>
    (STATUS_GROUPS.in_progress as readonly string[]).includes(s),
  )
  const closedLegal = legal.filter((s) =>
    (STATUS_GROUPS.closed as readonly string[]).includes(s),
  )

  const handleChange = (nextStatus: string | null) => {
    if (!nextStatus) return
    setError(null)
    startTransition(async () => {
      const result: JobActionState = await transitionJobStatusAction(
        jobId,
        nextStatus,
      )
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Badge variant={statusBadgeVariant(currentStatus) as any}>
          {statusLabel(currentStatus)}
        </Badge>
      </div>

      {legal.length > 0 && (
        <Select
          value=""
          onValueChange={handleChange}
          disabled={isPending}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Change status…" />
          </SelectTrigger>
          <SelectContent>
            {openLegal.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
                  Open
                </SelectLabel>
                {openLegal.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {inProgressLegal.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
                  In Progress
                </SelectLabel>
                {inProgressLegal.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {closedLegal.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
                  Closed
                </SelectLabel>
                {closedLegal.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
