import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ProductForm } from '../product-form'
import { listProductCategories } from '@/lib/catalog'

export default async function NewProductPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const categories = await listProductCategories(orgId)

  return (
    <div className="space-y-6">
      <ProductForm mode="create" categories={categories} />
    </div>
  )
}
