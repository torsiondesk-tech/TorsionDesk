import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { listTags, listReferralSources } from '@/lib/tags'
import { listProductCategories } from '@/lib/catalog'
import { getCustomerById } from '@/lib/customers'
import { Badge } from '@/components/ui/badge'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import {
  getEstimateAction,
  listJobCategories,
  listTaxItems,
  listOrgMembers,
  listEstimateTemplatesAction,
  listSalesRepsAction,
} from '../actions'
import { EstimateDetailShell } from './estimate-detail-shell'

interface EstimateDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

export default async function EstimateDetailPage({ params, searchParams }: EstimateDetailPageProps) {
  const { orgId, userId, orgRole } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const { id } = await params
  const { edit } = await searchParams
  const initialEdit = edit === 'true'

  const estimateData = await getEstimateAction(orgId, id)
  if (!estimateData) notFound()

  const customer = estimateData.estimate.customerId
    ? await getCustomerById(orgId, estimateData.estimate.customerId)
    : null

  const [
    jobCategories,
    referralSources,
    taxItems,
    availableTags,
    productCategories,
    orgMembers,
    salesReps,
    templates,
  ] = await Promise.all([
    listJobCategories(orgId),
    listReferralSources(orgId),
    listTaxItems(orgId),
    listTags(orgId),
    listProductCategories(orgId),
    listOrgMembers(orgId),
    listSalesRepsAction(orgId),
    listEstimateTemplatesAction(orgId),
  ])

  const initial = {
    ...estimateData,
    customerName: customer?.name ?? null,
  }

  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Estimate #{`EST-${estimateData.estimate.estimateNo ?? ''}`}
        </h1>
        <Badge variant={estimateStatusBadgeVariant(estimateData.estimate.status)}>
          {estimateStatusLabel(estimateData.estimate.status)}
        </Badge>
        {customer && (
          <Link
            href={`/customers/${customer.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {customer.name}
          </Link>
        )}
      </div>

      {estimateData.convertedJobs && estimateData.convertedJobs.length > 0 && (
        <p className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-foreground">Converted to:</span>
          {estimateData.convertedJobs.map((job, i) => (
            <span key={job.id} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">,</span>}
              <Link
                href={`/jobs/${job.id}`}
                className="font-medium underline hover:text-foreground"
              >
                Job #{`JOB-${job.jobNo}`}
              </Link>
            </span>
          ))}
        </p>
      )}

      <EstimateDetailShell
        orgId={orgId}
        userId={userId}
        role={orgRole}
        estimateId={id}
        initial={initial}
        referenceData={{
          jobCategories,
          referralSources,
          taxItems,
          availableTags,
          productCategories,
          orgMembers,
          salesReps,
        }}
        estimateTemplates={templates}
        initialEdit={initialEdit}
      />
    </div>
  )
}
