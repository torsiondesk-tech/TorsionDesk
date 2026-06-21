import { eq, and, desc, asc, sql, count, inArray, gte, lte } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  jobs,
  jobLineItems,
  jobTags,
  jobAssignees,
  jobSiteVisits,
  jobTasks,
  jobReminders,
  jobPhotos,
  tags,
  customers,
  contacts,
  contactPhones,
  contactEmails,
  serviceLocations,
  jobCategories,
} from '@/db/schema'
import { STATUS_GROUPS, type JobStatusValue } from './transitions'

export interface ListOpts {
  page?: number
  pageSize?: number
  status?: JobStatusValue
  statusGroup?: 'open' | 'in_progress' | 'closed'
  customerId?: string
  q?: string
  sort?: string
  dir?: 'asc' | 'desc'
  bucket?: string
  tag?: string
  userId?: string
  priority?: string
  categoryId?: string
  assigneeUserId?: string
  dateFrom?: string
  dateTo?: string
}

export interface JobRow {
  id: string
  jobNo: number
  customerId: string
  contactId: string | null
  serviceLocationId: string | null
  customerName: string
  description: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  contactPhone: string | null
  contactEmail: string | null
  contactFirstName: string | null
  contactLastName: string | null
  category: string | null
  priority: string | null
  status: string
  startDate: Date | null
  arrivalWindowStart: Date | null
  arrivalWindowEnd: Date | null
  notesForTechs: string | null
  completionNotes: string | null
  createdAt: Date | null
}

function parseDateInput(value: string | undefined, endOfDay = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`)
  return isNaN(date.getTime()) ? null : date
}

/**
 * List jobs with server-side pagination, filtering, and sorting.
 *
 * D-16: Default scope is Open + In Progress statuses.
 * All queries are wrapped in withTenant for tenant isolation.
 */
export async function listJobs(
  orgId: string,
  opts: ListOpts,
): Promise<{ rows: JobRow[]; pageCount: number }> {
  const page = opts.page ?? 0
  const pageSize = opts.pageSize ?? 25

  return withTenant(orgId, async (tx) => {
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof sql> | ReturnType<typeof gte> | ReturnType<typeof lte>> = [
      eq(jobs.tenantId, orgId),
    ]

    // Bucket-level default scope
    if (opts.bucket === 'completed_ready_to_close') {
      conditions.push(eq(jobs.status, 'completed'))
    } else if (opts.bucket === 'to_be_invoiced') {
      conditions.push(eq(jobs.status, 'invoiced'))
    } else if (opts.bucket === 'my_jobs' && opts.userId) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${jobAssignees}
          WHERE ${jobAssignees.jobId} = ${jobs.id}
          AND ${jobAssignees.userId} = ${opts.userId}
          AND ${jobAssignees.tenantId} = ${orgId}
        )`,
      )
    } else if (opts.bucket === 'my_additional_visits') {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${jobSiteVisits}
          WHERE ${jobSiteVisits.jobId} = ${jobs.id}
          AND ${jobSiteVisits.tenantId} = ${orgId}
        )`,
      )
    } else if (opts.bucket !== 'advanced_search') {
      // Default to open + in_progress for all other buckets (including all_open and unknown)
      const openStatuses = [...STATUS_GROUPS.open, ...STATUS_GROUPS.in_progress]
      conditions.push(inArray(jobs.status, openStatuses))
    }

    // Explicit status / status-group filters (used by advanced search and direct URLs)
    if (opts.statusGroup) {
      const groupStatuses = STATUS_GROUPS[opts.statusGroup]
      if (groupStatuses) {
        conditions.push(inArray(jobs.status, groupStatuses))
      }
    } else if (opts.status) {
      conditions.push(eq(jobs.status, opts.status))
    }

    if (opts.customerId) {
      conditions.push(eq(jobs.customerId, opts.customerId))
    }

    if (opts.tag) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${jobTags}
          WHERE ${jobTags.jobId} = ${jobs.id}
          AND ${jobTags.tagId} = ${opts.tag}
          AND ${jobTags.tenantId} = ${orgId}
        )`,
      )
    }

    if (opts.priority) {
      conditions.push(eq(jobs.priority, opts.priority))
    }

    if (opts.categoryId) {
      conditions.push(eq(jobs.categoryId, opts.categoryId))
    }

    if (opts.assigneeUserId) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${jobAssignees}
          WHERE ${jobAssignees.jobId} = ${jobs.id}
          AND ${jobAssignees.userId} = ${opts.assigneeUserId}
          AND ${jobAssignees.tenantId} = ${orgId}
        )`,
      )
    }

    const fromDate = parseDateInput(opts.dateFrom)
    if (fromDate) {
      conditions.push(gte(jobs.startDate, fromDate))
    }

    const toDate = parseDateInput(opts.dateTo, true)
    if (toDate) {
      conditions.push(lte(jobs.startDate, toDate))
    }

    if (opts.q) {
      const term = `%${opts.q}%`
      conditions.push(
        sql`(
          ${jobs.jobNo}::text ILIKE ${term}
          OR ${jobs.description} ILIKE ${term}
          OR ${jobs.poNumber} ILIKE ${term}
          OR EXISTS (
            SELECT 1 FROM ${customers}
            WHERE ${customers.id} = ${jobs.customerId}
            AND ${customers.tenantId} = ${orgId}
            AND ${customers.name} ILIKE ${term}
          )
          OR EXISTS (
            SELECT 1 FROM ${serviceLocations}
            WHERE ${serviceLocations.id} = ${jobs.serviceLocationId}
            AND ${serviceLocations.tenantId} = ${orgId}
            AND ${serviceLocations.city} ILIKE ${term}
          )
        )`,
      )
    }

    // Sort
    const sortDir = opts.dir === 'asc' ? asc : desc
    let order
    switch (opts.sort) {
      case 'jobNo':
        order = sortDir(jobs.jobNo)
        break
      case 'customerName':
        order = sortDir(customers.name)
        break
      case 'priority':
        order = sortDir(jobs.priority)
        break
      case 'category':
        order = sortDir(jobCategories.name)
        break
      case 'city':
        order = sortDir(serviceLocations.city)
        break
      case 'startDate':
        order = sortDir(jobs.startDate)
        break
      default:
        order = desc(jobs.startDate)
        break
    }

    // Count query (same conditions, no joins needed for count)
    const [{ c }] = await tx
      .select({ c: count() })
      .from(jobs)
      .where(and(...conditions))

    const pageCount = Math.ceil(c / pageSize)

    // Main query — paginated job list with display joins
    const rows = await tx
      .select({
        id: jobs.id,
        jobNo: jobs.jobNo,
        customerId: jobs.customerId,
        contactId: jobs.contactId,
        serviceLocationId: jobs.serviceLocationId,
        customerName: customers.name,
        description: jobs.description,
        addressLine1: serviceLocations.addressLine1,
        city: serviceLocations.city,
        state: serviceLocations.state,
        postalCode: serviceLocations.postalCode,
        contactPhone: sql<string | null>`(
          SELECT cp.number FROM contact_phones cp
          WHERE cp.contact_id = ${jobs.contactId}
            AND cp.tenant_id = ${orgId}
          ORDER BY cp.is_primary DESC, cp.created_at ASC
          LIMIT 1
        )`,
        contactEmail: sql<string | null>`(
          SELECT ce.address FROM contact_emails ce
          WHERE ce.contact_id = ${jobs.contactId}
            AND ce.tenant_id = ${orgId}
          ORDER BY ce.is_primary DESC, ce.created_at ASC
          LIMIT 1
        )`,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        category: jobCategories.name,
        priority: jobs.priority,
        status: jobs.status,
        startDate: jobs.startDate,
        arrivalWindowStart: jobs.arrivalWindowStart,
        arrivalWindowEnd: jobs.arrivalWindowEnd,
        notesForTechs: jobs.notesForTechs,
        completionNotes: jobs.completionNotes,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .leftJoin(customers, eq(customers.id, jobs.customerId))
      .leftJoin(serviceLocations, eq(serviceLocations.id, jobs.serviceLocationId))
      .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
      .leftJoin(contacts, eq(contacts.id, jobs.contactId))
      .where(and(...conditions))
      .orderBy(order)
      .limit(pageSize)
      .offset(page * pageSize)

    return { rows: rows as JobRow[], pageCount }
  })
}

export type JobDetail = typeof jobs.$inferSelect & {
  customerName: string
  primaryLocationId: string | null
  primaryContactId: string | null
  contact: {
    id: string
    firstName: string
    lastName: string | null
    phones: { id: string; number: string; type: string; isPrimary: boolean | null }[]
    emails: { id: string; address: string; type: string; isPrimary: boolean | null }[]
  } | null
  serviceLocation: {
    id: string
    name: string | null
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    gated: boolean | null
  } | null
  lineItems: typeof jobLineItems.$inferSelect[]
  tags: typeof tags.$inferSelect[]
  assignees: typeof jobAssignees.$inferSelect[]
  siteVisits: typeof jobSiteVisits.$inferSelect[]
  tasks: typeof jobTasks.$inferSelect[]
  reminders: typeof jobReminders.$inferSelect[]
  photos: typeof jobPhotos.$inferSelect[]
}

/**
 * Fetch a single job by ID with its related data.
 * Tenant-scoped via withTenant.
 */
export async function getJob(
  orgId: string,
  jobId: string,
): Promise<JobDetail | null> {
  return withTenant(orgId, async (tx) => {
    const jobRows = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
      .limit(1)

    const job = jobRows[0]
    if (!job) return null

    const [
      customerRows,
      contactRows,
      contactPhoneRows,
      contactEmailRows,
      locationRows,
      lineItems,
      tagRows,
      assignees,
      siteVisits,
      tasks,
      reminders,
      photos,
    ] = await Promise.all([
      tx
        .select({ name: customers.name, primaryLocationId: customers.primaryLocationId, primaryContactId: customers.primaryContactId })
        .from(customers)
        .where(and(eq(customers.tenantId, orgId), eq(customers.id, job.customerId)))
        .limit(1),
      job.contactId
        ? tx
            .select()
            .from(contacts)
            .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, job.contactId)))
            .limit(1)
        : Promise.resolve([]),
      job.contactId
        ? tx
            .select()
            .from(contactPhones)
            .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.contactId, job.contactId)))
        : Promise.resolve([]),
      job.contactId
        ? tx
            .select()
            .from(contactEmails)
            .where(and(eq(contactEmails.tenantId, orgId), eq(contactEmails.contactId, job.contactId)))
        : Promise.resolve([]),
      job.serviceLocationId
        ? tx
            .select()
            .from(serviceLocations)
            .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, job.serviceLocationId)))
            .limit(1)
        : Promise.resolve([]),
      tx
        .select()
        .from(jobLineItems)
        .where(and(eq(jobLineItems.tenantId, orgId), eq(jobLineItems.jobId, jobId))),
      tx
        .select({
          id: tags.id,
          tenantId: tags.tenantId,
          name: tags.name,
          color: tags.color,
          createdAt: tags.createdAt,
          updatedAt: tags.updatedAt,
        })
        .from(jobTags)
        .innerJoin(tags, eq(jobTags.tagId, tags.id))
        .where(and(eq(jobTags.tenantId, orgId), eq(jobTags.jobId, jobId))),
      tx
        .select()
        .from(jobAssignees)
        .where(and(eq(jobAssignees.tenantId, orgId), eq(jobAssignees.jobId, jobId))),
      tx
        .select()
        .from(jobSiteVisits)
        .where(and(eq(jobSiteVisits.tenantId, orgId), eq(jobSiteVisits.jobId, jobId))),
      tx
        .select()
        .from(jobTasks)
        .where(and(eq(jobTasks.tenantId, orgId), eq(jobTasks.jobId, jobId))),
      tx
        .select()
        .from(jobReminders)
        .where(and(eq(jobReminders.tenantId, orgId), eq(jobReminders.jobId, jobId))),
      tx
        .select()
        .from(jobPhotos)
        .where(and(eq(jobPhotos.tenantId, orgId), eq(jobPhotos.jobId, jobId)))
        .orderBy(desc(jobPhotos.createdAt)),
    ])

    // If the job has no explicit contactId, fall back to the customer's primary contact
    let resolvedContactRows = contactRows
    let resolvedPhoneRows = contactPhoneRows
    let resolvedEmailRows = contactEmailRows
    const fallbackContactId = !job.contactId ? (customerRows[0]?.primaryContactId ?? null) : null
    if (fallbackContactId) {
      ;[resolvedContactRows, resolvedPhoneRows, resolvedEmailRows] = await Promise.all([
        tx
          .select()
          .from(contacts)
          .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, fallbackContactId)))
          .limit(1),
        tx
          .select()
          .from(contactPhones)
          .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.contactId, fallbackContactId))),
        tx
          .select()
          .from(contactEmails)
          .where(and(eq(contactEmails.tenantId, orgId), eq(contactEmails.contactId, fallbackContactId))),
      ])
    }

    const contact = resolvedContactRows[0]
      ? {
          id: resolvedContactRows[0].id,
          firstName: resolvedContactRows[0].firstName,
          lastName: resolvedContactRows[0].lastName,
          phones: resolvedPhoneRows.map((p) => ({
            id: p.id,
            number: p.number,
            type: p.type,
            isPrimary: p.isPrimary,
          })),
          emails: resolvedEmailRows.map((e) => ({
            id: e.id,
            address: e.address,
            type: e.type,
            isPrimary: e.isPrimary,
          })),
        }
      : null

    const serviceLocation = locationRows[0]
      ? {
          id: locationRows[0].id,
          name: locationRows[0].name,
          addressLine1: locationRows[0].addressLine1,
          addressLine2: locationRows[0].addressLine2,
          city: locationRows[0].city,
          state: locationRows[0].state,
          postalCode: locationRows[0].postalCode,
          gated: locationRows[0].gated,
        }
      : null

    return {
      ...job,
      customerName: customerRows[0]?.name ?? '',
      primaryLocationId: customerRows[0]?.primaryLocationId ?? null,
      primaryContactId: customerRows[0]?.primaryContactId ?? null,
      contact,
      serviceLocation,
      lineItems,
      tags: tagRows,
      assignees,
      siteVisits,
      tasks,
      reminders,
      photos,
    }
  })
}

/**
 * Count of open + in-progress jobs for the tenant.
 * Used by the dashboard Open Jobs metric card.
 */
export interface RecentJobRow {
  id: string
  jobNo: number
  customerName: string
  status: string
  createdAt: Date | null
}

export async function listRecentJobs(
  orgId: string,
  limit = 5,
): Promise<RecentJobRow[]> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({
        id: jobs.id,
        jobNo: jobs.jobNo,
        customerName: customers.name,
        status: jobs.status,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .leftJoin(customers, eq(customers.id, jobs.customerId))
      .where(eq(jobs.tenantId, orgId))
      .orderBy(desc(jobs.createdAt))
      .limit(limit) as Promise<RecentJobRow[]>
  })
}

export async function countOpenJobs(orgId: string): Promise<number> {
  return withTenant(orgId, async (tx) => {
    const openStatuses = [...STATUS_GROUPS.open, ...STATUS_GROUPS.in_progress]
    const [{ c }] = await tx
      .select({ c: count() })
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), inArray(jobs.status, openStatuses)))
    return c
  })
}

/**
 * Per-tag job counts scoped to the tenant.
 * Used by the jobs dashboard sidebar bucket nav (JOB-13).
 */
export async function countJobsByTag(
  orgId: string,
): Promise<{ tagId: string; name: string; color: string | null; count: number }[]> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({
        tagId: jobTags.tagId,
        name: tags.name,
        color: tags.color,
        count: count(),
      })
      .from(jobTags)
      .innerJoin(tags, eq(jobTags.tagId, tags.id))
      .where(eq(jobTags.tenantId, orgId))
      .groupBy(jobTags.tagId, tags.name, tags.color)
  })
}
