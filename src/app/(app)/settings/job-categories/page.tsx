import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listJobCategories } from '@/lib/categories'
import { CategoryForm } from './category-form'

/**
 * Job Categories settings page (SET-01, D-07).
 *
 * Server component: reads all hierarchical job categories for the active tenant,
 * then renders the client form with the list + add/edit/delete dialogs.
 */
export default async function JobCategoriesPage() {
  const { orgId } = await auth()
  if (!orgId) {
    redirect('/sign-in')
  }

  const categories = await listJobCategories(orgId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">Job Categories</h1>
        <p className="text-sm text-muted-foreground">
          Configure hierarchical categories for jobs. Sub-categories appear indented.
        </p>
      </div>

      <CategoryForm initialCategories={categories} />
    </div>
  )
}
