'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
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
  contactPhones,
  contactEmails,
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
import { nextAccountNo } from '@/lib/account-number'
import { transitionJobStatus } from '@/lib/jobs/transition-job-status'
import { logger } from '@/lib/logger'
import { normalizePhone } from '@/lib/utils'
import { broadcastJobEvent } from '@/lib/jobs/broadcast'

/**
 * ── Phone handling policy ──────────────────────────────────────────────────
 *  • DB stores RAW DIGITS ONLY (e.g. "7735597272").
 *  • Client-side formatting is display-only (e.g. "(773) 559-7272").
 *  • `normalizePhone` strips non-digits before every insert / upsert.
 *  • Downstream integrations (Twilio SMS, Stripe) never see parens or dashes.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

// DrizzleQueryError wraps the real Postgres error in .cause. Prefer the cause
// message so users see "null value in column…" rather than "Failed query: …".
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

// Arrival window inputs are time-only (HH:MM). Combine with the job's start
// date to produce a full timestamp. If no start date is set, the arrival
// window is stored as null — a time without a date is meaningless.
function combineDateTime(date: string | null | undefined, time: string | null | undefined): Date | null {
  if (!time || time.trim() === '') return null
  if (!date || date.trim() === '') return null
  const combined = new Date(`${date}T${time}`)
  if (isNaN(combined.getTime())) return null
  return combined
}

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
  // existing customer ID OR inline-create fields (validated manually)
  customerId: emptyToUndefined,
  newCustomerName: emptyToUndefined,
  newContactFirstName: emptyToUndefined,
  newContactLastName: emptyToUndefined,
  newContactPhone: emptyToUndefined,
  newContactEmail: emptyToUndefined,
  newLocationName: emptyToUndefined,
  newLocationAddress1: emptyToUndefined,
  newLocationAddress2: emptyToUndefined,
  newLocationCity: emptyToUndefined,
  newLocationState: emptyToUndefined,
  newLocationZip: emptyToUndefined,
  newLocationGated: z.preprocess((v) => v === 'true' || v === true, z.boolean().default(false)),
  newLocationLat: emptyToUndefined,
  newLocationLng: emptyToUndefined,
  contactId: emptyToNull,
  serviceLocationId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || val === '__new__' ? null : val),
    z.string().nullable().optional(),
  ),
  categoryId: emptyToNull,
  description: emptyToUndefined,
  poNumber: emptyToUndefined,
  jobSourceId: emptyToNull,
  assignedAgentId: emptyToUndefined,
  status: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.enum(['unscheduled','scheduled','dispatched','cancelled','delayed','on_the_way','on_site','started','paused','resumed','partially_completed','completed','invoiced','paid_in_full','job_closed']).default('unscheduled'),
  ),
  billingType: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.enum(['single_invoice', 'progress_billing', 'no_charge']).default('single_invoice'),
  ),
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

const phoneSchema = z.object({
  id: z.string().optional(),
  number: z.string().min(1),
  type: z.enum(['cell', 'home', 'work']).default('cell'),
  isPrimary: z.boolean().default(false),
})

const emailSchema = z.object({
  id: z.string().optional(),
  address: z.string().min(1),
  type: z.enum(['work', 'personal']).default('work'),
  isPrimary: z.boolean().default(false),
})

const contactUpdateSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().default(''),
  jobTitle: z.string().default(''),
  phones: z.preprocess(
    (arr) => (Array.isArray(arr) ? arr.filter((p) => (p as { number?: string })?.number?.trim()) : arr),
    z.array(phoneSchema).default([]),
  ),
  emails: z.preprocess(
    (arr) => (Array.isArray(arr) ? arr.filter((e) => (e as { address?: string })?.address?.trim()) : arr),
    z.array(emailSchema).default([]),
  ),
  smsConsent: z.boolean().default(false),
  billingContact: z.boolean().default(false),
  bookingContact: z.boolean().default(false),
})

const updateJobSchema = createJobSchema.extend({
  id: z.string().min(1),
  customerId: z.string().min(1),
  contactUpdate: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return undefined
      if (typeof val === 'string') {
        try {
          return JSON.parse(val)
        } catch {
          return undefined
        }
      }
      return val
    },
    contactUpdateSchema.optional(),
  ),
})

const lineItemSchema = z.object({
  type: z.enum(['product', 'service', 'discount', 'expense']),
  refId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
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
    newCustomerName: formData.get('newCustomerName'),
    newContactFirstName: formData.get('newContactFirstName'),
    newContactLastName: formData.get('newContactLastName'),
    newContactPhone: formData.get('newContactPhone'),
    newContactEmail: formData.get('newContactEmail'),
    newLocationName: formData.get('newLocationName'),
    newLocationAddress1: formData.get('newLocationAddress1'),
    newLocationAddress2: formData.get('newLocationAddress2'),
    newLocationCity: formData.get('newLocationCity'),
    newLocationState: formData.get('newLocationState'),
    newLocationZip: formData.get('newLocationZip'),
    newLocationGated: formData.get('newLocationGated'),
    newLocationLat: formData.get('newLocationLat'),
    newLocationLng: formData.get('newLocationLng'),
    status: formData.get('status'),
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
    const issue = parsed.error.issues[0]
    const field = issue?.path.length ? ` (${issue.path.join('.')})` : ''
    return { error: (issue?.message ?? 'Please check your input.') + field }
  }

  const data = parsed.data

  if (!data.customerId && !data.newCustomerName) {
    return { error: 'Customer is required.' }
  }

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
  let resolvedCustomerId = data.customerId ?? ''

  while (attempts < maxAttempts) {
    try {
      const id = await withTenant(orgId, async (tx) => {
        // Resolve or create customer
        if (data.customerId) {
          await guardCustomer(tx, orgId, data.customerId)
          resolvedCustomerId = data.customerId
        } else {
          const accountNo = await nextAccountNo(tx, orgId)
          const [newCust] = await tx
            .insert(customers)
            .values({ tenantId: orgId, accountNo, name: data.newCustomerName! })
            .returning({ id: customers.id })
          resolvedCustomerId = newCust.id
        }

        // Resolve or create contact
        let resolvedContactId: string | null = null
        if (data.contactId) {
          await guardContact(tx, orgId, data.contactId)
          resolvedContactId = data.contactId
        } else if (data.newContactFirstName || data.newContactLastName) {
          const [newContact] = await tx
            .insert(contacts)
            .values({
              tenantId: orgId,
              customerId: resolvedCustomerId,
              firstName: data.newContactFirstName || '',
              lastName: data.newContactLastName || null,
            })
            .returning({ id: contacts.id })
          resolvedContactId = newContact.id
          if (data.newContactPhone) {
            await tx.insert(contactPhones).values({
              tenantId: orgId,
              contactId: resolvedContactId,
              number: normalizePhone(data.newContactPhone)!,
              isPrimary: true,
            })
          }
          if (data.newContactEmail) {
            await tx.insert(contactEmails).values({
              tenantId: orgId,
              contactId: resolvedContactId,
              address: data.newContactEmail,
              type: 'work',
              isPrimary: true,
            })
          }

          // Auto-promote to primary if customer has none yet
          const [custForContact] = await tx
            .select({ primaryContactId: customers.primaryContactId })
            .from(customers)
            .where(and(eq(customers.tenantId, orgId), eq(customers.id, resolvedCustomerId)))
            .limit(1)
          if (!custForContact?.primaryContactId) {
            await tx
              .update(customers)
              .set({ primaryContactId: newContact.id, updatedAt: new Date() })
              .where(and(eq(customers.tenantId, orgId), eq(customers.id, resolvedCustomerId)))
          }
        }

        // Resolve or create service location
        let resolvedLocationId: string | null = null
        if (data.serviceLocationId) {
          await guardServiceLocation(tx, orgId, data.serviceLocationId)
          resolvedLocationId = data.serviceLocationId
        } else if (data.newLocationAddress1) {
          const [newLoc] = await tx
            .insert(serviceLocations)
            .values({
              tenantId: orgId,
              customerId: resolvedCustomerId,
              name: data.newLocationName ?? null,
              addressLine1: data.newLocationAddress1,
              addressLine2: data.newLocationAddress2 ?? null,
              city: data.newLocationCity ?? null,
              state: data.newLocationState ?? null,
              postalCode: data.newLocationZip ?? null,
              gated: data.newLocationGated ?? false,
              latitude: data.newLocationLat ?? null,
              longitude: data.newLocationLng ?? null,
            })
            .returning({ id: serviceLocations.id })
          resolvedLocationId = newLoc.id

          // Auto-promote to primary if customer has none yet
          const [cust] = await tx
            .select({ primaryLocationId: customers.primaryLocationId })
            .from(customers)
            .where(and(eq(customers.tenantId, orgId), eq(customers.id, resolvedCustomerId)))
            .limit(1)
          if (!cust?.primaryLocationId) {
            await tx
              .update(customers)
              .set({ primaryLocationId: newLoc.id, updatedAt: new Date() })
              .where(and(eq(customers.tenantId, orgId), eq(customers.id, resolvedCustomerId)))
          }
        }

        await guardCategory(tx, orgId, data.categoryId)
        await guardJobSource(tx, orgId, data.jobSourceId)

        const jobNo = await nextJobNo(tx, orgId)

        const [row] = await tx
          .insert(jobs)
          .values({
            tenantId: orgId,
            jobNo,
            customerId: resolvedCustomerId,
            contactId: resolvedContactId,
            serviceLocationId: resolvedLocationId,
            status: data.status,
            categoryId: data.categoryId,
            description: data.description,
            poNumber: data.poNumber,
            jobSourceId: data.jobSourceId,
            assignedAgentId: data.assignedAgentId,
            billingType: data.billingType,
            priority: data.priority,
            // Explicit local-midnight constructor preserves the intended calendar
            // date when the server serializes it to Postgres (matches the rules in
            // CLAUDE.md for calendar-date columns).
            startDate: data.startDate ? new Date(`${data.startDate}T00:00:00`) : null,
            endDate: data.endDate ? new Date(`${data.endDate}T00:00:00`) : null,
            arrivalWindowStart: combineDateTime(data.startDate, data.arrivalWindowStart),
            arrivalWindowEnd: combineDateTime(data.startDate, data.arrivalWindowEnd),
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
              title: item.title ?? null,
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
          customerId: resolvedCustomerId,
          kind: 'job',
          title: `Created job #JOB-${jobNo}`,
          refId: jobId,
        })

        return jobId
      })

      revalidatePath('/jobs')
      revalidatePath(`/jobs/${id}`)
      revalidatePath(`/customers/${resolvedCustomerId}`)
      return { success: true, id }
    } catch (err) {
      const pgErr = err as { code?: string; cause?: { code?: string } }
      const code = pgErr.code ?? pgErr.cause?.code
      if (code === '23505') {
        // Unique constraint race (job number collision) — retry
        attempts++
        if (attempts >= maxAttempts) {
          logger.error('createJob', err)
          return { error: 'Could not create job. Please try again.' }
        }
        await new Promise((r) => setTimeout(r, 100 * attempts))
        continue
      }
      logger.error('createJob', err)
      const message = extractErrorMessage(err)
      return { error: message || 'Could not create job. Please try again.' }
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
    newLocationName: formData.get('newLocationName'),
    newLocationAddress1: formData.get('newLocationAddress1'),
    newLocationAddress2: formData.get('newLocationAddress2'),
    newLocationCity: formData.get('newLocationCity'),
    newLocationState: formData.get('newLocationState'),
    newLocationZip: formData.get('newLocationZip'),
    newLocationGated: formData.get('newLocationGated'),
    newLocationLat: formData.get('newLocationLat'),
    newLocationLng: formData.get('newLocationLng'),
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
    contactUpdate: formData.get('contactUpdate'),
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path.length ? ` (${issue.path.join('.')})` : ''
    return { error: (issue?.message ?? 'Please check your input.') + field }
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

    let resolvedLocationId = data.serviceLocationId

    // Update existing location in-place when both ID and new address fields are present
    if (data.serviceLocationId && data.newLocationAddress1) {
      const locationFields: Record<string, unknown> = {
        addressLine1: data.newLocationAddress1,
        addressLine2: data.newLocationAddress2 ?? null,
        city: data.newLocationCity ?? null,
        state: data.newLocationState ?? null,
        postalCode: data.newLocationZip ?? null,
        gated: data.newLocationGated ?? false,
        latitude: data.newLocationLat ?? null,
        longitude: data.newLocationLng ?? null,
      }
      if (data.newLocationName) locationFields.name = data.newLocationName
      await tx
        .update(serviceLocations)
        .set(locationFields)
        .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, data.serviceLocationId)))
    }

    // Create a new location when editing a job and user picks "different address"
    if (!data.serviceLocationId && data.newLocationAddress1) {
      const [newLoc] = await tx
        .insert(serviceLocations)
        .values({
          tenantId: orgId,
          customerId: data.customerId,
          name: data.newLocationName ?? null,
          addressLine1: data.newLocationAddress1,
          addressLine2: data.newLocationAddress2 ?? null,
          city: data.newLocationCity ?? null,
          state: data.newLocationState ?? null,
          postalCode: data.newLocationZip ?? null,
          gated: data.newLocationGated ?? false,
          latitude: data.newLocationLat ?? null,
          longitude: data.newLocationLng ?? null,
        })
        .returning({ id: serviceLocations.id })
      resolvedLocationId = newLoc.id
    }

    // Update existing contact in-place when contactUpdate is provided
    if (data.contactUpdate && data.contactId) {
      const cu = data.contactUpdate
      await tx
        .update(contacts)
        .set({
          firstName: cu.firstName,
          lastName: cu.lastName || null,
          jobTitle: cu.jobTitle || null,
          smsConsent: cu.smsConsent,
          billingContact: cu.billingContact,
          bookingContact: cu.bookingContact,
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, data.contactId)))

      // Replace phones
      await tx
        .delete(contactPhones)
        .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.contactId, data.contactId)))
      const normPhones = cu.phones
        .map((p) => ({ ...p, number: normalizePhone(p.number) }))
        .filter((p) => p.number)
      if (normPhones.length > 0) {
        await tx.insert(contactPhones).values(
          normPhones.map((p) => ({
            tenantId: orgId,
            contactId: data.contactId!,
            number: p.number!,
            type: p.type,
            isPrimary: p.isPrimary,
          })),
        )
      }

      // Replace emails
      await tx
        .delete(contactEmails)
        .where(and(eq(contactEmails.tenantId, orgId), eq(contactEmails.contactId, data.contactId)))
      if (cu.emails.length > 0) {
        await tx.insert(contactEmails).values(
          cu.emails.map((e) => ({
            tenantId: orgId,
            contactId: data.contactId!,
            address: e.address,
            type: e.type,
            isPrimary: e.isPrimary,
          })),
        )
      }
    }

    // IMPORTANT: status is NEVER updated here (Pitfall 1)
    await tx
      .update(jobs)
      .set({
        customerId: data.customerId,
        contactId: data.contactId,
        serviceLocationId: resolvedLocationId,
        categoryId: data.categoryId,
        description: data.description,
        poNumber: data.poNumber,
        jobSourceId: data.jobSourceId,
        assignedAgentId: data.assignedAgentId,
        billingType: data.billingType,
        priority: data.priority,
        // Explicit local-midnight constructor preserves the intended calendar date.
        startDate: data.startDate ? new Date(`${data.startDate}T00:00:00`) : null,
        endDate: data.endDate ? new Date(`${data.endDate}T00:00:00`) : null,
        arrivalWindowStart: combineDateTime(data.startDate, data.arrivalWindowStart),
        arrivalWindowEnd: combineDateTime(data.startDate, data.arrivalWindowEnd),
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
          title: item.title ?? null,
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

  after(() => broadcastJobEvent(orgId, 'job-updated', { jobId: data.id }).catch(() => {}))

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
    after(() => broadcastJobEvent(orgId, 'job-status-changed', { jobId, toStatus }).catch(() => {}))
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    if (message.includes('Illegal transition')) {
      return {
        error: "That status change isn't allowed from the current status. Pick a valid next status.",
      }
    }
    logger.error('transitionJobStatusAction', err)
    return { error: message }
  }
}

// ── Line-item actions ────────────────────────────────────────────────────────

export async function addJobLineItem(
  jobId: string,
  input: {
    type: 'product' | 'service' | 'discount' | 'expense'
    refId?: string | null
    title?: string | null
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
      title: input.title ?? null,
      description: input.description,
      qty: input.qty ?? '1',
      rate: input.rate ?? '0',
      cost: input.cost ?? '0',
      taxItemId: input.taxItemId ?? null,
      sortOrder: (maxOrder ?? -1) + 1,
    })
  })

  revalidatePath(`/jobs/${jobId}`)
  after(() => broadcastJobEvent(orgId, 'job-updated', { jobId }).catch(() => {}))
}

export async function updateJobLineItem(
  lineItemId: string,
  jobId: string,
  input: {
    title?: string | null
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

    const setFields: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    if (input.title !== undefined) setFields.title = input.title
    if (input.description !== undefined) setFields.description = input.description
    if (input.qty !== undefined) setFields.qty = input.qty
    if (input.rate !== undefined) setFields.rate = input.rate
    if (input.cost !== undefined) setFields.cost = input.cost
    if (input.taxItemId !== undefined) setFields.taxItemId = input.taxItemId ?? null

    await tx
      .update(jobLineItems)
      .set(setFields)
      .where(
        and(
          eq(jobLineItems.tenantId, orgId),
          eq(jobLineItems.id, lineItemId),
          eq(jobLineItems.jobId, jobId),
        ),
      )
  })

  revalidatePath(`/jobs/${jobId}`)
  after(() => broadcastJobEvent(orgId, 'job-updated', { jobId }).catch(() => {}))
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
  after(() => broadcastJobEvent(orgId, 'job-updated', { jobId }).catch(() => {}))
}

// ── RPC-style catalog search ─────────────────────────────────────────────────

export async function getCustomerContacts(
  customerId: string,
): Promise<{ contacts: Array<{ id: string; firstName: string; lastName: string | null }>; primaryContactId: string | null }> {
  const { orgId } = await auth()
  if (!orgId) return { contacts: [], primaryContactId: null }

  const { contacts, customers } = await import('@/db/schema')
  const { withTenant: wt } = await import('@/db/with-tenant')
  return wt(orgId, async (tx) => {
    const [contactRows, customerRow] = await Promise.all([
      tx
        .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(and(eq(contacts.tenantId, orgId), eq(contacts.customerId, customerId)))
        .orderBy(contacts.firstName, contacts.lastName),
      tx
        .select({ primaryContactId: customers.primaryContactId })
        .from(customers)
        .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
        .limit(1),
    ])
    return { contacts: contactRows, primaryContactId: customerRow[0]?.primaryContactId ?? null }
  })
}

export interface ContactDetail {
  id: string
  firstName: string
  lastName: string | null
  jobTitle: string | null
  birthday: string | null
  anniversary: string | null
  smsConsent: boolean | null
  billingContact: boolean | null
  bookingContact: boolean | null
  phones: Array<{
    id?: string
    number: string
    type: string
    isPrimary: boolean | null
  }>
  emails: Array<{
    id?: string
    address: string
    type: string
    isPrimary: boolean | null
  }>
}

export async function getCustomerContactDetail(
  contactId: string,
): Promise<ContactDetail | null> {
  const { orgId } = await auth()
  if (!orgId) return null

  const { contacts, contactPhones, contactEmails } = await import('@/db/schema')
  const { withTenant: wt } = await import('@/db/with-tenant')
  return wt(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, contactId)))
      .limit(1)
    if (!rows[0]) return null

    const [phones, emails] = await Promise.all([
      tx
        .select()
        .from(contactPhones)
        .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.contactId, contactId))),
      tx
        .select()
        .from(contactEmails)
        .where(and(eq(contactEmails.tenantId, orgId), eq(contactEmails.contactId, contactId))),
    ])

    const c = rows[0]
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      jobTitle: c.jobTitle,
      birthday: c.birthday,
      anniversary: c.anniversary,
      smsConsent: c.smsConsent,
      billingContact: c.billingContact,
      bookingContact: c.bookingContact,
      phones: phones.map((p) => ({
        id: p.id,
        number: p.number,
        type: p.type,
        isPrimary: p.isPrimary,
      })),
      emails: emails.map((e) => ({
        id: e.id,
        address: e.address,
        type: e.type,
        isPrimary: e.isPrimary,
      })),
    }
  })
}

export async function getCustomerLocations(
  customerId: string,
): Promise<{ locations: Array<{ id: string; name: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; gated: boolean | null }>; primaryLocationId: string | null }> {
  const { orgId } = await auth()
  if (!orgId) return { locations: [], primaryLocationId: null }

  const { serviceLocations, customers } = await import('@/db/schema')
  const { withTenant: wt } = await import('@/db/with-tenant')
  const { sql } = await import('drizzle-orm')
  return wt(orgId, async (tx) => {
    const [locationRows, customerRow] = await Promise.all([
      tx
        .select({
          id: serviceLocations.id,
          name: serviceLocations.name,
          addressLine1: serviceLocations.addressLine1,
          addressLine2: serviceLocations.addressLine2,
          city: serviceLocations.city,
          state: serviceLocations.state,
          postalCode: serviceLocations.postalCode,
          gated: serviceLocations.gated,
        })
        .from(serviceLocations)
        .innerJoin(customers, eq(customers.id, serviceLocations.customerId))
        .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.customerId, customerId)))
        .orderBy(
          sql`CASE WHEN ${serviceLocations.id} = ${customers.primaryLocationId} THEN 0 ELSE 1 END`,
          serviceLocations.name,
        ),
      tx
        .select({ primaryLocationId: customers.primaryLocationId })
        .from(customers)
        .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
        .limit(1),
    ])
    return { locations: locationRows, primaryLocationId: customerRow[0]?.primaryLocationId ?? null }
  })
}

export async function createContactForJob(
  customerId: string,
  input: {
    firstName: string
    lastName?: string | null
    phone?: string | null
    email?: string | null
  },
): Promise<{ id: string; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { id: '', error: 'No active organization. Please sign in to your workspace.' }

  try {
    const [row] = await withTenant(orgId, async (tx) => {
      const custRows = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
        .limit(1)
      if (custRows.length === 0) throw new Error('Invalid customer: cross-tenant access denied')

      const [newContact] = await tx
        .insert(contacts)
        .values({
          tenantId: orgId,
          customerId,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
        })
        .returning({ id: contacts.id })

      if (input.phone) {
        await tx.insert(contactPhones).values({
          tenantId: orgId,
          contactId: newContact.id,
          number: normalizePhone(input.phone)!,
          type: 'cell',
          isPrimary: true,
        })
      }
      if (input.email) {
        await tx.insert(contactEmails).values({
          tenantId: orgId,
          contactId: newContact.id,
          address: input.email,
          type: 'work',
          isPrimary: true,
        })
      }

      return [newContact]
    })

    revalidatePath(`/customers/${customerId}`)
    return { id: row.id }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('createContactForJob', err)
    return { id: '', error: message }
  }
}

export async function createServiceLocation(
  customerId: string,
  input: {
    name?: string | null
    addressLine1: string
    addressLine2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    gated?: boolean
    latitude?: string | null
    longitude?: string | null
  },
): Promise<{ id: string; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { id: '', error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const [row] = await withTenant(orgId, async (tx) => {
      // Guard: verify customer belongs to tenant
      const custRows = await tx
        .select({ id: customers.id, primaryLocationId: customers.primaryLocationId })
        .from(customers)
        .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
        .limit(1)
      if (custRows.length === 0) throw new Error('Invalid customer: cross-tenant access denied')

      const [newLoc] = await tx
        .insert(serviceLocations)
        .values({
          tenantId: orgId,
          customerId,
          name: input.name ?? null,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          postalCode: input.postalCode ?? null,
          gated: input.gated ?? false,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
        })
        .returning({ id: serviceLocations.id })

      // Auto-promote to primary if customer has none yet
      if (!custRows[0].primaryLocationId) {
        await tx
          .update(customers)
          .set({ primaryLocationId: newLoc.id, updatedAt: new Date() })
          .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
      }

      return [newLoc]
    })

    revalidatePath(`/customers/${customerId}`)
    return { id: row.id }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('createServiceLocation', err)
    return { id: '', error: message }
  }
}

export async function updateServiceLocation(
  locationId: string,
  input: {
    name?: string | null
    addressLine1?: string
    addressLine2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    gated?: boolean
    latitude?: string | null
    longitude?: string | null
  },
): Promise<{ id: string; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { id: '', error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await withTenant(orgId, async (tx) => {
      // Guard: verify location belongs to tenant
      const locRows = await tx
        .select({ id: serviceLocations.id })
        .from(serviceLocations)
        .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, locationId)))
        .limit(1)
      if (locRows.length === 0) throw new Error('Invalid location: cross-tenant access denied')

      return tx
        .update(serviceLocations)
        .set({
          name: input.name ?? null,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          postalCode: input.postalCode ?? null,
          gated: input.gated ?? false,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, locationId)))
    })

    revalidatePath('/jobs/[id]', 'page')
    return { id: locationId }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('updateServiceLocation', err)
    return { id: '', error: message }
  }
}

export async function searchProductsAction(
  q: string,
): Promise<Array<{ id: string; name: string; unitPrice: string | null; unitCost: string | null; description: string | null }>> {
  const { orgId } = await auth()
  if (!orgId) return []

  const { listProducts } = await import('@/lib/catalog')
  const result = await listProducts(orgId, { q, pageSize: 20 })
  return result.rows.map((r) => ({ id: r.id, name: r.name, unitPrice: r.unitPrice, unitCost: r.unitCost, description: r.salesDescription }))
}

export async function searchServicesAction(
  q: string,
): Promise<Array<{ id: string; name: string; unitPrice: string | null; unitCost: string | null; description: string | null }>> {
  const { orgId } = await auth()
  if (!orgId) return []

  const { listServices } = await import('@/lib/catalog')
  const result = await listServices(orgId, { q, pageSize: 20 })
  return result.rows.map((r) => ({ id: r.id, name: r.name, unitPrice: r.unitPrice, unitCost: r.unitCost, description: r.description }))
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
    const message = extractErrorMessage(err)
    logger.error('uploadJobPhotoAction', err)
    return { error: message }
  }
}

/**
 * Step 1 of signed-URL direct upload: get a signed URL + path.
 * Client uploads the file directly to this URL, then calls confirmJobPhotoAction.
 *
 * No file bytes travel through the Server Action — only filename + size.
 */
export async function getJobPhotoUploadUrlAction(
  jobId: string,
  filename: string,
  fileSize: number,
): Promise<{ error?: string; signedUrl?: string; path?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  if (!filename || fileSize === 0) {
    return { error: 'No file selected.' }
  }

  try {
    const { createJobPhotoSignedUploadUrl } = await import('@/lib/jobs/photos')
    const result = await createJobPhotoSignedUploadUrl(orgId, jobId, filename, fileSize)
    return { signedUrl: result.signedUrl, path: result.path }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('getJobPhotoUploadUrlAction', err)
    return { error: message }
  }
}

/**
 * Step 2 of signed-URL direct upload: record the photo in DB after client upload.
 */
export async function confirmJobPhotoAction(
  jobId: string,
  path: string,
): Promise<{ error?: string; success?: boolean }> {
  const { orgId, userId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const { confirmJobPhoto } = await import('@/lib/jobs/photos')
    await confirmJobPhoto(orgId, jobId, path, userId)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('confirmJobPhotoAction', err)
    return { error: message }
  }
}

/**
 * Delete a job photo from Storage and DB.
 */
export async function deleteJobPhotoAction(
  jobId: string,
  photoId: string,
): Promise<{ error?: string; success?: boolean }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const { deleteJobPhoto } = await import('@/lib/jobs/photos')
    await deleteJobPhoto(orgId, jobId, photoId)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('deleteJobPhotoAction', err)
    return { error: message }
  }
}

/**
 * Fetch signed view URLs for all photos on a job (tech PWA client use).
 */
export async function getJobSignedPhotosAction(
  jobId: string,
): Promise<{ photos?: { id: string; url: string; uploadedBy: string | null; createdAt: Date | null }[]; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    const { getJobPhotoSignedUrls } = await import('@/lib/jobs/photos')
    const photos = await getJobPhotoSignedUrls(orgId, jobId)
    return { photos }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('getJobSignedPhotosAction', err)
    return { error: message }
  }
}

/**
 * Fetch signed view URLs for all signatures on a job (tech PWA + desktop Sign tab).
 */
export async function getJobSignedSignaturesAction(
  jobId: string,
): Promise<{ signatures?: { id: string; url: string; signatureType: 'start' | 'complete' | null; signedBy: string | null; capturedBy: string | null; createdAt: Date | null }[]; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    const { getJobSignatureSignedUrls } = await import('@/lib/jobs/signatures')
    const signatures = await getJobSignatureSignedUrls(orgId, jobId)
    return { signatures }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('getJobSignedSignaturesAction', err)
    return { error: message }
  }
}

/**
 * Update signature metadata (type and/or signer name).
 */
export async function updateJobSignatureAction(
  jobId: string,
  signatureId: string,
  input: {
    signatureType?: 'start' | 'complete' | null
    signedBy?: string
  },
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    const { updateJobSignature } = await import('@/lib/jobs/signatures')
    await updateJobSignature(orgId, jobId, signatureId, input)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('updateJobSignatureAction', err)
    return { error: message }
  }
}

/**
 * Delete a signature from Storage and DB.
 */
export async function deleteJobSignatureAction(
  jobId: string,
  signatureId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    const { deleteJobSignature } = await import('@/lib/jobs/signatures')
    await deleteJobSignature(orgId, jobId, signatureId)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('deleteJobSignatureAction', err)
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
    title: string | null
    description: string
    qty: string
    rate: string
    cost: string
    taxItemId: string | null
  }>
  tasks?: Array<{ label: string }>
}> {
  const { userId, orgId } = await auth()

  if (!userId) {
    return { error: 'Not authenticated. Please sign in.' }
  }
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
        title: li.title ?? null,
        description: li.description,
        qty: li.qty,
        rate: li.rate,
        cost: li.cost,
        taxItemId: li.taxItemId ?? null,
      })),
      tasks: result.tasks.map((t) => ({ label: t.label })),
    }
  } catch (err) {
    const message = extractErrorMessage(err)
    logger.error('applyTemplateAction', err)
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
        status: status?.success ? status.data : null,
        visitDate: input.visitDate ? new Date(input.visitDate) : null,
        arrivalWindowStart: combineDateTime(input.visitDate, input.arrivalWindowStart),
        arrivalWindowEnd: combineDateTime(input.visitDate, input.arrivalWindowEnd),
        notes: input.notes,
      })
    })
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err) || 'Could not add site visit.'
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
          status: status?.success ? status.data : undefined,
          visitDate: input.visitDate !== undefined
            ? input.visitDate
              ? new Date(input.visitDate)
              : null
            : undefined,
          arrivalWindowStart:
            input.arrivalWindowStart !== undefined
              ? combineDateTime(input.visitDate, input.arrivalWindowStart)
              : undefined,
          arrivalWindowEnd:
            input.arrivalWindowEnd !== undefined
              ? combineDateTime(input.visitDate, input.arrivalWindowEnd)
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
    const message = extractErrorMessage(err) || 'Could not update site visit.'
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
    const message = extractErrorMessage(err) || 'Could not delete site visit.'
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
    const message = extractErrorMessage(err) || 'Could not add task.'
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
    const message = extractErrorMessage(err) || 'Could not toggle task.'
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
    const message = extractErrorMessage(err) || 'Could not delete task.'
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
    const message = extractErrorMessage(err) || 'Could not add reminder.'
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
    const message = extractErrorMessage(err) || 'Could not delete reminder.'
    return { error: message }
  }
}
