import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { EstimateList } from '../../components/estimate-list'

export default async function TechEstimatesPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  return <EstimateList orgId={orgId} userId={userId} />
}