import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listEstimateStatusColors } from '@/lib/settings'
import { EstimateStatusColorsClient } from './status-colors-client'

export default async function EstimateStatusColorsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const colors = await listEstimateStatusColors(orgId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">Estimate Status Colors</h1>
        <p className="text-sm text-muted-foreground">
          Customize the background, text, and border colors for each estimate status
          on the dispatch board and estimate pool. Every status gets its own color
          so you can see state at a glance.
        </p>
      </div>

      <EstimateStatusColorsClient initialColors={colors} />
    </div>
  )
}
