'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  ALLOWED_TRANSITIONS,
  statusBadgeVariant,
  statusLabel,
  type JobStatusValue,
} from '@/lib/jobs/transitions'
import { transitionJobStatusAction } from '@/app/(tech)/tech/jobs/actions'
import { enqueueOutboxItem } from '@/app/(tech)/lib/sync'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { cn } from '@/lib/utils'

interface StatusBottomSheetProps {
  orgId: string
  jobId: string
  currentStatus: JobStatusValue
}

function statusDotClass(status: string): string {
  const variant = statusBadgeVariant(status)
  switch (variant) {
    case 'destructive':
      return 'bg-destructive'
    case 'secondary':
      return 'bg-secondary'
    case 'outline':
      return 'bg-muted-foreground'
    case 'default':
    default:
      return 'bg-primary'
  }
}

export function StatusBottomSheet({
  orgId,
  jobId,
  currentStatus,
}: StatusBottomSheetProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<JobStatusValue>(currentStatus)
  const [isPending, startTransition] = useTransition()
  const online = useOnline()

  const options = ALLOWED_TRANSITIONS[status] ?? []

  async function handleSelect(nextStatus: JobStatusValue) {
    if (online) {
      startTransition(async () => {
        const result = await transitionJobStatusAction(jobId, nextStatus)
        if ('error' in result && result.error) {
          toast.error(
            "Couldn't update status. The office may have changed this job. Pull down to refresh."
          )
        } else {
          const db = createTechDb(orgId)
          await db.jobs.update(jobId, { status: nextStatus })
          setStatus(nextStatus)
          setOpen(false)
          toast.success(`Status updated to ${statusLabel(nextStatus)}`)
        }
      })
    } else {
      await enqueueOutboxItem(orgId, {
        type: 'job_status_update',
        payload: { jobId, toStatus: nextStatus },
      })
      const db = createTechDb(orgId)
      await db.jobs.update(jobId, { status: nextStatus })
      setStatus(nextStatus)
      setOpen(false)
      toast.info(`Queued ${statusLabel(nextStatus)} — will sync when you're back online`)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button disabled={isPending}>
            {isPending ? 'Updating...' : 'Update Status'}
          </Button>
        }
      />
      <SheetContent side="bottom" className="h-auto">
        <SheetHeader>
          <SheetTitle>Update status</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col divide-y">
          {options.map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              disabled={isPending}
              onClick={() => handleSelect(nextStatus)}
              className={cn(
                'flex h-12 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted active:bg-muted',
                isPending && 'opacity-50'
              )}
            >
              <span className={cn('size-2 rounded-full', statusDotClass(nextStatus))} />
              <span className="flex-1 text-base">{statusLabel(nextStatus)}</span>
              {nextStatus === 'on_the_way' && (
                <span className="text-xs text-muted-foreground">
                  Texts customer &quot;On The Way&quot;
                </span>
              )}
            </button>
          ))}
          {options.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No status changes available.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
