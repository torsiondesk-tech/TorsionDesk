import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { countOpenJobs, listRecentJobs } from '@/lib/jobs/jobs'
import { statusLabel, statusBadgeVariant } from '@/lib/jobs/transitions'

export default async function DashboardPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const [openJobCount, recentJobs] = await Promise.all([
    countOpenJobs(orgId),
    listRecentJobs(orgId, 5),
  ])

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your business at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Open Jobs</CardDescription>
            <CardTitle className="text-3xl font-bold">{openJobCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Active + in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Unpaid Invoices</CardDescription>
            <CardTitle className="text-3xl font-bold">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Available in Phase 7</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Today&apos;s Schedule</CardDescription>
            <CardTitle className="text-3xl font-bold">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Available in Phase 4</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Recent Activity</CardDescription>
            <CardTitle className="text-3xl font-bold">{recentJobs.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Latest jobs created</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent jobs list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Jobs</CardTitle>
          <CardDescription>The 5 most recently created jobs</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentJobs.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <ul className="divide-y">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between px-6 py-3 text-sm hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        #{job.jobNo}
                      </span>
                      <span className="truncate font-medium">{job.customerName ?? '—'}</span>
                    </div>
                    <Badge variant={statusBadgeVariant(job.status)} className="ml-4 shrink-0 text-xs">
                      {statusLabel(job.status)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
