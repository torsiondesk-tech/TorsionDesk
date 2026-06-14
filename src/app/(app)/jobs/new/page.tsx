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
  ] = await Promise.all([
    listJobCategories(orgId),
    listJobSources(orgId),
    listTaxItems(orgId),
    listTags(orgId),
    listProductCategories(orgId),
    listOrgMembers(orgId),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New Job</h1>
      <JobForm
        mode="create"
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
          contactId: params.contactId,
          locationId: params.locationId,
        }}
      />
    </div>
  )
}
