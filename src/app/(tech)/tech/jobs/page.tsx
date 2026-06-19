import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { TechJobsList } from '../../components/tech-jobs-list'

export default async function TechJobsPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  return <TechJobsList orgId={orgId} userId={userId} />
}
