'use client'

import { useTechContext } from '../../../components/sync-provider'
import { TechNewCustomerForm } from '../../../components/tech-new-customer-form'

export default function TechCustomerNewPage() {
  const { orgId } = useTechContext()
  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <h1 className="text-lg font-semibold">New Customer</h1>
      <TechNewCustomerForm orgId={orgId} />
    </div>
  )
}
