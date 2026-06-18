'use client'

import * as React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { toISODate } from '@/lib/utils'
import { DayCell } from './day-cell'
import { JobBlock } from './job-block'
import { EstimateBlock } from './estimate-block'
import type { WeekJob, WeekEstimate, Technician } from '../actions'

interface WeekGridProps {
  technicians: Technician[]
  jobs: WeekJob[]
  estimates?: WeekEstimate[]
  weekDates: Date[]
  isLoading?: boolean
  onJobClick?: (job: WeekJob) => void
  onEstimateClick?: (estimate: WeekEstimate) => void
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
}

function sortByWindowStart(
  a: { arrivalWindowStart: Date | string | null },
  b: { arrivalWindowStart: Date | string | null },
): number {
  const toTime = (d: Date | string | null): number => {
    if (!d) return 0
    return d instanceof Date ? d.getTime() : new Date(d).getTime()
  }
  return toTime(a.arrivalWindowStart) - toTime(b.arrivalWindowStart)
}

export function WeekGrid({
  technicians,
  jobs,
  estimates = [],
  weekDates,
  isLoading,
  onJobClick,
  onEstimateClick,
}: WeekGridProps) {
  if (isLoading && technicians.length === 0) {
    return (
      <div className="rounded-lg border">
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (technicians.length === 0) {
    return (
      <div className="rounded-lg border bg-background p-8 text-center">
        <p className="text-sm font-medium text-foreground">No team members found</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          The dispatch board needs at least one organization member.
          Invite a teammate in Settings → Users.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto rounded-lg border">
      <div
        className="grid min-h-full"
        style={{
          gridTemplateColumns: '200px repeat(7, minmax(160px, 1fr))',
          gridTemplateRows: `auto repeat(${technicians.length}, minmax(180px, 1fr))`,
        }}
      >
        {/* Sticky header row — compact, content-sized */}
        <div className="sticky top-0 z-20 bg-background border-b border-r px-2 py-1.5 text-sm font-medium flex items-center">
          Technician
        </div>
        {weekDates.map((d, i) => (
          <div
            key={i}
            className="sticky top-0 z-20 bg-background border-b px-2 py-1.5 text-sm font-medium text-center flex items-center justify-center"
          >
            {formatDayHeader(d)}
          </div>
        ))}

        {/* Body rows */}
        {technicians.map((tech) => (
          <React.Fragment key={tech.userId}>
            <div className="sticky left-0 z-10 bg-background border-b border-r p-2 text-sm flex items-center">
              {tech.name}
            </div>
            {weekDates.map((d) => {
              const dateStr = toISODate(d)
              const cellJobs = jobs
                .filter(
                  (j) =>
                    j.techIds.includes(tech.userId) &&
                    j.startDate &&
                    (!j.endDate
                      ? dateStr === toISODate(j.startDate)
                      : dateStr >= toISODate(j.startDate) && dateStr <= toISODate(j.endDate)),
                )
                .sort(sortByWindowStart)

              const cellEstimates = estimates
                .filter(
                  (e) =>
                    e.techIds.includes(tech.userId) &&
                    e.startDate &&
                    (!e.endDate
                      ? dateStr === toISODate(e.startDate)
                      : dateStr >= toISODate(e.startDate) && dateStr <= toISODate(e.endDate)),
                )
                .sort(sortByWindowStart)

              return (
                <DayCell key={`${tech.userId}:${dateStr}`} techId={tech.userId} date={dateStr}>
                  {cellJobs.map((job) => (
                    <JobBlock
                      key={`${job.id}:${dateStr}`}
                      job={job}
                      cellDate={dateStr}
                      onClick={onJobClick}
                    />
                  ))}
                  {cellEstimates.map((estimate) => (
                    <EstimateBlock
                      key={estimate.id}
                      estimate={estimate}
                      onClick={onEstimateClick}
                    />
                  ))}
                </DayCell>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
