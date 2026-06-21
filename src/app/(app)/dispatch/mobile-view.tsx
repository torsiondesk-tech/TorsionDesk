'use client'

import { useState } from 'react'
import { cn, toISODate } from '@/lib/utils'
import { StatusBadge } from './components/status-badge'
import { useStatusColor } from './contexts/status-color-context'
import type { WeekJob, Technician, PoolCounts } from './actions'

interface MobileDispatchProps {
  technicians: Technician[]
  jobs: WeekJob[]
  poolJobs: WeekJob[]
  counts: PoolCounts
  weekDates: Date[]
  onJobClick: (job: WeekJob) => void
}

function formatWindow(
  start: Date | string | null,
  end: Date | string | null,
): string {
  if (!start) return ''
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const toDate = (d: Date | string | null): Date | null => {
    if (!d) return null
    return d instanceof Date ? d : new Date(d)
  }
  const s = start ? fmt.format(toDate(start)!) : ''
  const e = end ? fmt.format(toDate(end)!) : ''
  return s && e ? `${s} – ${e}` : s || e || ''
}

function jobDateStr(d: Date | string | null): string {
  if (!d) return ''
  return d instanceof Date ? toISODate(d) : String(d).slice(0, 10)
}

function MobileJobRow({
  job,
  onClick,
}: {
  job: WeekJob
  onClick: () => void
}) {
  const color = useStatusColor(job.status)
  const window = formatWindow(job.arrivalWindowStart, job.arrivalWindowEnd)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
    >
      <div
        className="mt-1.5 size-2.5 shrink-0 rounded-full border"
        style={{
          backgroundColor: color.bgColor,
          borderColor: color.borderColor,
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-mono text-xs text-muted-foreground shrink-0">
            #{`JOB-${job.jobNo}`}
          </span>
          <StatusBadge status={job.status} />
        </div>
        <div className="truncate text-sm font-medium">{job.customerName}</div>
        {job.address && (
          <div className="truncate text-xs text-muted-foreground">{job.address}</div>
        )}
        {window && (
          <div className="text-xs text-muted-foreground">{window}</div>
        )}
        {job.description && (
          <div className="truncate text-xs text-muted-foreground opacity-70 mt-0.5">
            {job.description}
          </div>
        )}
      </div>
    </button>
  )
}

export function MobileDispatch({
  technicians,
  jobs,
  poolJobs,
  counts,
  weekDates,
  onJobClick,
}: MobileDispatchProps) {
  const todayStr = toISODate(new Date())
  const defaultDate =
    weekDates.find((d) => toISODate(d) === todayStr) ? todayStr : toISODate(weekDates[0])
  const [selectedDate, setSelectedDate] = useState(defaultDate)

  const dayJobs = jobs.filter((j) => {
    const start = jobDateStr(j.startDate)
    if (!start) return false
    const end = jobDateStr(j.endDate) || start
    return selectedDate >= start && selectedDate <= end
  })

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Day picker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weekDates.map((d) => {
          const ds = toISODate(d)
          const isToday = ds === todayStr
          const isSelected = ds === selectedDate
          const jobCount = jobs.filter((j) => {
            const start = jobDateStr(j.startDate)
            if (!start) return false
            const end = jobDateStr(j.endDate) || start
            return ds >= start && ds <= end
          }).length

          return (
            <button
              key={ds}
              onClick={() => setSelectedDate(ds)}
              className={cn(
                'flex shrink-0 flex-col items-center rounded-lg px-3 py-2 text-xs transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                    ? 'bg-muted ring-1 ring-primary/40 text-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="font-medium">
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="tabular-nums">{d.getDate()}</span>
              {jobCount > 0 && (
                <span
                  className={cn(
                    'mt-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium',
                    isSelected
                      ? 'bg-white/20 text-primary-foreground'
                      : 'bg-primary/15 text-primary',
                  )}
                >
                  {jobCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Scheduled jobs for selected day, grouped by technician */}
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="border-b px-4 py-2.5">
          <span className="text-sm font-semibold">
            Scheduled — {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
          </span>
        </div>
        {dayJobs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No jobs scheduled for this day.
          </p>
        ) : (
          technicians.map((tech) => {
            const techJobs = dayJobs.filter((j) => j.techIds.includes(tech.userId))
            if (techJobs.length === 0) return null
            return (
              <div key={tech.userId} className="border-b last:border-b-0">
                <div className="bg-muted/40 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tech.name}
                </div>
                <div className="divide-y">
                  {techJobs.map((job) => (
                    <MobileJobRow key={job.id} job={job} onClick={() => onJobClick(job)} />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pool — tap to view / assign */}
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Job Pool</span>
          <span className="text-xs text-muted-foreground">{counts.total} total</span>
        </div>
        {poolJobs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Job pool is empty.
          </p>
        ) : (
          <div className="divide-y">
            {poolJobs.map((job) => (
              <MobileJobRow key={job.id} job={job} onClick={() => onJobClick(job)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
