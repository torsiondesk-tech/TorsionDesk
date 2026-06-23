import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listReferralSources, listJobSources, listSalesReps } from '@/lib/settings'
import { LookupListsClient } from './lookup-lists-client'

/**
 * Lookup Lists settings page (SET-06).
 *
 * Server component: reads referral sources and job sources for the active tenant,
 * then renders the sectioned client page with inline add/edit/delete for each list.
 */
export default async function LookupListsPage() {
  const { orgId } = await auth()
  if (!orgId) {
    redirect('/sign-in')
  }

  const [referralSources, jobSources, salesReps] = await Promise.all([
    listReferralSources(orgId),
    listJobSources(orgId),
    listSalesReps(orgId),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">Lookup Lists</h1>
        <p className="text-sm text-muted-foreground">
          Manage referral sources, job sources, and sales reps that appear in dropdowns across
          the app.
        </p>
      </div>

      <LookupListsClient
        initialReferrals={referralSources}
        initialJobSources={jobSources}
        initialSalesReps={salesReps}
      />
    </div>
  )
}
