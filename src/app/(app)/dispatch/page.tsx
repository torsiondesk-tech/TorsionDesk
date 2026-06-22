import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listTechnicians, getWeekJobs, getPoolJobs, countPoolJobs } from './actions'
import { DispatchBoard } from './board'
import { listStatusColors } from '@/lib/settings'
import type { StatusColorMap } from './contexts/status-color-context'
import type { JobStatusValue } from '@/lib/jobs/transitions'
import { toISODate, getMonday } from '@/lib/utils'

interface DispatchPageProps {
  searchParams: Promise<{
    weekStart?: string | string[]
  }>
}

export default async function DispatchPage({ searchParams }: DispatchPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams
  const weekStartParam = Array.isArray(params.weekStart)
    ? params.weekStart[0]
    : params.weekStart

  const anchor = weekStartParam ? new Date(`${weekStartParam}T00:00:00`) : new Date()
  const weekStart = toISODate(getMonday(anchor))

  const weekEndDate = new Date(`${weekStart}T00:00:00`)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEnd = toISODate(weekEndDate)

  const [technicians, jobs, poolJobs, counts, colorRows] = await Promise.all([
    listTechnicians(),
    getWeekJobs(orgId, weekStart, weekEnd),
    getPoolJobs(orgId),
    countPoolJobs(orgId),
    listStatusColors(orgId),
  ])

  const colorMap: StatusColorMap = {} as StatusColorMap
  for (const row of colorRows) {
    colorMap[row.status as JobStatusValue] = {
      bgColor: row.bgColor,
      textColor: row.textColor,
      borderColor: row.borderColor,
    }
  }

  return (
    <DispatchBoard
      technicians={technicians}
      jobs={jobs}
      poolJobs={poolJobs}
      counts={counts}
      weekStart={weekStart}
      weekEnd={weekEnd}
      colorMap={colorMap}
    />
  )
}
