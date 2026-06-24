import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listTechnicians, getWeekJobs, getWeekEstimates, getPoolEstimates, getPoolJobs, countPoolJobs } from './actions'
import { DispatchBoard } from './board'
import { listStatusColors, listEstimateStatusColors } from '@/lib/settings'
import type { StatusColorMap } from './contexts/status-color-context'
import type { EstimateStatusColorMap } from './contexts/estimate-status-color-context'
import type { JobStatusValue } from '@/lib/jobs/transitions'
import type { EstimateStatusValue } from '@/lib/estimates/status'
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

  const [technicians, jobs, weekEstimates, poolEstimates, poolJobs, counts, colorRows, estimateColorRows] = await Promise.all([
    listTechnicians(),
    getWeekJobs(orgId, weekStart, weekEnd),
    getWeekEstimates(orgId, weekStart, weekEnd),
    getPoolEstimates(orgId),
    getPoolJobs(orgId),
    countPoolJobs(orgId),
    listStatusColors(orgId),
    listEstimateStatusColors(orgId),
  ])

  const colorMap: StatusColorMap = {} as StatusColorMap
  for (const row of colorRows) {
    colorMap[row.status as JobStatusValue] = {
      bgColor: row.bgColor,
      textColor: row.textColor,
      borderColor: row.borderColor,
    }
  }

  const estimateColorMap: EstimateStatusColorMap = {} as EstimateStatusColorMap
  for (const row of estimateColorRows) {
    estimateColorMap[row.status as EstimateStatusValue] = {
      bgColor: row.bgColor,
      textColor: row.textColor,
      borderColor: row.borderColor,
    }
  }

  return (
    <DispatchBoard
      technicians={technicians}
      jobs={jobs}
      estimates={weekEstimates}
      poolEstimates={poolEstimates}
      poolJobs={poolJobs}
      counts={counts}
      weekStart={weekStart}
      weekEnd={weekEnd}
      colorMap={colorMap}
      estimateColorMap={estimateColorMap}
    />
  )
}
