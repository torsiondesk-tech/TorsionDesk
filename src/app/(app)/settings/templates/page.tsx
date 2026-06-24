import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listJobTemplates } from '@/lib/job-templates'
import { listJobCategories } from '@/app/(app)/jobs/actions'
import { listEstimateTemplates } from '@/lib/estimates/templates'
import { TemplatesPage } from './template-form'

export default async function TemplatesRoutePage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const [templates, estimateTemplates, jobCategories] = await Promise.all([
    listJobTemplates(orgId),
    listEstimateTemplates(orgId),
    listJobCategories(orgId),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Templates</h2>
        <p className="text-sm text-muted-foreground">
          Reusable templates that speed up creating jobs and estimates.
        </p>
      </div>
      <TemplatesPage
        orgId={orgId}
        initialTemplates={templates}
        initialEstimateTemplates={estimateTemplates}
        jobCategories={jobCategories}
      />
    </div>
  )
}
