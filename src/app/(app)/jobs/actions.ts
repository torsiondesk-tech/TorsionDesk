'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import {
  jobs,
  jobLineItems,
  jobTags,
  jobAssignees,
  customers,
  contacts,
  serviceLocations,
  jobCategories,
  jobSources,
  taxItems,
  customerEvents,
  jobSiteVisits,
  jobTasks,
  jobReminders,
} from '@/db/schema'
import { nextJobNo } from '@/lib/jobs/job-number'
import { transitionJobStatus } from '@/lib/jobs/transition-job-status'

// ── Helpers ────────────────────────────────────────────────────────────────

// Base UI Checkbox does not render a native <input>, so we use hidden inputs
// that submit '1' (checked) or '0' (unchecked).
const formBool = (defaultValue: boolean) =>
  z.preprocess(
    (val) => {
      if (val === '1' || val === true) return true
      if (val === '0' || val === false) return false
      return undefined
    },
    z.boolean().default(defaultValue),
  )

const emptyToUndefined = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.string().optional(),
)

const emptyToNull = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.string().nullable().optional(),
)

// ── Action State Types ─────────────────────────────────────────────────────

export type JobActionState = {
  error?: string
  success?: boolean
  id?: string
}

// ── Schemas ────────────────────────────────────────────────────────────────

const createJobSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  contactId: emptyToNull,
  serviceLocationId: emptyToNull,
  categoryId: emptyToNull,
  description: emptyToUndefined,
  poNumber: emptyToUndefined,
  jobSourceId: emptyToNull,
  assignedAgentId: emptyToUndefined,
  billingType: z.enum(['single_invoice', 'progress_billing', 'no_charge']).default('single_invoice'),
  priority: emptyToUndefined,
  startDate: emptyToNull,
  endDate: emptyToNull,
  arrivalWindowStart: emptyToNull,
  arrivalWindowEnd: emptyToNull,
  estimatedDuration: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional(),
  ),
  multiDay: formBool(false),
  requiresFollowUp: formBool(false),
  isRepeating: formBool(false),
  repeatFrequency: emptyToUndefined,
  repeatEndDate: emptyToNull,
  notesForTechs: emptyToUndefined,
  completionNotes: emptyToUndefined,
  tagIds: z.array(z.string()).default([]),
  assigneeUserIds: z.array(z.string()).default([]),
  lineItems: z.string().default('[]'),
})

const updateJobSchema = createJobSchema.extend({
  id: z.string().min(1),
  customerId: z.string().min(1),
})

const lineItemSchema = z.object({
  type: z.enum(['product', 'service', 'discount', 'expense']),
  refId: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  qty: z.string().default('1'),
  rate: z.string().default('0'),
  cost: z.string().default('0'),
  taxItemId: z.string().nullable().optional(),
})

// ── Cross-tenant guard helpers ─────────────────────────────────────────────

async function guardCustomer(tx: Parameters<Parameters<typeof withTenant>[1]>[0], orgId: string, customerId: string) {
  const rows = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid customer: cross-tenant access denied')
}

async function guardContact(tx: Parameters<Parameters<typeof withTenant>[1]>[0], orgId: string, contactId: string | null | undefined) {
  if (!contactId) return
  const rows = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, contactId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid contact: cross-tenant access denied')
}

async function guardServiceLocation(tx: Parameters<Parameters<typeof withTenant>[1]>[0], orgId: string, locationId: string | null | undefined) {
  if (!locationId) return
  const rows = await tx
    .select({ id: serviceLocations.id })
    .from(serviceLocations)
    .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, locationId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid service location: cross-tenant access denied')
}

async function guardCategory(tx: Parameters<Parameters<typeof withTenant>[1]>[0], orgId: string, categoryId: string | null | undefined) {
  if (!categoryId) return
  const rows = await tx
    .select({ id: jobCategories.id })
    .from(jobCategories)
    .where(and(eq(jobCategories.tenantId, orgId), eq(jobCategories.id, categoryId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid category: cross-tenant access denied')
}

async function guardJobSource(tx: Parameters<Parameters<typeof withTenant>[1]>[0], orgId: string, jobSourceId: string | null | undefined) {
  if (!jobSourceId) return
  const rows = await tx
    .select({ id: jobSources.id })
    .from(jobSources)
    .where(and(eq(jobSources.tenantId, orgId), eq(jobSources.id, jobSourceId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid job source: cross-tenant access denied')
}

async function guardTaxItem(tx: Parameters<Parameters<typeof withTenant>[1]>[0], orgId: string, taxItemId: string | null | undefined) {
  if (!taxItemId) return
  const rows = await tx
    .select({ id: taxItems.id })
    .from(taxItems)
    .where(and(eq(taxItems.tenantId, orgId), eq(taxItems.id, taxItemId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid tax item: cross-tenant access denied')
}

// ── Actions ─────────────────────────────────────────────────────────────────

export async function createJob(
  _prevState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const tagIds: string[] = formData.getAll('tagIds').map((v) => String(v))
  const assigneeUserIds: string[] = formData.getAll('assigneeUserIds').map((v) => String(v))

  const parsed = createJobSchema.safeParse({
    customerId: formData.get('customerId'),
    contactId: formData.get('contactId'),
    serviceLocationId: formData.get('serviceLocationId'),
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    poNumber: formData.get('poNumber'),
    jobSourceId: formData.get('jobSourceId'),
    assignedAgentId: formData.get('assignedAgentId'),
    billingType: formData.get('billingType'),
    priority: formData.get('priority'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    arrivalWindowStart: formData.get('arrivalWindowStart'),
    arrivalWindowEnd: formData.get('arrivalWindowEnd'),
    estimatedDuration: formData.get('estimatedDuration'),
    multiDay: formData.get('multiDay'),
    requiresFollowUp: formData.get('requiresFollowUp'),
    isRepeating: formData.get('isRepeating'),
    repeatFrequency: formData.get('repeatFrequency'),
    repeatEndDate: formData.get('repeatEndDate'),
    notesForTechs: formData.get('notesForTechs'),
    completionNotes: formData.get('completionNotes'),
    tagIds,
    assigneeUserIds,
    lineItems: formData.get('lineItems'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const data = parsed.data

  // Parse line items JSON
  let parsedLineItems: z.infer<typeof lineItemSchema>[] = []
  try {
    const raw = JSON.parse(data.lineItems)
    if (Array.isArray(raw)) {
      parsedLineItems = raw
        .map((item) => lineItemSchema.safeParse(item))
        .filter((r): r is z.ZodSafeParseSuccess<z.infer<typeof lineItemSchema>> => r.success)
        .map((r) => r.data)
    }
  } catch {
    // ignore malformed JSON, treat as empty
  }

  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    try {
      const id = await withTenant(orgId, async (tx) => {
        await guardCustomer(tx, orgId, data.customerId)
        await guardContact(tx, orgId, data.contactId)
        await guardServiceLocation(tx, orgId, data.serviceLocationId)
        await guardCategory(tx, orgId, data.categoryId)
        await guardJobSource(tx, orgId, data.jobSourceId)

        const jobNo = await nextJobNo(tx, orgId)

        const [row] = await tx
          .insert(jobs)
          .values({
            tenantId: orgId,
            jobNo,
            customerId: data.customerId,
            contactId: data.contactId,
            serviceLocationId: data.serviceLocationId,
            categoryId: data.categoryId,
            description: data.description,
            poNumber: data.poNumber,
            jobSourceId: data.jobSourceId,
            assignedAgentId: data.assignedAgentId,
            billingType: data.billingType,
            priority: data.priority,
            startDate: data.startDate ? new Date(data.startDate) : null,
            endDate: data.endDate ? new Date(data.endDate) : null,
            arrivalWindowStart: data.arrivalWindowStart ? new Date(data.arrivalWindowStart) : null,
            arrivalWindowEnd: data.arrivalWindowEnd ? new Date(data.arrivalWindowEnd) : null,
            estimatedDuration: data.estimatedDuration,
            multiDay: data.multiDay,
            requiresFollowUp: data.requiresFollowUp,
            isRepeating: data.isRepeating,
            repeatFrequency: data.repeatFrequency,
            repeatEndDate: data.repeatEndDate ? new Date(data.repeatEndDate) : null,
            notesForTechs: data.notesForTechs,
            completionNotes: data.completionNotes,
          })
          .returning({ id: jobs.id })

        const jobId = row.id

        // Insert line items
        if (parsedLineItems.length > 0) {
          for (let i = 0; i < parsedLineItems.length; i++) {
            const item = parsedLineItems[i]
            if (item.taxItemId) await guardTaxItem(tx, orgId, item.taxItemId)
          }

          await tx.insert(jobLineItems).values(
            parsedLineItems.map((item, i) => ({
              tenantId: orgId,
              jobId,
              type: item.type,
              refId: item.refId ?? null,
              description: item.description,
              qty: item.qty,
              rate: item.rate,
              cost: item.cost,
              taxItemId: item.taxItemId ?? null,
              sortOrder: i,
            })),
          )
        }

        // Insert tags
        if (data.tagIds.length > 0) {
          await tx.insert(jobTags).values(
            data.tagIds.map((tagId) => ({
              tenantId: orgId,
              jobId,
              tagId,
            })),
          )
        }

        // Insert assignees
        if (data.assigneeUserIds.length > 0) {
          await tx.insert(jobAssignees).values(
            data.assigneeUserIds.map((userId) => ({
              tenantId: orgId,
              jobId,
              userId,
              notify: false,
            })),
          )
        }

        // Activity event
        await tx.insert(customerEvents).values({
          tenantId: orgId,
          customerId: data.customerId,
          kind: 'job',
          title: `Created job #JOB-${jobNo}`,
          refId: jobId,
        })

        return jobId
      })

      revalidatePath('/jobs')
      revalidatePath(`/jobs/${id}`)
      revalidatePath(`/customers/${data.customerId}`)
      return { success: true, id }
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== '23505') {
        throw err
      }
      attempts++
      if (attempts >= maxAttempts) {
        console.error('createJob failed after retries:', err)
        return { error: 'Could not create job. Please try again.' }
      }
      await new Promise((r) => setTimeout(r, 100 * attempts))
    }
  }

  return { error: 'Could not create job. Please try again.' }
}

export async function updateJob(
  _prevState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const tagIds: string[] = formData.getAll('tagIds').map((v) => String(v))
  const assigneeUserIds: string[] = formData.getAll('assigneeUserIds').map((v) => String(v))

  const parsed = updateJobSchema.safeParse({
    id: formData.get('id'),
    customerId: formData.get('customerId'),
    contactId: formData.get('contactId'),
    serviceLocationId: formData.get('serviceLocationId'),
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    poNumber: formData.get('poNumber'),
    jobSourceId: formData.get('jobSourceId'),
    assignedAgentId: formData.get('assignedAgentId'),
    billingType: formData.get('billingType'),
    priority: formData.get('priority'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    arrivalWindowStart: formData.get('arrivalWindowStart'),
    arrivalWindowEnd: formData.get('arrivalWindowEnd'),
    estimatedDuration: formData.get('estimatedDuration'),
    multiDay: formData.get('multiDay'),
    requiresFollowUp: formData.get('requiresFollowUp'),
    isRepeating: formData.get('isRepeating'),
    repeatFrequency: formData.get('repeatFrequency'),
    repeatEndDate: formData.get('repeatEndDate'),
    notesForTechs: formData.get('notesForTechs'),
    completionNotes: formData.get('completionNotes'),
    tagIds,
    assigneeUserIds,
    lineItems: formData.get('lineItems'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const data = parsed.data

  // Parse line items JSON
  let parsedLineItems: z.infer<typeof lineItemSchema>[] = []
  try {
    const raw = JSON.parse(data.lineItems)
    if (Array.isArray(raw)) {
      parsedLineItems = raw
        .map((item) => lineItemSchema.safeParse(item))
        .filter((r): r is z.ZodSafeParseSuccess<z.infer<typeof lineItemSchema>> => r.success)
        .map((r) => r.data)
    }
  } catch {
    // ignore malformed JSON
  }

  await withTenant(orgId, async (tx) => {
    await guardCustomer(tx, orgId, data.customerId)
    await guardContact(tx, orgId, data.contactId)
    await guardServiceLocation(tx, orgId, data.serviceLocationId)
    await guardCategory(tx, orgId, data.categoryId)
    await guardJobSource(tx, orgId, data.jobSourceId)

    // IMPORTANT: status is NEVER updated here (Pitfall 1)
    await tx
      .update(jobs)
      .set({
        customerId: data.customerId,
        contactId: data.contactId,
        serviceLocationId: data.serviceLocationId,
        categoryId: data.categoryId,
        description: data.description,
        poNumber: data.poNumber,
        jobSourceId: data.jobSourceId,
        assignedAgentId: data.assignedAgentId,
        billingType: data.billingType,
        priority: data.priority,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        arrivalWindowStart: data.arrivalWindowStart ? new Date(data.arrivalWindowStart) : null,
        arrivalWindowEnd: data.arrivalWindowEnd ? new Date(data.arrivalWindowEnd) : null,
        estimatedDuration: data.estimatedDuration,
        multiDay: data.multiDay,
        requiresFollowUp: data.requiresFollowUp,
        isRepeating: data.isRepeating,
        repeatFrequency: data.repeatFrequency,
        repeatEndDate: data.repeatEndDate ? new Date(data.repeatEndDate) : null,
        notesForTechs: data.notesForTechs,
        completionNotes: data.completionNotes,
        updatedAt: new Date(),
      })
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, data.id)))

    // Replace line items
    await tx
      .delete(jobLineItems)
      .where(and(eq(jobLineItems.tenantId, orgId), eq(jobLineItems.jobId, data.id)))

    if (parsedLineItems.length > 0) {
      for (const item of parsedLineItems) {
        if (item.taxItemId) await guardTaxItem(tx, orgId, item.taxItemId)
      }

      await tx.insert(jobLineItems).values(
        parsedLineItems.map((item, i) => ({
          tenantId: orgId,
          jobId: data.id,
          type: item.type,
          refId: item.refId ?? null,
          description: item.description,
          qty: item.qty,
          rate: item.rate,
          cost: item.cost,
          taxItemId: item.taxItemId ?? null,
          sortOrder: i,
        })),
      )
    }

    // Replace tags
    await tx
      .delete(jobTags)
      .where(and(eq(jobTags.tenantId, orgId), eq(jobTags.jobId, data.id)))

    if (tagIds.length > 0) {
      await tx.insert(jobTags).values(
        tagIds.map((tagId) => ({
          tenantId: orgId,
          jobId: data.id,
          tagId,
        })),
      )
    }

    // Replace assignees
    await tx
      .delete(jobAssignees)
      .where(and(eq(jobAssignees.tenantId, orgId), eq(jobAssignees.jobId, data.id)))

    if (assigneeUserIds.length > 0) {
      await tx.insert(jobAssignees).values(
        assigneeUserIds.map((userId) => ({
          tenantId: orgId,
          jobId: data.id,
          userId,
          notify: false,
        })),
      )
    }

    // Activity event
    await tx.insert(customerEvents).values({
      tenantId: orgId,
      customerId: data.customerId,
      kind: 'job',
      title: `Updated job #JOB-${data.id}`,
      refId: data.id,
    })
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${data.id}`)
  revalidatePath(`/customers/${data.customerId}`)
  return { success: true, id: data.id }
}

// ── Status transition ────────────────────────────────────────────────────────

export async function transitionJobStatusAction(
  jobId: string,
  toStatus: string,
): Promise<JobActionState> {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await transitionJobStatus(jobId, toStatus, userId)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Illegal transition')) {
      return {
        error: "That status change isn't allowed from the current status. Pick a valid next status.",
      }
    }
    console.error('transitionJobStatusAction error:', err)
    return { error: message }
  }
}

// ── Line-item actions ────────────────────────────────────────────────────────

export async function addJobLineItem(
  jobId: string,
  input: {
    type: 'product' | 'service' | 'discount' | 'expense'
    refId?: string | null
    description: string
    qty?: string
    rate?: string
    cost?: string
    taxItemId?: string | null
  },
): Promise<void> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('Unauthorized')

  await withTenant(orgId, async (tx) => {
    if (input.taxItemId) await guardTaxItem(tx, orgId, input.taxItemId)

    const [{ maxOrder }] = await tx
      .select({ maxOrder: sql<number>`COALESCE(MAX(${jobLineItems.sortOrder}), -1)` })
      .from(jobLineItems)
      .where(and(eq(jobLineItems.tenantId, orgId), eq(jobLineItems.jobId, jobId)))

    await tx.insert(jobLineItems).values({
      tenantId: orgId,
      jobId,
      type: input.type,
      refId: input.refId ?? null,
      description: input.description,
      qty: input.qty ?? '1',
      rate: input.rate ?? '0',
      cost: input.cost ?? '0',
      taxItemId: input.taxItemId ?? null,
      sortOrder: (maxOrder ?? -1) + 1,
    })
  })

  revalidatePath(`/jobs/${jobId}`)
}

export async function updateJobLineItem(
  lineItemId: string,
  jobId: string,
  input: {
    description?: string
    qty?: string
    rate?: string
    cost?: string
    taxItemId?: string | null
  },
): Promise<void> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('Unauthorized')

  await withTenant(orgId, async (tx) => {
    if (input.taxItemId) await guardTaxItem(tx, orgId, input.taxItemId)

    await tx
      .update(jobLineItems)
      .set({
        description: input.description,
        qty: input.qty,
        rate: input.rate,
        cost: input.cost,
        taxItemId: input.taxItemId ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobLineItems.tenantId, orgId),
          eq(jobLineItems.id, lineItemId),
          eq(jobLineItems.jobId, jobId),
        ),
      )
  })

  revalidatePath(`/jobs/${jobId}`)
}

export async function deleteJobLineItem(
  lineItemId: string,
  jobId: string,
): Promise<void> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('Unauthorized')

  await withTenant(orgId, async (tx) => {
    await tx
      .delete(jobLineItems)
      .where(
        and(
          eq(jobLineItems.tenantId, orgId),
          eq(jobLineItems.id, lineItemId),
          eq(jobLineItems.jobId, jobId),
        ),
      )
  })

  revalidatePath(`/jobs/${jobId}`)
}

// ── RPC-style catalog search ─────────────────────────────────────────────────

export async function getCustomerContacts(
  customerId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { orgId } = await auth()
  if (!orgId) return []

  const { contacts } = await import('@/db/schema')
  const { withTenant: wt } = await import('@/db/with-tenant')
  return wt(orgId, async (tx) => {
    return tx
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(and(eq(contacts.tenantId, orgId), eq(contacts.customerId, customerId)))
      .orderBy(contacts.name)
  })
}

export async function getCustomerLocations(
  customerId: string,
): Promise<Array<{ id: string; name: string; addressLine1: string | null; city: string | null }>> {
  const { orgId } = await auth()
  if (!orgId) return []

  const { serviceLocations } = await import('@/db/schema')
  const { withTenant: wt } = await import('@/db/with-tenant')
  return wt(orgId, async (tx) => {
    return tx
      .select({
        id: serviceLocations.id,
        name: serviceLocations.name,
        addressLine1: serviceLocations.addressLine1,
        city: serviceLocations.city,
      })
      .from(serviceLocations)
      .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.customerId, customerId)))
      .orderBy(serviceLocations.name)
  })
}

export async function searchProductsAction(
  q: string,
): Promise<Array<{ id: string; name: string; unitPrice: string | null }>> {
  const { orgId } = await auth()
  if (!orgId) return []

  const { listProducts } = await import('@/lib/catalog')
  const result = await listProducts(orgId, { q, pageSize: 20 })
  return result.rows.map((r) => ({ id: r.id, name: r.name, unitPrice: r.unitPrice }))
}

export async function searchServicesAction(
  q: string,
): Promise<Array<{ id: string; name: string; unitPrice: string | null }>> {
  const { orgId } = await auth()
  if (!orgId) return []

  const { listServices } = await import('@/lib/catalog')
  const result = await listServices(orgId, { q, pageSize: 20 })
  return result.rows.map((r) => ({ id: r.id, name: r.name, unitPrice: r.unitPrice }))
}

// ── Reference data helpers for RSC ───────────────────────────────────────────

export async function listJobCategories(orgId: string): Promise<
  Array<{ id: string; name: string; parentId: string | null }>
> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: jobCategories.id, name: jobCategories.name, parentId: jobCategories.parentId })
      .from(jobCategories)
      .where(eq(jobCategories.tenantId, orgId))
      .orderBy(jobCategories.name)
  })
}

export async function listJobSources(orgId: string): Promise<Array<{ id: string; name: string }>> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: jobSources.id, name: jobSources.name })
      .from(jobSources)
      .where(eq(jobSources.tenantId, orgId))
      .orderBy(jobSources.name)
  })
}

export async function listTaxItems(orgId: string): Promise<Array<{ id: string; name: string; rate: string | null }>> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: taxItems.id, name: taxItems.name, rate: taxItems.rate })
      .from(taxItems)
      .where(eq(taxItems.tenantId, orgId))
      .orderBy(taxItems.name)
  })
}

export async function listOrgMembers(orgId: string): Promise<
  Array<{ id: string; label: string }>
> {
  try {
    const client = await clerkClient()
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    })
    return memberships.data.map((m) => ({
      id: m.publicUserData?.userId ?? m.id,
      label:
        [m.publicUserData?.firstName, m.publicUserData?.lastName]
          .filter(Boolean)
          .join(' ') ||
        m.publicUserData?.identifier ||
        'Member',
    }))
  } catch {
    return []
  }
}

// ── Photo upload ────────────────────────────────────────────────────────────

export async function uploadJobPhotoAction(
  jobId: string,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'No file selected.' }
  }

  try {
    const { uploadJobPhoto } = await import('@/lib/jobs/photos')
    await uploadJobPhoto(orgId, jobId, file)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('uploadJobPhotoAction error:', err)
    return { error: message }
  }
}

// ── Apply Template ───────────────────────────────────────────────────────────

export async function applyTemplateAction(
  templateId: string,
): Promise<{
  error?: string
  lineItems?: Array<{
    type: 'product' | 'service' | 'discount' | 'expense'
    refId: string | null
    description: string
    qty: string
    rate: string
    cost: string
    taxItemId: string | null
  }>
  tasks?: Array<{ label: string }>
}> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const { applyJobTemplate } = await import('@/lib/job-templates')
    const result = await applyJobTemplate(orgId, templateId)
    return {
      lineItems: result.lineItems.map((li) => ({
        type: li.type,
        refId: li.refId ?? null,
        description: li.description,
        qty: li.qty,
        rate: li.rate,
        cost: li.cost,
        taxItemId: li.taxItemId ?? null,
      })),
      tasks: result.tasks.map((t) => ({ label: t.label })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('applyTemplateAction error:', err)
    return { error: message }
  }
}

// ── Template list RPC ────────────────────────────────────────────────────────

export async function listJobTemplatesAction(): Promise<
  Array<{ id: string; name: string }>
> {
  const { orgId } = await auth()
  if (!orgId) return []
  const { listJobTemplates } = await import('@/lib/job-templates')
  const rows = await listJobTemplates(orgId)
  return rows.map((r) => ({ id: r.id, name: r.name }))
}

// ── Site Visits ──────────────────────────────────────────────────────────────

const siteVisitStatusSchema = z.enum([
  'unscheduled',
  'scheduled',
  'dispatched',
  'cancelled',
  'delayed',
  'on_the_way',
  'on_site',
  'started',
  'paused',
  'resumed',
  'partially_completed',
  'completed',
  'invoiced',
  'paid_in_full',
  'job_closed',
])

export async function addSiteVisit(
  jobId: string,
  input: {
    status?: string
    visitDate?: string | null
    arrivalWindowStart?: string | null
    arrivalWindowEnd?: string | null
    notes?: string
  },
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  const status = input.status ? siteVisitStatusSchema.safeParse(input.status) : null

  try {
    await withTenant(orgId, async (tx) => {
      await tx.insert(jobSiteVisits).values({
        tenantId: orgId,
        jobId,
        status: status?.success ? (status.data as any) : null,
        visitDate: input.visitDate ? new Date(input.visitDate) : null,
        arrivalWindowStart: input.arrivalWindowStart
          ? new Date(input.arrivalWindowStart)
          : null,
        arrivalWindowEnd: input.arrivalWindowEnd
          ? new Date(input.arrivalWindowEnd)
          : null,
        notes: input.notes,
      })
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not add site visit.'
    return { error: message }
  }
}

export async function updateSiteVisit(
  visitId: string,
  jobId: string,
  input: {
    status?: string
    visitDate?: string | null
    arrivalWindowStart?: string | null
    arrivalWindowEnd?: string | null
    notes?: string
  },
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  const status = input.status ? siteVisitStatusSchema.safeParse(input.status) : null

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .update(jobSiteVisits)
        .set({
          status: status?.success ? (status.data as any) : undefined,
          visitDate: input.visitDate !== undefined
            ? input.visitDate
              ? new Date(input.visitDate)
              : null
            : undefined,
          arrivalWindowStart:
            input.arrivalWindowStart !== undefined
              ? input.arrivalWindowStart
                ? new Date(input.arrivalWindowStart)
                : null
              : undefined,
          arrivalWindowEnd:
            input.arrivalWindowEnd !== undefined
              ? input.arrivalWindowEnd
                ? new Date(input.arrivalWindowEnd)
                : null
              : undefined,
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobSiteVisits.tenantId, orgId),
            eq(jobSiteVisits.id, visitId),
            eq(jobSiteVisits.jobId, jobId),
          ),
        )
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update site visit.'
    return { error: message }
  }
}

export async function deleteSiteVisit(
  visitId: string,
  jobId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .delete(jobSiteVisits)
        .where(
          and(
            eq(jobSiteVisits.tenantId, orgId),
            eq(jobSiteVisits.id, visitId),
            eq(jobSiteVisits.jobId, jobId),
          ),
        )
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete site visit.'
    return { error: message }
  }
}

// ── Job Tasks ────────────────────────────────────────────────────────────────

export async function addJobTask(
  jobId: string,
  label: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      const [{ maxOrder }] = await tx
        .select({ maxOrder: sql<number>`COALESCE(MAX(${jobTasks.sortOrder}), -1)` })
        .from(jobTasks)
        .where(and(eq(jobTasks.tenantId, orgId), eq(jobTasks.jobId, jobId)))

      await tx.insert(jobTasks).values({
        tenantId: orgId,
        jobId,
        label: label.trim(),
        sortOrder: (maxOrder ?? -1) + 1,
      })
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not add task.'
    return { error: message }
  }
}

export async function toggleJobTask(
  taskId: string,
  jobId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      const rows = await tx
        .select({ done: jobTasks.done })
        .from(jobTasks)
        .where(
          and(
            eq(jobTasks.tenantId, orgId),
            eq(jobTasks.id, taskId),
            eq(jobTasks.jobId, jobId),
          ),
        )
        .limit(1)

      const current = rows[0]?.done ?? false
      await tx
        .update(jobTasks)
        .set({ done: !current, updatedAt: new Date() })
        .where(
          and(
            eq(jobTasks.tenantId, orgId),
            eq(jobTasks.id, taskId),
            eq(jobTasks.jobId, jobId),
          ),
        )
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not toggle task.'
    return { error: message }
  }
}

export async function deleteJobTask(
  taskId: string,
  jobId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .delete(jobTasks)
        .where(
          and(
            eq(jobTasks.tenantId, orgId),
            eq(jobTasks.id, taskId),
            eq(jobTasks.jobId, jobId),
          ),
        )
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete task.'
    return { error: message }
  }
}

// ── Job Reminders ────────────────────────────────────────────────────────────

export async function addJobReminder(
  jobId: string,
  input: {
    remindAt?: string | null
    note?: string
  },
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      await tx.insert(jobReminders).values({
        tenantId: orgId,
        jobId,
        remindAt: input.remindAt ? new Date(input.remindAt) : null,
        note: input.note,
      })
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not add reminder.'
    return { error: message }
  }
}

export async function deleteJobReminder(
  reminderId: string,
  jobId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .delete(jobReminders)
        .where(
          and(
            eq(jobReminders.tenantId, orgId),
            eq(jobReminders.id, reminderId),
            eq(jobReminders.jobId, jobId),
          ),
        )
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete reminder.'
    return { error: message }
  }
}
