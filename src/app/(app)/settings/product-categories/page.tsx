import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listProductCategories } from '@/lib/categories'
import { CategoryForm } from './category-form'

/**
 * Product Categories settings page (CAT-05).
 *
 * Server component: reads all flat product categories for the active tenant,
 * then renders the client form with the list + add/edit/delete dialogs.
 */
export default async function ProductCategoriesPage() {
  const { orgId } = await auth()
  if (!orgId) {
    redirect('/sign-in')
  }

  const categories = await listProductCategories(orgId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">Product Categories</h1>
        <p className="text-sm text-muted-foreground">
          Configure flat categories for products and services. These appear in the
          catalog and on job forms.
        </p>
      </div>

      <CategoryForm initialCategories={categories} />
    </div>
  )
}
