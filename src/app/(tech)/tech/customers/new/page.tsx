import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { TechNewCustomerForm } from '../../../components/tech-new-customer-form'

export default async function TechCustomerNewPage() {
  const { orgId } = await auth()
  if (!orgId) {
    redirect('/sign-in')
  }

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <h1 className="text-lg font-semibold">New Customer</h1>
      <TechNewCustomerForm orgId={orgId} />
    </div>
  )
}
