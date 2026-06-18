import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { EstimateForm } from '../../../components/estimate-form'

export default async function TechEstimateNewPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-semibold">New Estimate</h1>
      <EstimateForm orgId={orgId} userId={userId} />
    </div>
  )
}