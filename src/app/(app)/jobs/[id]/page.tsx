import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { getJob } from '@/lib/jobs/jobs'
import { getJobPhotoSignedUrls } from '@/lib/jobs/photos'
import { getJobSignatureSignedUrls } from '@/lib/jobs/signatures'
import {
  listJobCategories,
  listJobSources,
  listTaxItems,
  listOrgMembers,
  listSalesReps,
} from '../actions'
import { listTags } from '@/lib/tags'
import { listProductCategories } from '@/lib/catalog'
import { JobForm, type JobFormData } from './job-form'
import { JobDetailShell } from './job-detail-shell'
import { EquipmentTab } from './tabs/equipment-tab'
import { PicsTab } from './tabs/pics-tab'
import { SignTab } from './tabs/sign-tab'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  statusBadgeVariant,
  statusLabel,
} from '@/lib/jobs/transitions'
import { toISODate } from '@/lib/utils'
import { withTenant } from '@/db/with-tenant'
import { invoices } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

async function getInvoiceForJob(
  orgId: string,
  jobId: string,
): Promise<{ id: string; invoiceNo: number; invoiceDate: string | null } | null> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        id: invoices.id,
        invoiceNo: invoices.invoiceNo,
        invoiceDate: invoices.invoiceDate,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, orgId),
          eq(invoices.jobId, jobId),
          eq(invoices.status, 'active'),
        ),
      )
      .orderBy(desc(invoices.createdAt))
      .limit(1)
    return row
      ? {
          id: row.id,
          invoiceNo: row.invoiceNo,
          invoiceDate: row.invoiceDate
            ? String(row.invoiceDate).slice(0, 10)
            : null,
        }
      : null
  })
}

interface JobDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

/** Extract YYYY-MM-DD for a `type="date"` input.
 *
 * Server-returned `Date` objects for `timestamp` columns are at UTC midnight.
 * In US timezones, local getters would shift the day, so we read the UTC calendar
 * date via `.toISOString().slice(0, 10)`. String inputs (already YYYY-MM-DD) are
 * sliced directly. Local-midnight Dates (e.g. from `new Date(y,m,d)`) use local
 * getters so the intended local calendar day is preserved.
 */
function toDateInputValue(d: Date | string | null): string | null {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 10)
  // Server UTC midnight Date → read UTC calendar day.
  const isUtcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  return isUtcMidnight ? d.toISOString().slice(0, 10) : toISODate(d)
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

/** Extract HH:MM for a `type="time"` input from a full Date/string.
 *
 * Arrival window timestamps are stored as UTC clock-time (Z suffix on write).
 * Extract UTC digits so the form shows the same digits the user typed, regardless
 * of the server's local timezone.
 */
function toTimeInputValue(d: Date | string | null): string | null {
  if (!d) return null
  const date = new Date(d)
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  return `${h}:${min}`
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
    arrivalWindowStart: toTimeInputValue(job.arrivalWindowStart),
    arrivalWindowEnd: toTimeInputValue(job.arrivalWindowEnd),
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
      title: li.title ?? null,
      description: li.description ?? '',
      qty: String(li.qty ?? '1'),
      rate: String(li.rate ?? '0'),
      cost: String(li.cost ?? '0'),
      taxItemId: li.taxItemId,
      groupId: li.groupId ?? null,
    })),
    lineItemGroups: job.lineItemGroups.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder ?? 0,
    })),
    contact: job.contact
      ? {
          id: job.contact.id,
          firstName: job.contact.firstName,
          lastName: job.contact.lastName ?? '',
          jobTitle: '',
          phones: job.contact.phones.map((p) => ({
            id: p.id,
            number: p.number,
            type: p.type,
            isPrimary: p.isPrimary ?? false,
          })),
          emails: job.contact.emails.map((e) => ({
            id: e.id,
            address: e.address,
            type: e.type,
            isPrimary: e.isPrimary ?? false,
          })),
          smsConsent: false,
          billingContact: false,
          bookingContact: false,
        }
      : undefined,
  }
}

export default async function JobDetailPage({ params, searchParams }: JobDetailPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const { id } = await params
  const { edit } = await searchParams
  const initialEdit = edit === 'true'
  const job = await getJob(orgId, id)
  if (!job) notFound()

  const [
    jobCategories,
    jobSources,
    taxItems,
    availableTags,
    productCategories,
    orgMembers,
    salesReps,
    photoUrls,
    signatureUrls,
  ] = await Promise.all([
    listJobCategories(orgId),
    listJobSources(orgId),
    listTaxItems(orgId),
    listTags(orgId),
    listProductCategories(orgId),
    listOrgMembers(orgId),
    listSalesReps(orgId),
    getJobPhotoSignedUrls(orgId, id),
    getJobSignatureSignedUrls(orgId, id),
  ])

  const initial = mapJobToFormData(job)
  const invoice = await getInvoiceForJob(orgId, id)

  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          #{`JOB-${job.jobNo}`}
        </h1>
        <Badge variant={statusBadgeVariant(job.status)}>
          {statusLabel(job.status)}
        </Badge>
        {job.customerId ? (
          <Link
            href={`/customers/${job.customerId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {job.customerName}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{job.customerName}</span>
        )}
      </div>
      {job.estimateId && job.estimateNo != null && (
        <p className="text-sm">
          <span className="text-muted-foreground">Converted from </span>
          <Link
            href={`/estimates/${job.estimateId}`}
            className="font-medium underline hover:text-foreground"
          >
            Estimate #{`EST-${job.estimateNo}`}
          </Link>
        </p>
      )}

      {invoice && (
        <p className="text-sm">
          <span className="text-muted-foreground">Invoiced as </span>
          <Link
            href={`/invoices/${invoice.id}`}
            className="font-medium underline hover:text-foreground"
          >
            #{`INV-${invoice.invoiceNo}`}
          </Link>
          {invoice.invoiceDate && (
            <span className="text-muted-foreground">
              {' '}
              (created {new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              )
            </span>
          )}
        </p>
      )}

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
          <JobDetailShell
            orgId={orgId}
            job={job}
            initial={initial}
            referenceData={{
              jobCategories,
              jobSources,
              taxItems,
              availableTags,
              productCategories,
              orgMembers,
              salesReps,
            }}
            orgMembers={orgMembers}
            categoryName={
              jobCategories.find((c) => c.id === job.categoryId)?.name
            }
            sourceName={jobSources.find((s) => s.id === job.jobSourceId)?.name}
            initialEdit={initialEdit}
            invoice={invoice}
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
          <SignTab jobId={job.id} signatures={signatureUrls} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
