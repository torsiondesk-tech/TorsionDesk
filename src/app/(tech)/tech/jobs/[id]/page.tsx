import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { TechJobDetailClient } from '../../../components/tech-job-detail-client'

export default async function TechJobDetailPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')
  return <TechJobDetailClient orgId={orgId} userId={userId} />
}
