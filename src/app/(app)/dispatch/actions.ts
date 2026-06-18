'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and, or, sql, count, gte, lte, isNull, notInArray, inArray } from 'drizzle-orm'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { withTenant } from '@/db/with-tenant'
import {
  jobs,
  jobAssignees,
  customers,
  serviceLocations,
  contacts,
  contactPhones,
  contactEmails,
  teamProfiles,
} from '@/db/schema'
import type { JobStatusValue } from '@/lib/jobs/transitions'
import { transitionJobStatus } from '@/lib/jobs/transition-job-status'

// ── Schemas ─────────────────────────────────────────────────────────────────

const updateAssignmentSchema = z.object({
  jobId: z.string().uuid(),
  techUserId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const unassignSchema = z.object({
  jobId: z.string().uuid(),
})

const weekRangeSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Cached technician list per org to avoid repeated Clerk calls. */
let techCache: { orgId: string; list: Technician[]; at: number } | null = null
const TECH_CACHE_TTL = 60_000 // 1 minute

export type Technician = {
  userId: string
  firstName: string | null
  lastName: string | null
  name: string
}

async function fetchTechnicians(orgId: string): Promise<Technician[]> {
  const now = Date.now()
  if (techCache && techCache.orgId === orgId && now - techCache.at < TECH_CACHE_TTL) {
    return techCache.list
  }

  const client = await clerkClient()
  const [memberships, dbProfiles] = await Promise.all([
    client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    }),
    withTenant(orgId, async (tx) =>
      tx.select().from(teamProfiles).where(eq(teamProfiles.tenantId, orgId)),
    ),
  ])

  const profileMap = new Map(dbProfiles.map((p) => [p.userId, p]))

  const list: Technician[] = memberships.data
    .filter((m) => m.role === 'org:technician' || m.role === 'org:admin')
    .map((m) => {
      const userId = m.publicUserData?.userId ?? m.id
      const profile = profileMap.get(userId)
      const first = profile?.firstName ?? m.publicUserData?.firstName
      const last = profile?.lastName ?? m.publicUserData?.lastName
      const name =
        [first, last].filter(Boolean).join(' ') ||
        profile?.email ||
        m.publicUserData?.identifier ||
        'Member'
      return {
        userId,
        firstName: first ?? null,
        lastName: last ?? null,
        name,
      }
    })

  techCache = { orgId, list, at: now }
  return list
}

/** Broadcast a dispatch change event to all connected clients in this org. */
async function broadcastDispatchEvent(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  if (!key.startsWith('sb_secret_')) {
    console.warn(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY looks like a legacy key. ' +
        'Supabase migrated to new API keys; Realtime broadcast may fail until you update it ' +
        'to the secret key from Dashboard → Project Settings → API.',
    )
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const channel = supabase.channel(`dispatch:${orgId}`, {
    config: { broadcast: { ack: true } },
  })

  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({ type: 'broadcast', event, payload })
      await channel.unsubscribe()
    }
  })
}

// ── Actions ─────────────────────────────────────────────────────────────────

/**
 * Update job assignment: clear old assignees, insert new one, set startDate.
 *
 * Validates techUserId against the org's technician list (Clerk lookup with
 * a short-lived module cache to reduce latency on drag-and-drop hot path).
 */
export async function updateJobAssignment(
  input: z.infer<typeof updateAssignmentSchema>,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = updateAssignmentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  const { jobId, techUserId, date, endDate } = parsed.data

  // Verify the target user is a member of this org (cached — see fetchTechnicians).
  const techs = await fetchTechnicians(orgId)
  if (!techs.some((t) => t.userId === techUserId)) {
    return { error: 'Selected user is not a member of this organization.' }
  }

  try {
    await withTenant(orgId, async (tx) => {
      // 1. Clear existing board-visible assignees for this job.
      await tx
        .delete(jobAssignees)
        .where(and(eq(jobAssignees.tenantId, orgId), eq(jobAssignees.jobId, jobId)))

      // 2. Insert new assignee.
      await tx.insert(jobAssignees).values({
        tenantId: orgId,
        jobId,
        userId: techUserId,
        notify: false,
      })

      // 3. Update job start date (and end date for multi-day jobs).
      const set: Record<string, unknown> = {
        startDate: new Date(`${date}T00:00:00`),
        updatedAt: new Date(),
      }
      if (endDate) {
        set.endDate = new Date(`${endDate}T00:00:00`)
      } else {
        set.endDate = null // clear multi-day span when moving to a single day
      }
      await tx.update(jobs).set(set).where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Assignment failed'
    return { error: message }
  }

  revalidatePath('/dispatch')

  // Notify other tabs / users in this org (Realtime Broadcast).
  broadcastDispatchEvent(orgId, 'job-assigned', {
    jobId,
    techId: techUserId,
    date,
  }).catch(() => {
    // Silently ignore broadcast failures — they are best-effort.
  })

  return { success: true }
}

/**
 * Remove a job from the board: clear all assignees and set startDate to null.
 * Used when dragging a grid job back into the job pool.
 */
export async function unassignJob(
  input: z.infer<typeof unassignSchema>,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = unassignSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  const { jobId } = parsed.data

  try {
    await withTenant(orgId, async (tx) => {
      // 1. Remove all board assignees for this job.
      await tx
        .delete(jobAssignees)
        .where(and(eq(jobAssignees.tenantId, orgId), eq(jobAssignees.jobId, jobId)))

      // 2. Clear start and end dates (move back to pool / unscheduled).
      await tx
        .update(jobs)
        .set({ startDate: null, endDate: null, updatedAt: new Date() })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unassignment failed'
    return { error: message }
  }

  revalidatePath('/dispatch')

  broadcastDispatchEvent(orgId, 'job-unassigned', { jobId }).catch(() => {
    // Silently ignore broadcast failures — they are best-effort.
  })

  return { success: true }
}

// ── Status transition ───────────────────────────────────────────────────────

const transitionStatusSchema = z.object({
  jobId: z.string().uuid(),
  toStatus: z.string().min(1),
})

/** Change job status via the canonical FSM transition endpoint.
 *  Revalidates both /dispatch and the job detail page.
 */
export async function transitionJobStatusAction(
  input: z.infer<typeof transitionStatusSchema>,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = transitionStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { orgId, userId } = await auth()
  if (!orgId || !userId) return { error: 'Unauthorized' }

  const { jobId, toStatus } = parsed.data

  try {
    await transitionJobStatus(jobId, toStatus, userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transition failed'
    if (message.includes('Illegal transition')) {
      return { error: "That status change isn't allowed from the current status." }
    }
    return { error: message }
  }

  revalidatePath('/dispatch')
  revalidatePath(`/jobs/${jobId}`)

  broadcastDispatchEvent(orgId, 'job-status-changed', { jobId, toStatus }).catch(() => {
    // best-effort
  })

  return { success: true }
}

/** List all active org technicians via Clerk. */
export async function listTechnicians(): Promise<Technician[]> {
  const { orgId } = await auth()
  if (!orgId) return []
  return fetchTechnicians(orgId)
}

// ── Inline field updates ───────────────────────────────────────────────────

const jobIdSchema = z.object({ jobId: z.string().uuid() })

function validateOrgId(): Promise<{ orgId: string; error?: string }> {
  return auth().then(({ orgId }) => {
    if (!orgId) return { orgId: '', error: 'Unauthorized' }
    return { orgId }
  })
}

/** Generic job field updater. Revalidates /dispatch and the job page. */
async function updateJobField(
  jobId: string,
  set: Record<string, unknown>,
): Promise<{ error?: string; success?: boolean }> {
  const { orgId, error } = await validateOrgId()
  if (error) return { error }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .update(jobs)
        .set({ ...set, updatedAt: new Date() })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Update failed' }
  }

  revalidatePath('/dispatch')
  revalidatePath(`/jobs/${jobId}`)
  return { success: true }
}

export async function updateJobDescription(
  input: z.infer<typeof jobIdSchema> & { description: string | null },
) {
  const parsed = jobIdSchema.merge(z.object({ description: z.string().nullable() })).safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  return updateJobField(parsed.data.jobId, { description: parsed.data.description })
}

export async function updateJobPONumber(
  input: z.infer<typeof jobIdSchema> & { poNumber: string | null },
) {
  const parsed = jobIdSchema.merge(z.object({ poNumber: z.string().nullable() })).safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  return updateJobField(parsed.data.jobId, { poNumber: parsed.data.poNumber })
}

export async function updateJobNotesForTechs(
  input: z.infer<typeof jobIdSchema> & { notesForTechs: string | null },
) {
  const parsed = jobIdSchema
    .merge(z.object({ notesForTechs: z.string().nullable() }))
    .safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  return updateJobField(parsed.data.jobId, { notesForTechs: parsed.data.notesForTechs })
}

export async function updateJobEstimatedDuration(
  input: z.infer<typeof jobIdSchema> & { estimatedDuration: number | null },
) {
  const parsed = jobIdSchema
    .merge(z.object({ estimatedDuration: z.number().nullable() }))
    .safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  return updateJobField(parsed.data.jobId, {
    estimatedDuration: parsed.data.estimatedDuration,
  })
}

export async function updateJobDates(
  input: z.infer<typeof jobIdSchema> & {
    startDate: string | null
    endDate: string | null
  },
) {
  const parsed = jobIdSchema
    .merge(
      z.object({
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
      }),
    )
    .safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { orgId, error } = await validateOrgId()
  if (error) return { error }

  const start = parsed.data.startDate
    ? new Date(`${parsed.data.startDate}T00:00:00`)
    : null
  const end = parsed.data.endDate ? new Date(`${parsed.data.endDate}T00:00:00`) : null

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .update(jobs)
        .set({ startDate: start, endDate: end, updatedAt: new Date() })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, parsed.data.jobId)))
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Update failed' }
  }

  revalidatePath('/dispatch')
  revalidatePath(`/jobs/${parsed.data.jobId}`)
  return { success: true }
}

export async function updateJobArrivalWindow(
  input: z.infer<typeof jobIdSchema> & {
    arrivalWindowStart: string | null
    arrivalWindowEnd: string | null
  },
) {
  const parsed = jobIdSchema
    .merge(
      z.object({
        arrivalWindowStart: z.string().nullable(),
        arrivalWindowEnd: z.string().nullable(),
      }),
    )
    .safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { orgId, error } = await validateOrgId()
  if (error) return { error }

  const toDateTime = (t: string | null): Date | null => {
    if (!t) return null
    const [h, m] = t.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .update(jobs)
        .set({
          arrivalWindowStart: toDateTime(parsed.data.arrivalWindowStart),
          arrivalWindowEnd: toDateTime(parsed.data.arrivalWindowEnd),
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, parsed.data.jobId)))
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Update failed' }
  }

  revalidatePath('/dispatch')
  revalidatePath(`/jobs/${parsed.data.jobId}`)
  return { success: true }
}

export async function updateJobAssignees(
  input: z.infer<typeof jobIdSchema> & { techUserIds: string[] },
) {
  const parsed = jobIdSchema
    .merge(z.object({ techUserIds: z.array(z.string().min(1)) }))
    .safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { orgId, error } = await validateOrgId()
  if (error) return { error }

  const { jobId, techUserIds } = parsed.data

  try {
    await withTenant(orgId, async (tx) => {
      // Clear existing assignees
      await tx
        .delete(jobAssignees)
        .where(and(eq(jobAssignees.tenantId, orgId), eq(jobAssignees.jobId, jobId)))

      // Insert new assignees
      if (techUserIds.length > 0) {
        await tx.insert(jobAssignees).values(
          techUserIds.map((userId) => ({
            tenantId: orgId,
            jobId,
            userId,
            notify: false,
          })),
        )
      }
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Update failed' }
  }

  revalidatePath('/dispatch')
  revalidatePath(`/jobs/${jobId}`)
  return { success: true }
}

export async function updateJobServiceLocation(
  input: z.infer<typeof jobIdSchema> & { serviceLocationId: string | null },
) {
  const parsed = jobIdSchema
    .merge(z.object({ serviceLocationId: z.string().uuid().nullable() }))
    .safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  return updateJobField(parsed.data.jobId, {
    serviceLocationId: parsed.data.serviceLocationId,
  })
}

// ── Queries ─────────────────────────────────────────────────────────────────

export type WeekJob = {
  id: string
  jobNo: number
  status: string
  startDate: Date | null
  endDate: Date | null
  customerName: string
  address: string | null
  arrivalWindowStart: Date | null
  arrivalWindowEnd: Date | null
  description: string | null
  techIds: string[]
}

/** Stub for estimates — Phase 6 will wire the DB table.
 *  Kept structurally similar to WeekJob so the grid can render either.
 */
export type WeekEstimate = {
  id: string
  estimateNo: number
  status: string
  startDate: Date | null
  endDate: Date | null
  customerName: string
  address: string | null
  arrivalWindowStart: Date | null
  arrivalWindowEnd: Date | null
  description: string | null
  techIds: string[]
}

export type BoardItem = WeekJob | WeekEstimate

/** Fetch jobs scheduled within a week range, with assignees + customer + location. */
export async function getWeekJobs(
  orgId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeekJob[]> {
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(`${weekEnd}T23:59:59`)

  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: jobs.id,
        jobNo: jobs.jobNo,
        status: jobs.status,
        startDate: jobs.startDate,
        endDate: jobs.endDate,
        customerName: customers.name,
        address: sql<string | null>`COALESCE(${serviceLocations.addressLine1}, '')`,
        arrivalWindowStart: jobs.arrivalWindowStart,
        arrivalWindowEnd: jobs.arrivalWindowEnd,
        description: jobs.description,
        techId: jobAssignees.userId,
      })
      .from(jobs)
      .leftJoin(customers, eq(customers.id, jobs.customerId))
      .leftJoin(serviceLocations, eq(serviceLocations.id, jobs.serviceLocationId))
      .leftJoin(jobAssignees, eq(jobAssignees.jobId, jobs.id))
      .where(
        and(
          eq(jobs.tenantId, orgId),
          lte(jobs.startDate, end),
          or(isNull(jobs.endDate), gte(jobs.endDate, start)),
        ),
      )
      .orderBy(jobs.arrivalWindowStart)

    // Group assignees by job
    const map = new Map<string, WeekJob>()
    for (const r of rows) {
      const existing = map.get(r.id)
      if (existing) {
        if (r.techId) existing.techIds.push(r.techId)
      } else {
        map.set(r.id, {
          id: r.id,
          jobNo: r.jobNo,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          customerName: r.customerName ?? '',
          address: r.address,
          arrivalWindowStart: r.arrivalWindowStart,
          arrivalWindowEnd: r.arrivalWindowEnd,
          description: r.description,
          techIds: r.techId ? [r.techId] : [],
        })
      }
    }
    return Array.from(map.values())
  })
}

/** Lightweight single-job fetch for realtime broadcast patches. */
export async function getJobMinimal(
  jobId: string,
  orgId: string,
): Promise<WeekJob | null> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: jobs.id,
        jobNo: jobs.jobNo,
        status: jobs.status,
        startDate: jobs.startDate,
        endDate: jobs.endDate,
        customerName: customers.name,
        address: sql<string | null>`COALESCE(${serviceLocations.addressLine1}, '')`,
        arrivalWindowStart: jobs.arrivalWindowStart,
        arrivalWindowEnd: jobs.arrivalWindowEnd,
        description: jobs.description,
        lat: serviceLocations.latitude,
        lng: serviceLocations.longitude,
        techId: jobAssignees.userId,
      })
      .from(jobs)
      .leftJoin(customers, eq(customers.id, jobs.customerId))
      .leftJoin(serviceLocations, eq(serviceLocations.id, jobs.serviceLocationId))
      .leftJoin(jobAssignees, eq(jobAssignees.jobId, jobs.id))
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))

    if (rows.length === 0) return null

    const techIds = rows.map((r) => r.techId).filter(Boolean) as string[]
    const first = rows[0]
    return {
      id: first.id,
      jobNo: first.jobNo,
      status: first.status,
      startDate: first.startDate,
      endDate: first.endDate,
      customerName: first.customerName ?? '',
      address: first.address,
      arrivalWindowStart: first.arrivalWindowStart,
      arrivalWindowEnd: first.arrivalWindowEnd,
      description: first.description,
      techIds,
    }
  })
}

export type CustomerLocation = {
  id: string
  name: string | null
  addressLine1: string | null
}

export type PopupData = {
  customerId: string | null
  serviceLocationId: string | null
  customerPhone: string | null
  fullAddress: string | null
  notesForTechs: string | null
  completionNotes: string | null
  priority: string | null
  estimatedDuration: number | null
  poNumber: string | null
  endDate: Date | null
  billingType: string | null
  contactName: string | null
  contactEmail: string | null
  customerLocations: CustomerLocation[]
}

/** Fetch enriched job details for the dispatch popup.
 *  Returns phone, full address, notes, priority, contact info, billing, PO#, customer locations.
 */
export async function getJobPopupData(
  jobId: string,
  orgId: string,
): Promise<PopupData | null> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        customerId: jobs.customerId,
        serviceLocationId: jobs.serviceLocationId,
        addressLine1: serviceLocations.addressLine1,
        addressLine2: serviceLocations.addressLine2,
        city: serviceLocations.city,
        state: serviceLocations.state,
        postalCode: serviceLocations.postalCode,
        notesForTechs: jobs.notesForTechs,
        completionNotes: jobs.completionNotes,
        priority: jobs.priority,
        estimatedDuration: jobs.estimatedDuration,
        poNumber: jobs.poNumber,
        endDate: jobs.endDate,
        billingType: jobs.billingType,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        jobContactId: jobs.contactId,
        customerPrimaryContactId: customers.primaryContactId,
        phone: contactPhones.number,
        email: contactEmails.address,
      })
      .from(jobs)
      .leftJoin(customers, eq(customers.id, jobs.customerId))
      .leftJoin(serviceLocations, eq(serviceLocations.id, jobs.serviceLocationId))
      .leftJoin(
        contacts,
        eq(contacts.id, sql`COALESCE(${jobs.contactId}, ${customers.primaryContactId})`),
      )
      .leftJoin(contactPhones, eq(contactPhones.contactId, contacts.id))
      .leftJoin(contactEmails, eq(contactEmails.contactId, contacts.id))
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
      .limit(1)

    if (rows.length === 0) return null

    const r = rows[0]

    const parts = [r.addressLine1, r.addressLine2, r.city, r.state, r.postalCode].filter(Boolean)
    const fullAddress = parts.length ? parts.join(', ') : null

    const contactName = [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ') || null

    // Fetch customer locations for the location inline-edit dropdown
    let customerLocations: CustomerLocation[] = []
    if (r.customerId) {
      const locRows = await tx
        .select({
          id: serviceLocations.id,
          name: serviceLocations.name,
          addressLine1: serviceLocations.addressLine1,
        })
        .from(serviceLocations)
        .where(
          and(
            eq(serviceLocations.tenantId, orgId),
            eq(serviceLocations.customerId, r.customerId),
          ),
        )
        .orderBy(serviceLocations.name)
      customerLocations = locRows
    }

    return {
      customerId: r.customerId ?? null,
      serviceLocationId: r.serviceLocationId ?? null,
      customerPhone: r.phone ?? null,
      fullAddress,
      notesForTechs: r.notesForTechs ?? null,
      completionNotes: r.completionNotes ?? null,
      priority: r.priority ?? null,
      estimatedDuration: r.estimatedDuration ?? null,
      poNumber: r.poNumber ?? null,
      endDate: r.endDate,
      billingType: r.billingType ?? null,
      contactName,
      contactEmail: r.email ?? null,
      customerLocations,
    }
  })
}

export type PoolCounts = {
  unscheduled: number
  unassigned: number
  withOpenPOs: number
  partiallyCompleted: number
  paused: number
  markedForFollowUp: number
  /** Distinct jobs that appear in at least one pool classification. */
  total: number
}

/** Return tab counts for the job pool. */
export async function countPoolJobs(orgId: string): Promise<PoolCounts> {
  return withTenant(orgId, async (tx) => {
    const excludedStatuses: JobStatusValue[] = ['cancelled', 'invoiced']

    // Unscheduled: startDate IS NULL and not cancelled/invoiced
    const [{ c: unscheduled }] = await tx
      .select({ c: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, orgId),
          isNull(jobs.startDate),
          notInArray(jobs.status, excludedStatuses),
        ),
      )

    // Unassigned: no jobAssignees row and not cancelled/invoiced
    const [{ c: unassigned }] = await tx
      .select({ c: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, orgId),
          notInArray(jobs.status, excludedStatuses),
          sql`NOT EXISTS (
            SELECT 1 FROM ${jobAssignees}
            WHERE ${jobAssignees.jobId} = ${jobs.id}
            AND ${jobAssignees.tenantId} = ${orgId}
          )`,
        ),
      )

    // Partially completed
    const [{ c: partiallyCompleted }] = await tx
      .select({ c: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, orgId),
          eq(jobs.status, 'partially_completed'),
        ),
      )

    // Paused
    const [{ c: paused }] = await tx
      .select({ c: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, orgId),
          eq(jobs.status, 'paused'),
        ),
      )

    // Distinct jobs in at least one pool bucket (deduplicates overlaps).
    const [{ c: total }] = await tx
      .select({ c: sql<number>`COUNT(DISTINCT ${jobs.id})` })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, orgId),
          notInArray(jobs.status, excludedStatuses),
          or(
            isNull(jobs.startDate),
            sql`NOT EXISTS (
              SELECT 1 FROM ${jobAssignees}
              WHERE ${jobAssignees.jobId} = ${jobs.id}
              AND ${jobAssignees.tenantId} = ${orgId}
            )`,
            eq(jobs.status, 'partially_completed'),
            eq(jobs.status, 'paused'),
          ),
        ),
      )

    return {
      unscheduled,
      unassigned,
      withOpenPOs: 0, // TODO: implement when PO table added (Phase 7)
      partiallyCompleted,
      paused,
      markedForFollowUp: 0, // TODO: needs_follow_up is not in the job_status enum
      total,
    }
  })
}

/** Fetch all active jobs suitable for the pool (not cancelled/invoiced).
 *  Restricted to jobs matching at least one pool bucket so the All tab never
 *  duplicates jobs already scheduled and assigned on the dispatch board.
 */
export async function getPoolJobs(orgId: string): Promise<WeekJob[]> {
  return withTenant(orgId, async (tx) => {
    const excludedStatuses: JobStatusValue[] = ['cancelled', 'invoiced']

    const rows = await tx
      .select({
        id: jobs.id,
        jobNo: jobs.jobNo,
        status: jobs.status,
        startDate: jobs.startDate,
        endDate: jobs.endDate,
        customerName: customers.name,
        address: sql<string | null>`COALESCE(${serviceLocations.addressLine1}, '')`,
        arrivalWindowStart: jobs.arrivalWindowStart,
        arrivalWindowEnd: jobs.arrivalWindowEnd,
        description: jobs.description,
        techId: jobAssignees.userId,
      })
      .from(jobs)
      .leftJoin(customers, eq(customers.id, jobs.customerId))
      .leftJoin(serviceLocations, eq(serviceLocations.id, jobs.serviceLocationId))
      .leftJoin(jobAssignees, eq(jobAssignees.jobId, jobs.id))
      .where(
        and(
          eq(jobs.tenantId, orgId),
          notInArray(jobs.status, excludedStatuses),
          or(
            isNull(jobs.startDate),
            sql`NOT EXISTS (
              SELECT 1 FROM ${jobAssignees}
              WHERE ${jobAssignees.jobId} = ${jobs.id}
              AND ${jobAssignees.tenantId} = ${orgId}
            )`,
            eq(jobs.status, 'partially_completed'),
            eq(jobs.status, 'paused'),
          ),
        ),
      )
      .orderBy(jobs.createdAt)

    const map = new Map<string, WeekJob>()
    for (const r of rows) {
      const existing = map.get(r.id)
      if (existing) {
        if (r.techId) existing.techIds.push(r.techId)
      } else {
        map.set(r.id, {
          id: r.id,
          jobNo: r.jobNo,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          customerName: r.customerName ?? '',
          address: r.address,
          arrivalWindowStart: r.arrivalWindowStart,
          arrivalWindowEnd: r.arrivalWindowEnd,
          description: r.description,
          techIds: r.techId ? [r.techId] : [],
        })
      }
    }
    return Array.from(map.values())
  })
}
