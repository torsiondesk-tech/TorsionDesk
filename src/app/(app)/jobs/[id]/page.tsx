import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { getJob } from '@/lib/jobs/jobs'
import { getJobPhotoSignedUrls } from '@/lib/jobs/photos'
import {
  listJobCategories,
  listJobSources,
  listTaxItems,
  listOrgMembers,
} from '../actions'
import { listTags } from '@/lib/tags'
import { listProductCategories } from '@/lib/catalog'
import { JobForm, type JobFormData } from './job-form'
import { EquipmentTab } from './tabs/equipment-tab'
import { PicsTab } from './tabs/pics-tab'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { STATUS_GROUPS } from '@/lib/jobs/transitions'

interface JobDetailPageProps {
  params: Promise<{ id: string }>
}

function statusBadgeVariant(status: string) {
  const open = STATUS_GROUPS.open as readonly string[]
  const inProgress = STATUS_GROUPS.in_progress as readonly string[]
  const closed = STATUS_GROUPS.closed as readonly string[]

  if (status === 'cancelled') return 'destructive'
  if (open.includes(status)) return 'outline'
  if (inProgress.includes(status)) return 'default'
  if (closed.includes(status)) return 'secondary'
  return 'outline'
}

function statusLabel(status: string) {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function toDateInputValue(d: Date | string | null): string | null {
  if (!d) return null
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toDateTimeLocalValue(d: Date | string | null): string | null {
  if (!d) return null
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function mapJobToFormData(job: Awaited<ReturnType<typeof getJob>>): JobFormData {
  if (!job) throw new Error('mapJobToFormData: job is null')

  return {
    id: job.id,
    customerId: job.customerId,
    customerName: job.customerName,
    contactId: job.contactId,
    serviceLocationId: job.serviceLocationId,
    categoryId: job.categoryId,
    description: job.description,
    poNumber: job.poNumber,
    jobSourceId: job.jobSourceId,
    assignedAgentId: job.assignedAgentId,
    status: job.status,
    billingType: job.billingType,
    priority: job.priority,
    startDate: toDateInputValue(job.startDate),
    endDate: toDateInputValue(job.endDate),
    arrivalWindowStart: toDateTimeLocalValue(job.arrivalWindowStart),
    arrivalWindowEnd: toDateTimeLocalValue(job.arrivalWindowEnd),
    estimatedDuration: job.estimatedDuration,
    multiDay: job.multiDay ?? false,
    requiresFollowUp: job.requiresFollowUp ?? false,
    isRepeating: job.isRepeating ?? false,
    repeatFrequency: job.repeatFrequency,
    repeatEndDate: toDateInputValue(job.repeatEndDate),
    notesForTechs: job.notesForTechs,
    completionNotes: job.completionNotes,
    tagIds: job.tags.map((t) => t.id),
    assigneeUserIds: job.assignees.map((a) => a.userId),
    lineItems: job.lineItems.map((li) => ({
      id: li.id,
      type: (li.type ?? 'product') as 'product' | 'service' | 'discount' | 'expense',
      refId: li.refId,
      description: li.description ?? '',
      qty: String(li.qty ?? '1'),
      rate: String(li.rate ?? '0'),
      cost: String(li.cost ?? '0'),
      taxItemId: li.taxItemId,
    })),
  }
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const { id } = await params
  const job = await getJob(orgId, id)
  if (!job) notFound()

  const [
    jobCategories,
    jobSources,
    taxItems,
    availableTags,
    productCategories,
    orgMembers,
    photoUrls,
  ] = await Promise.all([
    listJobCategories(orgId),
    listJobSources(orgId),
    listTaxItems(orgId),
    listTags(orgId),
    listProductCategories(orgId),
    listOrgMembers(orgId),
    getJobPhotoSignedUrls(orgId, id),
  ])

  const initial = mapJobToFormData(job)

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in-0 duration-300 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          #{`JOB-${job.jobNo}`}
        </h1>
        <Badge variant={statusBadgeVariant(job.status) as any}>
          {statusLabel(job.status)}
        </Badge>
        <span className="text-sm text-muted-foreground">{job.customerName}</span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="custom_fields">Custom Fields</TabsTrigger>
          <TabsTrigger value="pics">Pics</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="sign">Sign</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <JobForm
            mode="edit"
            initial={initial}
            referenceData={{
              jobCategories,
              jobSources,
              taxItems,
              availableTags,
              productCategories,
              orgMembers,
            }}
          />
        </TabsContent>

        <TabsContent value="custom_fields">
          <div className="rounded-xl border bg-card p-6">
            <p className="text-muted-foreground">Coming in a later release.</p>
          </div>
        </TabsContent>

        <TabsContent value="pics">
          <PicsTab jobId={id} photos={photoUrls} />
        </TabsContent>

        <TabsContent value="docs">
          <div className="rounded-xl border bg-card p-6">
            <p className="text-muted-foreground">Coming in a later release.</p>
          </div>
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentTab serviceLocationId={job.serviceLocationId} />
        </TabsContent>

        <TabsContent value="sign">
          <div className="rounded-xl border bg-card p-6">
            <p className="text-muted-foreground">Coming in a later release.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
