import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { TechJobForm } from '../../../components/tech-job-form'

export default async function TechJobNewPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <h1 className="text-lg font-semibold">New Job</h1>
      <TechJobForm orgId={orgId} userId={userId} />
    </div>
  )
}
