import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listPaymentMethodsAction } from '@/app/(app)/payments/actions'
import { PaymentMethodsList } from './payment-methods-list'

/**
 * Payment Methods settings page (SET-08).
 *
 * Server component: reads all payment methods for the active tenant,
 * then renders the client list with add/edit/delete/reorder dialogs.
 * Admin controls are gated behind isAdmin (orgRole === 'org:admin').
 */
export default async function PaymentMethodsPage() {
  const { orgId, orgRole } = await auth()
  if (!orgId) {
    redirect('/sign-in')
  }

  const isAdmin = orgRole === 'org:admin'
  const methods = await listPaymentMethodsAction(orgId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">Payment Methods</h1>
        <p className="text-sm text-muted-foreground">
          Configure the methods that appear when recording payments and deposits.
        </p>
      </div>

      <PaymentMethodsList orgId={orgId} initialMethods={methods.methods} isAdmin={isAdmin} />
    </div>
  )
}
