'use client'

import { useQueryState } from 'nuqs'
import { cn } from '@/lib/utils'
import {
  Search,
  User,
  CalendarDays,
  Briefcase,
  CheckCircle,
  FileText,
  Tag,
} from 'lucide-react'

interface TagCount {
  tagId: string
  name: string
  color: string | null
  count: number
}

interface JobsSidebarProps {
  tagCounts: TagCount[]
}

interface Bucket {
  key: string
  label: string
  icon: React.ElementType
}

const BUCKETS: Bucket[] = [
  { key: 'advanced_search', label: 'Advanced Search', icon: Search },
  { key: 'my_jobs', label: 'My Jobs', icon: User },
  { key: 'my_additional_visits', label: 'My Additional Visits', icon: CalendarDays },
  { key: 'all_open', label: 'All Open Jobs', icon: Briefcase },
  { key: 'completed_ready_to_close', label: 'Completed & Ready to Close', icon: CheckCircle },
  { key: 'to_be_invoiced', label: 'To Be Invoiced', icon: FileText },
]

export function JobsSidebar({ tagCounts }: JobsSidebarProps) {
  const [bucket, setBucket] = useQueryState('bucket')
  const [tag, setTag] = useQueryState('tag')

  const activeBucket = bucket ?? 'all_open'

  const selectBucket = (key: string) => {
    setTag(null)
    if (key === 'all_open') {
      setBucket(null)
    } else {
      setBucket(key)
    }
  }

  const selectTag = (tagId: string) => {
    setBucket(null)
    setTag(tagId)
  }

  return (
    <div className="space-y-1">
      <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Filters
      </div>

      {BUCKETS.map((b) => {
        const Icon = b.icon
        const isActive = activeBucket === b.key && !tag

        return (
          <button
            key={b.key}
            onClick={() => selectBucket(b.key)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1 text-left">{b.label}</span>
          </button>
        )
      })}

      <div className="mt-4 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Jobs by Tag
      </div>

      {tagCounts.length === 0 && (
        <p className="px-2 py-1 text-xs text-muted-foreground">No tags yet.</p>
      )}

      {tagCounts.map((t) => {
        const isActive = tag === t.tagId
        return (
          <button
            key={t.tagId}
            onClick={() => selectTag(t.tagId)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Tag className="size-4" style={{ color: t.color ?? undefined }} />
            <span className="flex-1 text-left">{t.name}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{t.count}</span>
          </button>
        )
      })}
    </div>
  )
}
