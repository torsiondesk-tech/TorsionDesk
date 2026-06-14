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

  const [
    customerWithContacts,
    locationsWithEquipment,
    events,
    tagNames,
    availableTags,
    referralOptions,
    customerJobs,
  ] = await Promise.all([
    getCustomerWithContacts(orgId, id),
    getCustomerWithLocationsAndEquipment(orgId, id),
    getCustomerEvents(orgId, id),
    getCustomerTagNames(orgId, id),
    listTags(orgId),
    listReferralSources(orgId),
    listJobs(orgId, { customerId: id, pageSize: 100 }),
  ])

  if (!customerWithContacts) notFound()

  const customer = customerWithContacts
  const contacts = customerWithContacts.contactList
  const locations = locationsWithEquipment?.locations ?? []

  // Fetch parent customer name if needed
  let parentCustomerLabel: string | undefined
  if (customer.parentCustomerId) {
    const parent = await getCustomerById(orgId, customer.parentCustomerId)
    parentCustomerLabel = parent?.name
  }

  return (
    <CustomerDetailForm
      customer={customer}
      contacts={contacts}
      locations={locations}
      tagNames={tagNames}
      events={events}
      availableTags={availableTags}
      referralOptions={referralOptions}
      parentCustomerLabel={parentCustomerLabel}
      jobs={customerJobs.rows}
    />
  )
}
