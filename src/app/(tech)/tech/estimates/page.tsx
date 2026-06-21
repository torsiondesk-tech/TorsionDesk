'use client'

import { useTechContext } from '../../components/sync-provider'
import { EstimateList } from '../../components/estimate-list'

export default function TechEstimatesPage() {
  const { orgId, userId } = useTechContext()
  return <EstimateList orgId={orgId} userId={userId} />
}
