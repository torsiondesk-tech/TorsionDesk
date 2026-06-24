import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listStatusColors } from '@/lib/settings'
import { StatusColorsClient } from './status-colors-client'

export default async function StatusColorsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const colors = await listStatusColors(orgId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">Job Status Colors</h1>
        <p className="text-sm text-muted-foreground">
          Customize the background, text, and border colors for each job status
          on the dispatch board. Every status gets its own color so you can see
          state at a glance.
        </p>
      </div>

      <StatusColorsClient initialColors={colors} />
    </div>
  )
}
