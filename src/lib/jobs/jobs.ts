import { eq, and, desc, asc, sql, count, inArray } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  jobs,
  jobLineItems,
  jobTags,
  jobAssignees,
  jobSiteVisits,
  jobTasks,
  tags,
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
}

export interface JobRow {
  id: string
  jobNo: number
  customerId: string
  status: string
  priority: string | null
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

    // Status group filter
    if (opts.statusGroup) {
      const groupStatuses = STATUS_GROUPS[opts.statusGroup]
      if (groupStatuses) {
        conditions.push(inArray(jobs.status, groupStatuses))
      }
    } else if (opts.status) {
      conditions.push(eq(jobs.status, opts.status as any))
    } else {
      // D-16: default to Open + In Progress
      const openStatuses = [...STATUS_GROUPS.open, ...STATUS_GROUPS.in_progress]
      conditions.push(inArray(jobs.status, openStatuses))
    }

    if (opts.customerId) {
      conditions.push(eq(jobs.customerId, opts.customerId))
    }

    if (opts.q) {
      const term = `%${opts.q}%`
      conditions.push(sql`${jobs.description} ILIKE ${term}`)
    }

    // Sort
    let order
    switch (opts.sort) {
      case 'jobNo':
        order = asc(jobs.jobNo)
        break
      case 'customer':
        order = asc(jobs.customerId)
        break
      case 'priority':
        order = desc(jobs.priority)
        break
      case 'category':
        order = asc(jobs.categoryId)
        break
      default:
        order = desc(jobs.startDate)
        break
    }

    // Count query
    const [{ c }] = await tx
      .select({ c: count() })
      .from(jobs)
      .where(and(...conditions))

    const pageCount = Math.ceil(c / pageSize)

    // Main query — paginated job list
    const rows = await tx
      .select({
        id: jobs.id,
        jobNo: jobs.jobNo,
        customerId: jobs.customerId,
        status: jobs.status,
        priority: jobs.priority,
        startDate: jobs.startDate,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(and(...conditions))
      .orderBy(order)
      .limit(pageSize)
      .offset(page * pageSize)

    return { rows: rows as JobRow[], pageCount }
  })
}

/**
 * Fetch a single job by ID with its related data.
 * Tenant-scoped via withTenant.
 */
export async function getJob(
  orgId: string,
  jobId: string,
): Promise<
  | (typeof jobs.$inferSelect & {
      lineItems: typeof jobLineItems.$inferSelect[]
      tags: typeof tags.$inferSelect[]
      assignees: typeof jobAssignees.$inferSelect[]
      siteVisits: typeof jobSiteVisits.$inferSelect[]
      tasks: typeof jobTasks.$inferSelect[]
    })
  | null
> {
  return withTenant(orgId, async (tx) => {
    const jobRows = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
      .limit(1)

    const job = jobRows[0]
    if (!job) return null

    const [lineItems, tagRows, assignees, siteVisits, tasks] = await Promise.all([
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
    ])

    return {
      ...job,
      lineItems,
      tags: tagRows,
      assignees,
      siteVisits,
      tasks,
    }
  })
}

/**
 * Per-tag job counts scoped to the tenant.
 * Used by the jobs dashboard sidebar bucket nav (JOB-13).
 */
export async function countJobsByTag(
  orgId: string,
): Promise<{ tagId: string; count: number }[]> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({
        tagId: jobTags.tagId,
        count: count(),
      })
      .from(jobTags)
      .where(eq(jobTags.tenantId, orgId))
      .groupBy(jobTags.tagId)
  })
}
