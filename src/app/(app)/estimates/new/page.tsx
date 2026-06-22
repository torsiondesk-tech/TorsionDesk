import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listTags } from '@/lib/tags'
import { listProductCategories } from '@/lib/catalog'
import { EstimateForm } from '../[id]/estimate-form'
import {
  listJobCategories,
  listJobSources,
  listTaxItems,
  listOrgMembers,
  listEstimateTemplatesAction,
} from '../actions'

export default async function NewEstimatePage() {
  const { orgId, userId, orgRole } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const [
    jobCategories,
    jobSources,
    taxItems,
    availableTags,
    productCategories,
    orgMembers,
    templates,
  ] = await Promise.all([
    listJobCategories(orgId),
    listJobSources(orgId),
    listTaxItems(orgId),
    listTags(orgId),
    listProductCategories(orgId),
    listOrgMembers(orgId),
    listEstimateTemplatesAction(orgId),
  ])

  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">New Estimate</h1>
        <p className="text-sm text-muted-foreground">Create a new estimate for a customer.</p>
      </div>

      <EstimateForm
        mode="create"
        orgId={orgId}
        userId={userId}
        role={orgRole}
        referenceData={{
          jobCategories,
          jobSources,
          taxItems,
          availableTags,
          productCategories,
          orgMembers,
        }}
        estimateTemplates={templates}
      />
    </div>
  )
}
