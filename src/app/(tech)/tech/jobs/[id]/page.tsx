'use client'

import { useTechContext } from '../../../components/sync-provider'
import { TechJobDetailClient } from '../../../components/tech-job-detail-client'

export default function TechJobDetailPage() {
  const { orgId, userId } = useTechContext()
  return <TechJobDetailClient orgId={orgId} userId={userId} />
}
