import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { JobForm } from '../[id]/job-form'
import {
  listJobCategories,
  listJobSources,
  listTaxItems,
  listOrgMembers,
} from '../actions'
import { listTags } from '@/lib/tags'
import { listProductCategories } from '@/lib/catalog'
import { getCustomerById } from '@/lib/customers'

interface NewJobPageProps {
  searchParams: Promise<{
    customerId?: string
    contactId?: string
    locationId?: string
  }>
}

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams

  const [
    jobCategories,
    jobSources,
    taxItems,
    availableTags,
    productCategories,
    orgMembers,
    prefilledCustomer,
  ] = await Promise.all([
    listJobCategories(orgId),
    listJobSources(orgId),
    listTaxItems(orgId),
    listTags(orgId),
    listProductCategories(orgId),
    listOrgMembers(orgId),
    params.customerId ? getCustomerById(orgId, params.customerId) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New Job</h1>
      <JobForm
        mode="create"
        orgId={orgId}
        referenceData={{
          jobCategories,
          jobSources,
          taxItems,
          availableTags,
          productCategories,
          orgMembers,
        }}
        defaults={{
          customerId: params.customerId,
          customerName: prefilledCustomer?.name,
          contactId: params.contactId,
          locationId: params.locationId ?? prefilledCustomer?.primaryLocationId ?? undefined,
        }}
      />
    </div>
  )
}
