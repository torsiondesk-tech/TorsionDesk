import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { listTags } from '@/lib/tags'
import { listProductCategories } from '@/lib/catalog'
import { getCustomerById } from '@/lib/customers'
import {
  getEstimateAction,
  listJobCategories,
  listJobSources,
  listTaxItems,
  listOrgMembers,
  listEstimateTemplatesAction,
  listSalesRepsAction,
} from '../actions'
import { EstimateForm } from './estimate-form'
import { EstimateTasks } from './estimate-tasks'

interface EstimateDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function EstimateDetailPage({ params }: EstimateDetailPageProps) {
  const { orgId, userId, orgRole } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const { id } = await params
  const estimateData = await getEstimateAction(orgId, id)
  if (!estimateData) notFound()

  const customer = estimateData.estimate.customerId
    ? await getCustomerById(orgId, estimateData.estimate.customerId)
    : null

  const [
    jobCategories,
    jobSources,
    taxItems,
    availableTags,
    productCategories,
    orgMembers,
    salesReps,
    templates,
  ] = await Promise.all([
    listJobCategories(orgId),
    listJobSources(orgId),
    listTaxItems(orgId),
    listTags(orgId),
    listProductCategories(orgId),
    listOrgMembers(orgId),
    listSalesRepsAction(orgId),
    listEstimateTemplatesAction(orgId),
  ])

  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      <EstimateForm
        mode="edit"
        orgId={orgId}
        userId={userId}
        role={orgRole}
        estimateId={id}
        initial={{
          ...estimateData,
          customerName: customer?.name ?? null,
        }}
        referenceData={{
          jobCategories,
          jobSources,
          taxItems,
          availableTags,
          productCategories,
          orgMembers,
          salesReps,
        }}
        estimateTemplates={templates}
      />

      <EstimateTasks
        estimateId={id}
        tasks={estimateData.tasks.map((t) => ({
          id: t.id,
          label: t.label,
          done: t.done,
        }))}
        reminders={estimateData.reminders.map((r) => ({
          id: r.id,
          remindAt: r.remindAt,
          note: r.note,
          done: r.done,
        }))}
      />
    </div>
  )
}
