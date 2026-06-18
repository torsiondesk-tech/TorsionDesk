import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Briefcase } from 'lucide-react'
import { listJobs } from '@/lib/jobs/jobs'
import { toISODate } from '@/lib/utils'
import { groupJobsByDay } from '../../lib/group-jobs'
import { JobListCard } from '../../components/job-list-card'

export default async function TechJobsPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  const today = toISODate(new Date())
  const sevenDaysOutDate = new Date()
  sevenDaysOutDate.setDate(sevenDaysOutDate.getDate() + 7)
  const sevenDaysOut = toISODate(sevenDaysOutDate)

  const { rows } = await listJobs(orgId, {
    assigneeUserId: userId,
    dateFrom: today,
    dateTo: sevenDaysOut,
    pageSize: 100,
  })

  const groups = groupJobsByDay(rows, today)

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <Briefcase className="size-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">No jobs assigned</h1>
        <p className="mt-2 max-w-sm text-base text-muted-foreground">
          You&apos;re all caught up. Pull down to refresh when the office dispatches a new job.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {groups.map((group) => (
        <section key={group.date} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
          <div className="flex flex-col gap-3">
            {group.jobs.map((job) => (
              <JobListCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
