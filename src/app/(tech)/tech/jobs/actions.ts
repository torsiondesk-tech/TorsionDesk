'use server'

import { auth } from '@clerk/nextjs/server'
import { listJobs } from '@/lib/jobs/jobs'
import { toISODate } from '@/lib/utils'
import { transitionJobStatusAction as _transitionJobStatusAction } from '@/app/(app)/jobs/actions'

export async function transitionJobStatusAction(jobId: string, toStatus: string) {
  return _transitionJobStatusAction(jobId, toStatus)
}

export async function listTechJobsAction(orgId: string, userId: string) {
  const { orgId: sessionOrgId, userId: sessionUserId } = await auth()
  if (!sessionOrgId || !sessionUserId) {
    throw new Error('Not authenticated')
  }
  if (sessionOrgId !== orgId || sessionUserId !== userId) {
    throw new Error('Unauthorized')
  }

  const today = toISODate(new Date())
  const sevenDaysOutDate = new Date()
  sevenDaysOutDate.setDate(sevenDaysOutDate.getDate() + 7)

  return listJobs(orgId, {
    assigneeUserId: userId,
    dateFrom: today,
    dateTo: toISODate(sevenDaysOutDate),
    pageSize: 100,
  })
}
