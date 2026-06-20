import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { TechJobsList } from '../../components/tech-jobs-list'
import { listJobs } from '@/lib/jobs/jobs'

export default async function TechJobsPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  const { rows } = await listJobs(orgId, { assigneeUserId: userId, pageSize: 200 })
  return <TechJobsList orgId={orgId} userId={userId} initialRows={rows} />
}
