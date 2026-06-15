import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import {
  getCustomerWithContacts,
  getCustomerWithLocationsAndEquipment,
  getCustomerEvents,
  getCustomerTagNames,
  getCustomerById,
} from '@/lib/customers'
import { listTags, listReferralSources } from '@/lib/tags'
import { listJobs } from '@/lib/jobs/jobs'
import { CustomerDetailForm } from './customer-detail-form'

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const { id } = await params

  // Stage 1: customer is needed before everything else to check existence
  // and to know whether a parent customer fetch is needed.
  const customerWithContacts = await getCustomerWithContacts(orgId, id)
  if (!customerWithContacts) notFound()

  // Stage 2: all remaining fetches in parallel, including conditional parent lookup.
  const [
    locationsWithEquipment,
    events,
    tagNames,
    availableTags,
    referralOptions,
    customerJobs,
    parent,
  ] = await Promise.all([
    getCustomerWithLocationsAndEquipment(orgId, id),
    getCustomerEvents(orgId, id),
    getCustomerTagNames(orgId, id),
    listTags(orgId),
    listReferralSources(orgId),
    listJobs(orgId, { customerId: id, pageSize: 100 }),
    customerWithContacts.parentCustomerId
      ? getCustomerById(orgId, customerWithContacts.parentCustomerId)
      : Promise.resolve(null),
  ])

  const customer = customerWithContacts
  const contacts = customerWithContacts.contactList
  const locations = locationsWithEquipment?.locations ?? []
  const primaryLocationId = locationsWithEquipment?.primaryLocationId ?? null
  const parentCustomerLabel = parent?.name ?? undefined

  return (
    <CustomerDetailForm
      customer={customer}
      contacts={contacts}
      locations={locations}
      primaryLocationId={primaryLocationId}
      tagNames={tagNames}
      events={events}
      availableTags={availableTags}
      referralOptions={referralOptions}
      parentCustomerLabel={parentCustomerLabel}
      jobs={customerJobs.rows}
    />
  )
}
