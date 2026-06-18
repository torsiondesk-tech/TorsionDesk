import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Briefcase } from 'lucide-react'

export default async function TechJobsPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

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
