import { unstable_cache } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { TechJobsList } from '../../components/tech-jobs-list'
import { listJobs } from '@/lib/jobs/jobs'

const getCachedTechJobs = unstable_cache(
  async (orgId: string, userId: string) => {
    const { rows } = await listJobs(orgId, { assigneeUserId: userId, pageSize: 200 })
    return rows
  },
  ['tech-jobs-list'],
  { revalidate: 60 },
)

export default async function TechJobsPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  const rows = await getCachedTechJobs(orgId, userId)
  return <TechJobsList orgId={orgId} userId={userId} initialRows={rows} />
}
