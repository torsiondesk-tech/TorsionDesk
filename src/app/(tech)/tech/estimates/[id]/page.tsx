'use client'

import { useParams } from 'next/navigation'
import { useTechContext } from '../../../components/sync-provider'
import { EstimateDetail } from '../../../components/estimate-detail'

export default function TechEstimateDetailPage() {
  const { orgId, userId } = useTechContext()
  const params = useParams()
  const id = params.id as string
  return <EstimateDetail orgId={orgId} userId={userId} estimateId={id} />
}
