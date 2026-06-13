import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ServiceForm } from '../service-form'
import { listProductCategories } from '@/lib/catalog'

export default async function NewServicePage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const categories = await listProductCategories(orgId)

  return (
    <div className="space-y-6">
      <ServiceForm mode="create" categories={categories} />
    </div>
  )
}
