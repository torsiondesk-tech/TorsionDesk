import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listTaxItems } from '@/lib/settings'
import { TaxItemsList } from './tax-items-list'

/**
 * Tax Items settings page (SET-07, D-09).
 *
 * Server component: reads all tax items for the active tenant,
 * then renders the client list with add/edit/delete dialogs.
 */
export default async function TaxItemsPage() {
  const { orgId } = await auth()
  if (!orgId) {
    redirect('/sign-in')
  }

  const items = await listTaxItems(orgId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">Tax Items</h1>
        <p className="text-sm text-muted-foreground">
          Configure tax rates that appear on jobs and estimates.
        </p>
      </div>

      <TaxItemsList initialItems={items} />
    </div>
  )
}
