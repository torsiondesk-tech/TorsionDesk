import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { CustomerForm } from '../customer-form'
import { getCustomerById, getCustomerTagNames } from '@/lib/customers'
import { listTags, listReferralSources } from '@/lib/tags'

interface EditCustomerPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const { id } = await params
  const customer = await getCustomerById(orgId, id)
  if (!customer) notFound()

  const [availableTags, referralOptions, tagNames] = await Promise.all([
    listTags(orgId),
    listReferralSources(orgId),
    getCustomerTagNames(orgId, id),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit Customer</h1>
      <CustomerForm
        mode="edit"
        initial={{
          id: customer.id,
          name: customer.name,
          vip: customer.vip ?? false,
          active: customer.active ?? true,
          parentCustomerId: customer.parentCustomerId,
          assignedAgentId: customer.assignedAgentId,
          referralSourceId: customer.referralSourceId,
          internalNotes: customer.internalNotes ?? undefined,
          publicNotes: customer.publicNotes ?? undefined,
          tagIds: tagNames,
        }}
        availableTags={availableTags}
        referralOptions={referralOptions}
      />
    </div>
  )
}
