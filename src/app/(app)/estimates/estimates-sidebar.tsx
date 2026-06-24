'use client'

import { useQueryStates, parseAsString, parseAsBoolean } from 'nuqs'
import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  Clock,
  Send,
  ThumbsUp,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react'
import { estimateStatusLabel } from '@/lib/estimates/status'

interface EstimatesSidebarProps {
  statusCounts: {
    all: Record<string, number>
  }
}

interface Folder {
  key: string
  label: string
  icon: React.ElementType
}

const ALL_KEY = 'all'

const STATUS_FOLDERS: Folder[] = [
  { key: ALL_KEY, label: 'All', icon: FileText },
  { key: 'estimate_requested', label: 'Requested', icon: Clock },
  { key: 'estimate_provided', label: 'Provided', icon: Send },
  { key: 'estimate_accepted', label: 'Accepted', icon: ThumbsUp },
  { key: 'estimate_won', label: 'Won', icon: CheckCircle },
  { key: 'estimate_lost', label: 'Lost', icon: XCircle },
]

export function EstimatesSidebar({ statusCounts }: EstimatesSidebarProps) {
  const [isPending, startTransition] = useTransition()
  const [{ status }, setParams] = useQueryStates(
    {
      status: parseAsString.withDefault(''),
      mine: parseAsBoolean.withDefault(false),
    },
    { shallow: false, startTransition },
  )

  const selectFolder = (key: string) => {
    startTransition(() => {
      if (key === ALL_KEY) {
        setParams({ status: null, mine: null })
        return
      }
      if (status === key) {
        setParams({ status: null, mine: null })
      } else {
        setParams({ status: key, mine: null })
      }
    })
  }

  const totalCount = Object.values(statusCounts.all).reduce((sum, c) => sum + (c ?? 0), 0)

  return (
    <div className="space-y-1">
      <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Estimates
      </div>
      {STATUS_FOLDERS.map((folder) => {
        const Icon = folder.icon
        const count = folder.key === ALL_KEY ? totalCount : (statusCounts.all[folder.key] ?? 0)
        const isActive = folder.key === ALL_KEY ? !status : status === folder.key
        return (
          <button
            key={folder.key}
            disabled={isPending}
            onClick={() => selectFolder(folder.key)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              isPending && 'opacity-70',
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1 text-left">{folder.label}</span>
            {count > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
