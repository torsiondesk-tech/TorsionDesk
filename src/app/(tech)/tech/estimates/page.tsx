import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ClipboardList } from 'lucide-react'

export default async function TechEstimatesPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <ClipboardList className="size-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold">No estimates</h1>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">
        Create an estimate from a completed job, or pull down to refresh.
      </p>
    </div>
  )
}
