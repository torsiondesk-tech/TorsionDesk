'use client'

import { useQueryStates, parseAsString, parseAsBoolean } from 'nuqs'
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
    my: Record<string, number>
    all: Record<string, number>
  }
}

interface Folder {
  key: string
  label: string
  icon: React.ElementType
}

const STATUS_FOLDERS: Folder[] = [
  { key: 'estimate_requested', label: 'Requested', icon: Clock },
  { key: 'estimate_provided', label: 'Provided', icon: Send },
  { key: 'estimate_accepted', label: 'Accepted', icon: ThumbsUp },
  { key: 'estimate_won', label: 'Won', icon: CheckCircle },
  { key: 'estimate_lost', label: 'Lost', icon: XCircle },
]

export function EstimatesSidebar({ statusCounts }: EstimatesSidebarProps) {
  const [{ status, mine }, setParams] = useQueryStates(
    {
      status: parseAsString.withDefault(''),
      mine: parseAsBoolean.withDefault(false),
    },
    { shallow: false },
  )

  const selectFolder = (key: string, sectionMine: boolean) => {
    if (status === key && mine === sectionMine) {
      setParams({ status: null, mine: null })
    } else {
      setParams({ status: key, mine: sectionMine })
    }
  }

  const renderSection = (title: string, sectionMine: boolean) => (
    <div key={title} className="space-y-1">
      <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {STATUS_FOLDERS.map((folder) => {
        const Icon = folder.icon
        const counts = sectionMine ? statusCounts.my : statusCounts.all
        const count = counts[folder.key] ?? 0
        const isActive = status === folder.key && mine === sectionMine
        return (
          <button
            key={folder.key}
            onClick={() => selectFolder(folder.key, sectionMine)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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

  return (
    <div className="space-y-4">
      {renderSection('My Estimates', true)}
      {renderSection('All Estimates', false)}
    </div>
  )
}
