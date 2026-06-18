import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { EstimateDetail } from '../../../components/estimate-detail'

interface TechEstimateDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TechEstimateDetailPage({
  params,
}: TechEstimateDetailPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  const { id } = await params
  return <EstimateDetail orgId={orgId} userId={userId} estimateId={id} />
}