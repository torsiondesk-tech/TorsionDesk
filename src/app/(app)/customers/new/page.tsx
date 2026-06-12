import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { CustomerForm } from '../[id]/customer-form'
import { listTags, listReferralSources } from '@/lib/tags'

export default async function NewCustomerPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const [availableTags, referralOptions] = await Promise.all([
    listTags(orgId),
    listReferralSources(orgId),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New Customer</h1>
      <CustomerForm
        mode="create"
        availableTags={availableTags}
        referralOptions={referralOptions}
      />
    </div>
  )
}
