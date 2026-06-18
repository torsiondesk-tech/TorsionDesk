'use client'

import { useOnline } from '@/app/(tech)/lib/use-online'
import { usePendingCount, useFailedCount } from '@/app/(tech)/lib/use-tech-data'
import { flushOutbox } from '@/app/(tech)/lib/sync'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, CloudOff, RotateCcw } from 'lucide-react'

interface OfflineBadgeProps {
  orgId: string
  userId: string
}

export function OfflineBadge({ orgId, userId }: OfflineBadgeProps) {
  const online = useOnline()
  const pending = usePendingCount(orgId)
  const failed = useFailedCount(orgId)

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      {!online ? (
        <Badge variant="destructive" className="gap-1">
          <CloudOff className="size-3" aria-hidden="true" />
          Offline
        </Badge>
      ) : failed > 0 ? (
        <button
          type="button"
          onClick={() => flushOutbox(orgId, userId)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            'bg-destructive/10 text-destructive hover:bg-destructive/20',
          )}
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          Sync failed — retry
        </button>
      ) : pending > 0 ? (
        <Badge variant="default" className="gap-1">
          {pending} pending
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          Synced
        </Badge>
      )}
    </div>
  )
}
