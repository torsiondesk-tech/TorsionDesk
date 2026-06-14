import { eq, and, desc, asc, sql, count, inArray, exists } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  jobs,
  jobLineItems,
  jobTags,
  jobAssignees,
  jobSiteVisits,
  jobTasks,
  jobPhotos,
  tags,
  customers,
  serviceLocations,
  jobCategories,
} from '@/db/schema'
import { STATUS_GROUPS } from './transitions'

export interface ListOpts {
  page?: number
  pageSize?: number
  status?: string
  statusGroup?: 'open' | 'in_progress' | 'closed'
  customerId?: string
  q?: string
  sort?: string
  dir?: 'asc' | 'desc'
  bucket?: string
  tag?: string
  userId?: string
}

export interface JobRow {
  id: string
  jobNo: number
  customerId: string
  customerName: string
  description: string | null
  city: string | null
  category: string | null
  priority: string | null
  status: string
  startDate: Date | null
  createdAt: Date | null
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
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof sql>> = [
      eq(jobs.tenantId, orgId),
    ]

    // Bucket / status filtering
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
    } else if (opts.bucket === 'all_open' || !opts.bucket) {
      const openStatuses = [...STATUS_GROUPS.open, ...STATUS_GROUPS.in_progress]
      conditions.push(inArray(jobs.status, openStatuses))
    } else if (opts.statusGroup) {
      const groupStatuses = STATUS_GROUPS[opts.statusGroup]
      if (groupStatuses) {
        conditions.push(inArray(jobs.status, groupStatuses))
      }
    } else if (opts.status) {
      conditions.push(eq(jobs.status, opts.status as any))
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

    if (opts.q) {
      const term = `%${opts.q}%`
      conditions.push(sql`${jobs.description} ILIKE ${term}`)
    }

    // Sort
    const sortDir = opts.dir === 'asc' ? asc : desc
    let order
    switch (opts.sort) {
      case 'jobNo':
        order = sortDir(jobs.jobNo)
        break
      case 'customer':
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
        customerName: customers.name,
        description: jobs.description,
        city: serviceLocations.city,
        category: jobCategories.name,
        priority: jobs.priority,
        status: jobs.status,
        startDate: jobs.startDate,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .leftJoin(customers, eq(customers.id, jobs.customerId))
      .leftJoin(serviceLocations, eq(serviceLocations.id, jobs.serviceLocationId))
      .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
      .where(and(...conditions))
      .orderBy(order)
      .limit(pageSize)
      .offset(page * pageSize)

    return { rows: rows as JobRow[], pageCount }
  })
}

export type JobDetail = typeof jobs.$inferSelect & {
  customerName: string
  lineItems: typeof jobLineItems.$inferSelect[]
  tags: typeof tags.$inferSelect[]
  assignees: typeof jobAssignees.$inferSelect[]
  siteVisits: typeof jobSiteVisits.$inferSelect[]
  tasks: typeof jobTasks.$inferSelect[]
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

    const [customerRows, lineItems, tagRows, assignees, siteVisits, tasks, photos] =
      await Promise.all([
        tx
          .select({ name: customers.name })
          .from(customers)
          .where(and(eq(customers.tenantId, orgId), eq(customers.id, job.customerId)))
          .limit(1),
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
          .from(jobPhotos)
          .where(and(eq(jobPhotos.tenantId, orgId), eq(jobPhotos.jobId, jobId)))
          .orderBy(desc(jobPhotos.createdAt)),
      ])

    return {
      ...job,
      customerName: customerRows[0]?.name ?? '',
      lineItems,
      tags: tagRows,
      assignees,
      siteVisits,
      tasks,
      photos,
    }
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
