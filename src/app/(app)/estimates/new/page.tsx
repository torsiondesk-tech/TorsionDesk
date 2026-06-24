import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listTags, listReferralSources } from '@/lib/tags'
import { listProductCategories } from '@/lib/catalog'
import { EstimateForm } from '../[id]/estimate-form'
import {
  listJobCategories,
  listTaxItems,
  listOrgMembers,
  listEstimateTemplatesAction,
  listSalesRepsAction,
} from '../actions'

export default async function NewEstimatePage() {
  const { orgId, userId, orgRole } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const [
    jobCategories,
    referralSources,
    taxItems,
    availableTags,
    productCategories,
    orgMembers,
    salesReps,
    templates,
  ] = await Promise.all([
    listJobCategories(orgId),
    listReferralSources(orgId),
    listTaxItems(orgId),
    listTags(orgId),
    listProductCategories(orgId),
    listOrgMembers(orgId),
    listSalesRepsAction(orgId),
    listEstimateTemplatesAction(orgId),
  ])

  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      <EstimateForm
        mode="create"
        orgId={orgId}
        userId={userId}
        role={orgRole}
        referenceData={{
          jobCategories,
          referralSources,
          taxItems,
          availableTags,
          productCategories,
          orgMembers,
          salesReps,
        }}
        estimateTemplates={templates}
      />
    </div>
  )
}
