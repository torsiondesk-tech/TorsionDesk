'use client'

import { useTechContext } from '../../../components/sync-provider'
import { EstimateForm } from '../../../components/estimate-form'

export default function TechEstimateNewPage() {
  const { orgId, userId } = useTechContext()
  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <h1 className="text-lg font-semibold">New Estimate</h1>
      <EstimateForm orgId={orgId} userId={userId} />
    </div>
  )
}
