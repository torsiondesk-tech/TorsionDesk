import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { countOpenJobs } from '@/lib/jobs/jobs'

export default async function DashboardPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const openJobCount = await countOpenJobs(orgId)

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
            <CardTitle className="text-3xl font-bold">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Available in Phase 3</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
