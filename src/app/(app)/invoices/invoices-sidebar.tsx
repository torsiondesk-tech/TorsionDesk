'use client'

import { useTransition } from 'react'
import { useQueryStates, parseAsString } from 'nuqs'
import { cn } from '@/lib/utils'
import {
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import type { ArAgingResult } from '@/lib/invoices/ar-aging'

interface InvoicesSidebarProps {
  statusCounts: {
    unpaid: number
    partial: number
    paid: number
    pastDue: number
  }
  arAging: ArAgingResult
}

interface Folder {
  key: string
  label: string
  icon: React.ElementType
}

const ALL_KEY = 'all'

const STATUS_FOLDERS: Folder[] = [
  { key: ALL_KEY, label: 'All', icon: FileText },
  { key: 'unpaid', label: 'Unpaid', icon: Clock },
  { key: 'partial', label: 'Partially Paid', icon: AlertCircle },
  { key: 'paid', label: 'Paid in Full', icon: CheckCircle },
  { key: 'past_due', label: 'Past Due', icon: AlertTriangle },
]

const BUCKETS = [
  {
    key: 'bucket30',
    label: '1–30 days',
    light: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    dark: 'dark:bg-yellow-950/40 dark:text-yellow-300',
    dot: 'bg-yellow-400',
  },
  {
    key: 'bucket60',
    label: '31–60 days',
    light: 'bg-orange-50 text-orange-800 border-orange-200',
    dark: 'dark:bg-orange-950/40 dark:text-orange-300',
    dot: 'bg-orange-400',
  },
  {
    key: 'bucket90',
    label: '61–90 days',
    light: 'bg-orange-100 text-orange-900 border-orange-300',
    dark: 'dark:bg-orange-900/40 dark:text-orange-200',
    dot: 'bg-orange-600',
  },
  {
    key: 'bucket91plus',
    label: '91+ days',
    light: 'bg-red-50 text-red-800 border-red-200',
    dark: 'dark:bg-red-950/40 dark:text-red-300',
    dot: 'bg-red-600',
  },
] as const

function formatMoney(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0)
  if (!Number.isFinite(num)) return '0.00'
  return num.toFixed(2)
}

function isZeroMoney(value: string | number | null | undefined): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0)
  return !Number.isFinite(num) || num === 0
}

export function InvoicesSidebar({ statusCounts, arAging }: InvoicesSidebarProps) {
  const [isPending, startTransition] = useTransition()
  const [{ status }, setParams] = useQueryStates(
    {
      status: parseAsString.withDefault(''),
    },
    { shallow: false, startTransition },
  )

  const selectFolder = (key: string) => {
    startTransition(() => {
      if (key === ALL_KEY) {
        setParams({ status: null })
        return
      }
      if (status === key) {
        setParams({ status: null })
      } else {
        setParams({ status: key })
      }
    })
  }

  const totalCount =
    statusCounts.unpaid +
    statusCounts.partial +
    statusCounts.paid +
    statusCounts.pastDue

  return (
    <div className="space-y-1">
      {/* AR aging panel */}
      <div className="border-b px-2 py-3 mb-2 space-y-2">
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total Unpaid</span>
            <span className="text-3xl font-semibold text-foreground tabular-nums">
              ${formatMoney(arAging.grandUnpaid)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total Past Due</span>
            <span className="text-3xl font-semibold text-destructive tabular-nums">
              ${formatMoney(arAging.grandPastDue)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
          {BUCKETS.map((bucket) => {
            const value = arAging[bucket.key]
            const isZero = isZeroMoney(value)
            return (
              <div
                key={bucket.key}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-2 text-sm',
                  isZero
                    ? 'bg-muted text-muted-foreground border-border'
                    : [bucket.light, bucket.dark],
                )}
              >
                <div className="flex items-center gap-2">
                  {!isZero && (
                    <span className={cn('size-2 rounded-full', bucket.dot)} />
                  )}
                  <span>{bucket.label}</span>
                </div>
                <span className="tabular-nums font-medium">
                  ${formatMoney(value)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status folders */}
      <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Invoices
      </div>
      {STATUS_FOLDERS.map((folder) => {
        const Icon = folder.icon
        const count =
          folder.key === ALL_KEY
            ? totalCount
            : statusCounts[folder.key as keyof typeof statusCounts] ?? 0
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
