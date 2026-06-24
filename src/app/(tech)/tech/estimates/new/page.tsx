'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTechContext } from '../../../components/sync-provider'
import { EstimateForm } from '../../../components/estimate-form'

export default function TechEstimateNewPage() {
  const { orgId, userId } = useTechContext()
  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <Link href="/tech/estimates" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
        <h1 className="text-lg font-semibold">New Estimate</h1>
      </div>
      <EstimateForm orgId={orgId} userId={userId} />
    </div>
  )
}
