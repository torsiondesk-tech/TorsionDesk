import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listJobTemplates } from '@/lib/job-templates'
import { listJobCategories } from '@/app/(app)/jobs/actions'
import { TemplatesPage } from './template-form'

export default async function TemplatesRoutePage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const [templates, jobCategories] = await Promise.all([
    listJobTemplates(orgId),
    listJobCategories(orgId),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Job Templates</h2>
        <p className="text-sm text-muted-foreground">
          Reusable templates that pre-fill line items and tasks when creating jobs.
        </p>
      </div>
      <TemplatesPage initialTemplates={templates} jobCategories={jobCategories} />
    </div>
  )
}
