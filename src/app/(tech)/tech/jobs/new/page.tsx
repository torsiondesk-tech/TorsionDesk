'use client'

import { useTechContext } from '../../../components/sync-provider'
import { TechJobForm } from '../../../components/tech-job-form'

export default function TechJobNewPage() {
  const { orgId, userId } = useTechContext()
  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <h1 className="text-lg font-semibold">New Job</h1>
      <TechJobForm orgId={orgId} userId={userId} />
    </div>
  )
}
