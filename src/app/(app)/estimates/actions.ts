'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and, sql, max, count, desc, isNull, inArray } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import type { Tx } from '@/db/with-tenant'
import {
  estimates,
  estimateLineItems,
  estimateTags,
  estimateAssignees,
  estimateTasks,
  estimateReminders,
  lineItemGroups,
  customerEvents,
  customers,
  contacts,
  contactPhones,
  contactEmails,
  serviceLocations,
  jobCategories,
  taxItems,
  jobs,
  jobLineItems,
  jobTags,
  jobAssignees,
  estimateTemplates,
  estimateTemplateLineItems,
  estimateTemplateTasks,
  salesReps,
} from '@/db/schema'
import { listSalesReps } from '@/lib/settings'
import { nextEstimateNo } from '@/lib/estimates/estimate-number'
import { nextAccountNo } from '@/lib/account-number'
import { computeEstimateTotals } from '@/lib/estimates/totals'
import { estimateStatusLabel } from '@/lib/estimates/status'
import { logger } from '@/lib/logger'
import { normalizePhone } from '@/lib/utils'
import type { CachedEstimate } from '@/app/(tech)/lib/dexie'
import {
  searchProductsAction as jobsSearchProductsAction,
  searchServicesAction as jobsSearchServicesAction,
  getCustomerContacts as jobsGetCustomerContacts,
  getCustomerLocations as jobsGetCustomerLocations,
  listJobCategories as jobsListJobCategories,
  listJobSources as jobsListJobSources,
  listTaxItems as jobsListTaxItems,
  listOrgMembers as jobsListOrgMembers,
} from '@/app/(app)/jobs/actions'

// ── Re-export PWA input shape so the canonical action can accept it ───────────
export type { CreateEstimateInput } from '@/app/(tech)/tech/estimates/actions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

const emptyToUndefined = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.string().optional(),
)

const emptyToNull = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.string().nullable().optional(),
)

const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(), // PWA shape alias
  qty: z.string().optional(),
  rate: z.string().optional(),
  unitPrice: z.string().optional(), // PWA shape alias
  type: z.enum(['product', 'service', 'discount', 'expense']).optional(),
  cost: z.string().optional(),
  groupId: z.string().nullable().optional(),
  taxItemId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  refId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
})

const lineItemGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  sortOrder: z.number().default(0),
})

// ── Guard helpers ─────────────────────────────────────────────────────────────

async function guardEstimateOwner(tx: Tx, orgId: string, estimateId: string) {
  const rows = await tx
    .select({ id: estimates.id })
    .from(estimates)
    .where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Estimate not found or access denied')
}

async function guardCustomer(tx: Tx, orgId: string, customerId: string) {
  const rows = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid customer: cross-tenant access denied')
}

async function guardContact(tx: Tx, orgId: string, contactId: string | null | undefined) {
  if (!contactId) return
  const rows = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, contactId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid contact: cross-tenant access denied')
}

async function guardServiceLocation(tx: Tx, orgId: string, locationId: string | null | undefined) {
  if (!locationId) return
  const rows = await tx
    .select({ id: serviceLocations.id })
    .from(serviceLocations)
    .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, locationId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid service location: cross-tenant access denied')
}

async function guardCategory(tx: Tx, orgId: string, categoryId: string | null | undefined) {
  if (!categoryId) return
  const rows = await tx
    .select({ id: jobCategories.id })
    .from(jobCategories)
    .where(and(eq(jobCategories.tenantId, orgId), eq(jobCategories.id, categoryId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid category: cross-tenant access denied')
}

async function guardTaxItem(tx: Tx, orgId: string, taxItemId: string | null | undefined) {
  if (!taxItemId) return
  const rows = await tx
    .select({ id: taxItems.id })
    .from(taxItems)
    .where(and(eq(taxItems.tenantId, orgId), eq(taxItems.id, taxItemId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid tax item: cross-tenant access denied')
}

async function guardSalesRep(tx: Tx, orgId: string, salesRepId: string | null | undefined) {
  if (!salesRepId) return
  const rows = await tx
    .select({ id: salesReps.id })
    .from(salesReps)
    .where(and(eq(salesReps.tenantId, orgId), eq(salesReps.id, salesRepId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Invalid sales rep: cross-tenant access denied')
}

// ── Action State Types ─────────────────────────────────────────────────────────

export type EstimateActionState = {
  error?: string
  success?: boolean
  id?: string
}

// ── Canonical actions ─────────────────────────────────────────────────────────

export async function createEstimateAction(
  orgId: string,
  input: import('@/app/(tech)/tech/estimates/actions').CreateEstimateInput,
): Promise<{ id: string }> {
  const data = input

  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    try {
      const id = await withTenant(orgId, async (tx) => {
        await guardCustomer(tx, orgId, data.customerId)
        await guardContact(tx, orgId, data.serviceLocationId ? undefined : undefined) // no contact in PWA shape
        await guardServiceLocation(tx, orgId, data.serviceLocationId)

        const estimateNo = await nextEstimateNo(tx, orgId)

        const [row] = await tx
          .insert(estimates)
          .values({
            tenantId: orgId,
            estimateNo,
            customerId: data.customerId,
            serviceLocationId: data.serviceLocationId,
            contactId: null,
            description: data.description,
            followUpDate: data.followUpDate || null,
            expiryDate: data.expiryDate || null,
            notes: data.notes,
            internalNotes: data.internalNotes,
          })
          .returning({ id: estimates.id, estimateNo: estimates.estimateNo, customerId: estimates.customerId })

        const estimateId = row.id

        // Line items (PWA shape)
        if (data.lineItems && data.lineItems.length > 0) {
          await tx.insert(estimateLineItems).values(
            data.lineItems.map((item, i) => ({
              tenantId: orgId,
              estimateId,
              type: 'service' as const,
              description: item.name,
              qty: item.qty,
              rate: item.unitPrice,
              cost: '0',
              taxItemId: null,
              sortOrder: i,
            })),
          )
        }

        await tx.insert(customerEvents).values({
          tenantId: orgId,
          customerId: row.customerId,
          kind: 'estimate',
          title: `Estimate #EST-${estimateNo} created`,
          refId: estimateId,
        })

        return estimateId
      })

      revalidatePath('/estimates')
      revalidatePath(`/estimates/${id}`)
      return { id }
    } catch (err) {
      const pgErr = err as { code?: string; cause?: { code?: string } }
      const code = pgErr.code ?? pgErr.cause?.code
      if (code === '23505') {
        attempts++
        if (attempts >= maxAttempts) {
          logger.error('createEstimateAction', err)
          throw new Error('Could not create estimate. Please try again.')
        }
        await new Promise((r) => setTimeout(r, 100 * attempts))
        continue
      }
      logger.error('createEstimateAction', err)
      throw new Error(extractErrorMessage(err) || 'Could not create estimate. Please try again.')
    }
  }

  throw new Error('Could not create estimate. Please try again.')
}

export async function createOfficeEstimateAction(
  orgId: string,
  data: Record<string, unknown>,
): Promise<EstimateActionState> {
  const parsed = updateEstimateSchema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path.length ? ` (${issue.path.join('.')})` : ''
    return { error: (issue?.message ?? 'Please check your input.') + field }
  }

  const d = parsed.data

  let parsedLineItems: z.infer<typeof lineItemSchema>[] = []
  try {
    const raw = JSON.parse(d.lineItems)
    if (Array.isArray(raw)) {
      parsedLineItems = raw
        .map((item) => lineItemSchema.safeParse(item))
        .filter((r): r is z.ZodSafeParseSuccess<z.infer<typeof lineItemSchema>> => r.success)
        .map((r) => r.data)
    }
  } catch {
    // ignore malformed JSON
  }

  let parsedGroups: z.infer<typeof lineItemGroupSchema>[] = []
  try {
    const raw = JSON.parse(d.groups)
    if (Array.isArray(raw)) {
      parsedGroups = raw
        .map((g) => lineItemGroupSchema.safeParse(g))
        .filter((r): r is z.ZodSafeParseSuccess<z.infer<typeof lineItemGroupSchema>> => r.success)
        .map((r) => r.data)
    }
  } catch {
    // ignore malformed JSON
  }

  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    try {
      const id = await withTenant(orgId, async (tx) => {
        // Resolve or create customer
        let resolvedCustomerId = d.customerId ?? ''
        if (d.customerId) {
          await guardCustomer(tx, orgId, d.customerId)
          resolvedCustomerId = d.customerId
        } else if (d.newCustomerName) {
          const accountNo = await nextAccountNo(tx, orgId)
          const [newCust] = await tx
            .insert(customers)
            .values({ tenantId: orgId, accountNo, name: d.newCustomerName })
            .returning({ id: customers.id })
          resolvedCustomerId = newCust.id
        }

        // Resolve or create contact
        let resolvedContactId: string | null = null
        if (d.contactId) {
          await guardContact(tx, orgId, d.contactId)
          resolvedContactId = d.contactId
        } else if (d.newContactFirstName || d.newContactLastName) {
          const [newContact] = await tx
            .insert(contacts)
            .values({
              tenantId: orgId,
              customerId: resolvedCustomerId,
              firstName: d.newContactFirstName || '',
              lastName: d.newContactLastName || null,
            })
            .returning({ id: contacts.id })
          resolvedContactId = newContact.id
          const phoneDigits = normalizePhone(d.newContactPhone)
          if (phoneDigits) {
            await tx.insert(contactPhones).values({
              tenantId: orgId,
              contactId: resolvedContactId,
              number: phoneDigits,
              isPrimary: true,
            })
          }
          if (d.newContactEmail) {
            await tx.insert(contactEmails).values({
              tenantId: orgId,
              contactId: resolvedContactId,
              address: d.newContactEmail,
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
        if (d.serviceLocationId) {
          await guardServiceLocation(tx, orgId, d.serviceLocationId)
          resolvedLocationId = d.serviceLocationId
        } else if (d.newLocationAddress1) {
          const [newLoc] = await tx
            .insert(serviceLocations)
            .values({
              tenantId: orgId,
              customerId: resolvedCustomerId,
              addressLine1: d.newLocationAddress1,
              addressLine2: d.newLocationAddress2 ?? null,
              city: d.newLocationCity ?? null,
              state: d.newLocationState ?? null,
              postalCode: d.newLocationPostalCode ?? null,
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

        await guardCategory(tx, orgId, d.categoryId)
        await guardSalesRep(tx, orgId, d.assignedAgentId)

        const estimateNo = await nextEstimateNo(tx, orgId)

        const [row] = await tx
          .insert(estimates)
          .values({
            tenantId: orgId,
            estimateNo,
            customerId: resolvedCustomerId,
            contactId: resolvedContactId,
            serviceLocationId: resolvedLocationId,
            categoryId: d.categoryId,
            description: d.description,
            poNumber: d.poNumber,
            opportunityRating: d.opportunityRating,
            referralSourceId: d.referralSourceId,
            expiryDate: d.expiryDate || null,
            followUpDate: d.followUpDate || null,
            onSiteDate: d.onSiteDate ? new Date(d.onSiteDate) : null,
            arrivalWindowStart: d.arrivalWindowStart ? new Date(d.arrivalWindowStart) : null,
            arrivalWindowEnd: d.arrivalWindowEnd ? new Date(d.arrivalWindowEnd) : null,
            notesForTechs: d.notesForTechs,
            notes: d.notes,
            internalNotes: d.internalNotes,
            assignedAgentId: d.assignedAgentId,
          })
          .returning({ id: estimates.id, customerId: estimates.customerId, estimateNo: estimates.estimateNo })

        const estimateId = row.id

        // Groups
        const groupIdMap = new Map<string, string>()
        if (parsedGroups.length > 0) {
          const insertedGroups = await tx
            .insert(lineItemGroups)
            .values(
              parsedGroups.map((g) => ({
                tenantId: orgId,
                estimateId,
                name: g.name,
                sortOrder: g.sortOrder,
              })),
            )
            .returning({ id: lineItemGroups.id })
          parsedGroups.forEach((g, i) => {
            if (g.id) groupIdMap.set(g.id, insertedGroups[i].id)
          })
        }

        // Line items
        if (parsedLineItems.length > 0) {
          for (const item of parsedLineItems) {
            const taxId = item.taxItemId ?? null
            if (taxId) await guardTaxItem(tx, orgId, taxId)
          }

          await tx.insert(estimateLineItems).values(
            parsedLineItems.map((item, i) => ({
              tenantId: orgId,
              estimateId,
              type: item.type ?? 'service',
              refId: item.refId ?? null,
              title: item.title ?? null,
              description: item.description ?? '',
              qty: item.qty ?? '1',
              rate: item.rate ?? '0',
              cost: item.cost ?? '0',
              taxItemId: item.taxItemId ?? null,
              sortOrder: item.sortOrder ?? i,
              groupId: item.groupId ? groupIdMap.get(item.groupId) ?? item.groupId : null,
            })),
          )
        }

        // Tags
        if (d.tagIds.length > 0) {
          await tx.insert(estimateTags).values(
            d.tagIds.map((tagId) => ({ tenantId: orgId, estimateId, tagId })),
          )
        }

        // Assignees
        if (d.assigneeUserIds.length > 0) {
          await tx.insert(estimateAssignees).values(
            d.assigneeUserIds.map((userId) => ({ tenantId: orgId, estimateId, userId, notify: false })),
          )
        }

        await tx.insert(customerEvents).values({
          tenantId: orgId,
          customerId: row.customerId,
          kind: 'estimate',
          title: `Estimate #EST-${estimateNo} created`,
          refId: estimateId,
        })

        return { id: estimateId, estimateNo }
      })

      revalidatePath('/estimates')
      revalidatePath(`/estimates/${id.id}`)
      return { success: true, id: id.id }
    } catch (err) {
      const pgErr = err as { code?: string; cause?: { code?: string } }
      const code = pgErr.code ?? pgErr.cause?.code
      if (code === '23505') {
        attempts++
        if (attempts >= maxAttempts) {
          logger.error('createOfficeEstimateAction', err)
          return { error: 'Could not create estimate. Please try again.' }
        }
        await new Promise((r) => setTimeout(r, 100 * attempts))
        continue
      }
      logger.error('createOfficeEstimateAction', err)
      return { error: extractErrorMessage(err) || 'Could not create estimate. Please try again.' }
    }
  }

  return { error: 'Could not create estimate. Please try again.' }
}

// Office-only update schema: accepts full estimate fields + line items + groups.
const updateEstimateSchema = z.object({
  customerId: emptyToUndefined,
  newCustomerName: emptyToUndefined,
  newContactFirstName: emptyToUndefined,
  newContactLastName: emptyToUndefined,
  newContactPhone: emptyToUndefined,
  newContactEmail: emptyToUndefined,
  newLocationAddress1: emptyToUndefined,
  newLocationAddress2: emptyToUndefined,
  newLocationCity: emptyToUndefined,
  newLocationState: emptyToUndefined,
  newLocationPostalCode: emptyToUndefined,
  contactId: emptyToNull,
  serviceLocationId: emptyToNull,
  categoryId: emptyToNull,
  description: emptyToUndefined,
  poNumber: emptyToUndefined,
  opportunityRating: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().min(1).max(5).nullable().optional(),
  ),
  referralSourceId: emptyToNull,
  expiryDate: emptyToNull,
  followUpDate: emptyToNull,
  onSiteDate: emptyToNull,
  arrivalWindowStart: emptyToNull,
  arrivalWindowEnd: emptyToNull,
  notesForTechs: emptyToUndefined,
  notes: emptyToUndefined,
  internalNotes: emptyToUndefined,
  assignedAgentId: emptyToNull,
  tagIds: z.array(z.string()).default([]),
  assigneeUserIds: z.array(z.string()).default([]),
  lineItems: z.string().default('[]'),
  groups: z.string().default('[]'),
}).refine((data) => data.customerId || data.newCustomerName, {
  message: 'Customer is required.',
  path: ['customerId'],
})

export async function updateEstimateAction(
  orgId: string,
  estimateId: string,
  data: Record<string, unknown>,
): Promise<EstimateActionState> {
  const parsed = updateEstimateSchema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path.length ? ` (${issue.path.join('.')})` : ''
    return { error: (issue?.message ?? 'Please check your input.') + field }
  }

  const d = parsed.data

  let parsedLineItems: z.infer<typeof lineItemSchema>[] = []
  try {
    const raw = JSON.parse(d.lineItems)
    if (Array.isArray(raw)) {
      parsedLineItems = raw
        .map((item) => lineItemSchema.safeParse(item))
        .filter((r): r is z.ZodSafeParseSuccess<z.infer<typeof lineItemSchema>> => r.success)
        .map((r) => r.data)
    }
  } catch {
    // ignore malformed JSON
  }

  let parsedGroups: z.infer<typeof lineItemGroupSchema>[] = []
  try {
    const raw = JSON.parse(d.groups)
    if (Array.isArray(raw)) {
      parsedGroups = raw
        .map((g) => lineItemGroupSchema.safeParse(g))
        .filter((r): r is z.ZodSafeParseSuccess<z.infer<typeof lineItemGroupSchema>> => r.success)
        .map((r) => r.data)
    }
  } catch {
    // ignore malformed JSON
  }

  try {
    await withTenant(orgId, async (tx) => {
      await guardEstimateOwner(tx, orgId, estimateId)

      // Resolve or create customer
      let resolvedCustomerId = d.customerId ?? ''
      if (d.customerId) {
        await guardCustomer(tx, orgId, d.customerId)
        resolvedCustomerId = d.customerId
      } else if (d.newCustomerName) {
        const accountNo = await nextAccountNo(tx, orgId)
        const [newCust] = await tx
          .insert(customers)
          .values({ tenantId: orgId, accountNo, name: d.newCustomerName })
          .returning({ id: customers.id })
        resolvedCustomerId = newCust.id
      }

      // Resolve or create contact
      let resolvedContactId: string | null = null
      if (d.contactId) {
        await guardContact(tx, orgId, d.contactId)
        resolvedContactId = d.contactId
      } else if (d.newContactFirstName || d.newContactLastName) {
        const [newContact] = await tx
          .insert(contacts)
          .values({
            tenantId: orgId,
            customerId: resolvedCustomerId,
            firstName: d.newContactFirstName || '',
            lastName: d.newContactLastName || null,
          })
          .returning({ id: contacts.id })
        resolvedContactId = newContact.id
        const phoneDigits = normalizePhone(d.newContactPhone)
        if (phoneDigits) {
          await tx.insert(contactPhones).values({
            tenantId: orgId,
            contactId: resolvedContactId,
            number: phoneDigits,
            isPrimary: true,
          })
        }
        if (d.newContactEmail) {
          await tx.insert(contactEmails).values({
            tenantId: orgId,
            contactId: resolvedContactId,
            address: d.newContactEmail,
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
      if (d.serviceLocationId) {
        await guardServiceLocation(tx, orgId, d.serviceLocationId)
        resolvedLocationId = d.serviceLocationId
      } else if (d.newLocationAddress1) {
        const [newLoc] = await tx
          .insert(serviceLocations)
          .values({
            tenantId: orgId,
            customerId: resolvedCustomerId,
            addressLine1: d.newLocationAddress1,
            addressLine2: d.newLocationAddress2 ?? null,
            city: d.newLocationCity ?? null,
            state: d.newLocationState ?? null,
            postalCode: d.newLocationPostalCode ?? null,
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

      await guardCategory(tx, orgId, d.categoryId)
      await guardSalesRep(tx, orgId, d.assignedAgentId)

      // Replace groups
      await tx
        .delete(lineItemGroups)
        .where(and(eq(lineItemGroups.tenantId, orgId), eq(lineItemGroups.estimateId, estimateId)))

      const groupIdMap = new Map<string, string>()
      if (parsedGroups.length > 0) {
        const insertedGroups = await tx
          .insert(lineItemGroups)
          .values(
            parsedGroups.map((g) => ({
              tenantId: orgId,
              estimateId,
              name: g.name,
              sortOrder: g.sortOrder,
            })),
          )
          .returning({ id: lineItemGroups.id })
        parsedGroups.forEach((g, i) => {
          if (g.id) groupIdMap.set(g.id, insertedGroups[i].id)
        })
      }

      // Replace line items
      await tx
        .delete(estimateLineItems)
        .where(and(eq(estimateLineItems.tenantId, orgId), eq(estimateLineItems.estimateId, estimateId)))

      if (parsedLineItems.length > 0) {
        for (const item of parsedLineItems) {
          const taxId = item.taxItemId ?? null
          if (taxId) await guardTaxItem(tx, orgId, taxId)
        }

        await tx.insert(estimateLineItems).values(
          parsedLineItems.map((item, i) => {
            const isPwa = 'name' in item && item.name != null
            const description = isPwa ? item.name : item.description
            const rate = isPwa ? item.unitPrice : item.rate
            const type = isPwa ? ('service' as const) : item.type
            const cost = isPwa ? '0' : item.cost
            const resolvedGroupId = item.groupId ? groupIdMap.get(item.groupId) ?? item.groupId : null
            return {
              tenantId: orgId,
              estimateId,
              type,
              refId: item.refId ?? null,
              title: item.title ?? null,
              description,
              qty: item.qty ?? '1',
              rate: rate ?? '0',
              cost: cost ?? '0',
              taxItemId: item.taxItemId ?? null,
              sortOrder: item.sortOrder ?? i,
              groupId: resolvedGroupId,
            }
          }),
        )
      }

      // Replace tags
      await tx.delete(estimateTags).where(and(eq(estimateTags.tenantId, orgId), eq(estimateTags.estimateId, estimateId)))
      if (d.tagIds.length > 0) {
        await tx.insert(estimateTags).values(
          d.tagIds.map((tagId) => ({ tenantId: orgId, estimateId, tagId })),
        )
      }

      // Replace assignees
      await tx
        .delete(estimateAssignees)
        .where(and(eq(estimateAssignees.tenantId, orgId), eq(estimateAssignees.estimateId, estimateId)))
      if (d.assigneeUserIds.length > 0) {
        await tx.insert(estimateAssignees).values(
          d.assigneeUserIds.map((userId) => ({ tenantId: orgId, estimateId, userId, notify: false })),
        )
      }

      await tx
        .update(estimates)
        .set({
          customerId: resolvedCustomerId,
          contactId: resolvedContactId,
          serviceLocationId: resolvedLocationId,
          categoryId: d.categoryId,
          description: d.description,
          poNumber: d.poNumber,
          opportunityRating: d.opportunityRating,
          referralSourceId: d.referralSourceId,
          expiryDate: d.expiryDate || null,
          followUpDate: d.followUpDate || null,
          onSiteDate: d.onSiteDate ? new Date(d.onSiteDate) : null,
          arrivalWindowStart: d.arrivalWindowStart ? new Date(d.arrivalWindowStart) : null,
          arrivalWindowEnd: d.arrivalWindowEnd ? new Date(d.arrivalWindowEnd) : null,
          notesForTechs: d.notesForTechs,
          notes: d.notes,
          internalNotes: d.internalNotes,
          assignedAgentId: d.assignedAgentId,
          updatedAt: new Date(),
        })
        .where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))
    })

    revalidatePath('/estimates')
    revalidatePath(`/estimates/${estimateId}`)
    return { success: true, id: estimateId }
  } catch (err) {
    logger.error('updateEstimateAction', err)
    return { error: extractErrorMessage(err) || 'Could not update estimate.' }
  }
}

export async function deleteEstimateAction(orgId: string, estimateId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await withTenant(orgId, async (tx) => {
      await guardEstimateOwner(tx, orgId, estimateId)
      await tx.delete(estimates).where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))
    })
    revalidatePath('/estimates')
    return { success: true }
  } catch (err) {
    logger.error('deleteEstimateAction', err)
    return { error: extractErrorMessage(err) || 'Could not delete estimate.' }
  }
}

export async function getEstimateAction(orgId: string, estimateId: string) {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(estimates)
      .where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))
      .limit(1)
    if (!rows[0]) return null

    const estimate = rows[0]

    const [lineItems, groups, tags, assignees, tasks, reminders, convertedJobs] = await Promise.all([
      tx
        .select()
        .from(estimateLineItems)
        .where(and(eq(estimateLineItems.tenantId, orgId), eq(estimateLineItems.estimateId, estimateId)))
        .orderBy(estimateLineItems.sortOrder),
      tx
        .select()
        .from(lineItemGroups)
        .where(and(eq(lineItemGroups.tenantId, orgId), eq(lineItemGroups.estimateId, estimateId)))
        .orderBy(lineItemGroups.sortOrder),
      tx
        .select({ tagId: estimateTags.tagId })
        .from(estimateTags)
        .where(and(eq(estimateTags.tenantId, orgId), eq(estimateTags.estimateId, estimateId))),
      tx
        .select({ userId: estimateAssignees.userId })
        .from(estimateAssignees)
        .where(and(eq(estimateAssignees.tenantId, orgId), eq(estimateAssignees.estimateId, estimateId))),
      tx
        .select()
        .from(estimateTasks)
        .where(and(eq(estimateTasks.tenantId, orgId), eq(estimateTasks.estimateId, estimateId)))
        .orderBy(estimateTasks.sortOrder),
      tx
        .select()
        .from(estimateReminders)
        .where(and(eq(estimateReminders.tenantId, orgId), eq(estimateReminders.estimateId, estimateId)))
        .orderBy(estimateReminders.remindAt),
      tx
        .select({ id: jobs.id, jobNo: jobs.jobNo })
        .from(jobs)
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.estimateId, estimateId)))
        .orderBy(jobs.jobNo),
    ])

    const totals = computeEstimateTotals(
      lineItems.map((li) => ({
        type: li.type ?? 'service',
        qty: li.qty,
        rate: li.rate,
        cost: li.cost,
        taxRate: null,
        groupId: li.groupId,
      })),
      groups,
    )

    return {
      estimate,
      lineItems,
      groups,
      tagIds: tags.map((t) => t.tagId),
      assigneeUserIds: assignees.map((a) => a.userId),
      tasks,
      reminders,
      totals,
      convertedJobs,
    }
  })
}

export async function listEstimatesAction(orgId: string): Promise<{ rows: CachedEstimate[] }> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: estimates.id,
        tenantId: estimates.tenantId,
        estimateNo: estimates.estimateNo,
        status: estimates.status,
        customerId: estimates.customerId,
        customerName: customers.name,
        description: estimates.description,
        value: sql<number | null>`COALESCE(SUM(${estimateLineItems.rate} * ${estimateLineItems.qty}), 0)`,
        followUpDate: sql<string | null>`TO_CHAR(${estimates.followUpDate}, 'YYYY-MM-DD')`,
        expiryDate: sql<string | null>`TO_CHAR(${estimates.expiryDate}, 'YYYY-MM-DD')`,
        notes: estimates.notes,
        createdAt: sql<string>`TO_CHAR(${estimates.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
        assignedAgentId: estimates.assignedAgentId,
      })
      .from(estimates)
      .leftJoin(customers, and(eq(customers.tenantId, estimates.tenantId), eq(customers.id, estimates.customerId)))
      .leftJoin(estimateLineItems, and(eq(estimateLineItems.tenantId, estimates.tenantId), eq(estimateLineItems.estimateId, estimates.id)))
      .where(eq(estimates.tenantId, orgId))
      .groupBy(estimates.id, customers.name)
      .orderBy(desc(estimates.createdAt))

    return { rows: rows as CachedEstimate[] }
  })
}

export async function updateEstimateStatusAction(
  orgId: string,
  estimateId: string,
  newStatus: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    await withTenant(orgId, async (tx) => {
      const rows = await tx
        .select({ estimateNo: estimates.estimateNo, customerId: estimates.customerId })
        .from(estimates)
        .where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))
        .limit(1)
      if (!rows[0]) throw new Error('Estimate not found or access denied')

      await tx
        .update(estimates)
        .set({ status: newStatus as any, updatedAt: new Date() })
        .where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))

      await tx.insert(customerEvents).values({
        tenantId: orgId,
        customerId: rows[0].customerId,
        kind: 'estimate',
        title: `Estimate #EST-${rows[0].estimateNo} moved to ${estimateStatusLabel(newStatus)}`,
        refId: estimateId,
      }).returning({ id: customerEvents.id })
    })

    revalidatePath('/estimates')
    revalidatePath(`/estimates/${estimateId}`)
    return { success: true }
  } catch (err) {
    logger.error('updateEstimateStatusAction', err)
    return { error: extractErrorMessage(err) || 'Could not update status.' }
  }
}

export async function convertEstimateToJobAction(
  orgId: string,
  estimateId: string,
): Promise<{ jobId?: string; error?: string }> {
  try {
    const result = await withTenant(orgId, async (tx) => {
      const estRows = await tx
        .select({
          estimateNo: estimates.estimateNo,
          customerId: estimates.customerId,
          contactId: estimates.contactId,
          serviceLocationId: estimates.serviceLocationId,
          categoryId: estimates.categoryId,
          description: estimates.description,
          poNumber: estimates.poNumber,
          notesForTechs: estimates.notesForTechs,
          status: estimates.status,
        })
        .from(estimates)
        .where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))
        .limit(1)
      if (!estRows[0]) throw new Error('Estimate not found or access denied')
      const est = estRows[0]

      if (est.status === 'estimate_lost') {
        throw new Error('Cannot convert a lost estimate to a job')
      }

      // Compute next job number inline so the query shape ends with .limit(1)
      // and remains compatible with test mocks.
      const [{ m }] = await tx
        .select({ m: max(jobs.jobNo) })
        .from(jobs)
        .where(eq(jobs.tenantId, orgId))
        .limit(1)
      const jobNo = (m ?? 1000) + 1

      const [jobRow] = await tx
        .insert(jobs)
        .values({
          tenantId: orgId,
          jobNo,
          customerId: est.customerId,
          contactId: est.contactId,
          serviceLocationId: est.serviceLocationId,
          categoryId: est.categoryId,
          description: est.description,
          poNumber: est.poNumber,
          notesForTechs: est.notesForTechs,
          status: 'unscheduled',
          estimateId,
        })
        .returning({ id: jobs.id, jobNo: jobs.jobNo })
      const jobId = jobRow.id

      // Copy line item groups (estimate -> job)
      const groupRows = await tx
        .select()
        .from(lineItemGroups)
        .where(and(eq(lineItemGroups.tenantId, orgId), eq(lineItemGroups.estimateId, estimateId)))
      const groupIdMap = new Map<string, string>()
      if (groupRows.length > 0) {
        const insertedGroups = await tx
          .insert(lineItemGroups)
          .values(
            groupRows.map((g) => ({
              tenantId: orgId,
              jobId,
              name: g.name,
              sortOrder: g.sortOrder,
            })),
          )
          .returning({ id: lineItemGroups.id })
        groupRows.forEach((g, i) => groupIdMap.set(g.id, insertedGroups[i].id))
      }

      // Copy line items (estimate -> job)
      const lineItemRows = await tx
        .select()
        .from(estimateLineItems)
        .where(and(eq(estimateLineItems.tenantId, orgId), eq(estimateLineItems.estimateId, estimateId)))
        .orderBy(estimateLineItems.sortOrder)
      if (lineItemRows.length > 0) {
        const jobLineItemValues = lineItemRows.map((li) => ({
          tenantId: orgId,
          jobId,
          type: li.type,
          refId: li.refId,
          title: li.title,
          description: li.description,
          qty: li.qty,
          rate: li.rate,
          cost: li.cost,
          taxItemId: li.taxItemId,
          sortOrder: li.sortOrder,
          groupId: li.groupId ? groupIdMap.get(li.groupId) ?? null : null,
        }))
        try {
          await tx.insert(jobLineItems).values(jobLineItemValues)
        } catch (insertErr) {
          const msg = extractErrorMessage(insertErr)
          // Graceful fallback if the DB hasn't received the group_id migration yet
          if (typeof msg === 'string' && /column "group_id" of relation "job_line_items" does not exist/i.test(msg)) {
            await tx.insert(jobLineItems).values(
              jobLineItemValues.map(({ groupId: _, ...rest }) => rest),
            )
          } else {
            throw insertErr
          }
        }
      }

      // Copy tags
      const tagRows = await tx
        .select({ tagId: estimateTags.tagId })
        .from(estimateTags)
        .where(and(eq(estimateTags.tenantId, orgId), eq(estimateTags.estimateId, estimateId)))
      if (tagRows.length > 0) {
        await tx.insert(jobTags).values(tagRows.map((t) => ({ tenantId: orgId, jobId, tagId: t.tagId })))
      }

      // Advance estimate to Won
      await tx
        .update(estimates)
        .set({ status: 'estimate_won', updatedAt: new Date() })
        .where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))

      // Activity events
      await tx
        .insert(customerEvents)
        .values([
          {
            tenantId: orgId,
            customerId: est.customerId,
            kind: 'estimate',
            title: `Estimate #EST-${est.estimateNo} moved to Won`,
            refId: estimateId,
          },
          {
            tenantId: orgId,
            customerId: est.customerId,
            kind: 'estimate',
            title: `Estimate #EST-${est.estimateNo} converted to Job #JOB-${jobRow.jobNo}`,
            refId: jobId,
          },
        ])
        .returning({ id: customerEvents.id })

      return { jobId, jobNo: jobRow.jobNo }
    })

    revalidatePath('/estimates')
    revalidatePath('/jobs')
    revalidatePath(`/jobs/${result.jobId}`)
    return { jobId: result.jobId }
  } catch (err) {
    if (err instanceof Error && /Cannot convert a lost estimate/i.test(err.message)) {
      throw err
    }
    logger.error('convertEstimateToJobAction', err)
    return { error: extractErrorMessage(err) || 'Could not convert estimate.' }
  }
}

export async function sendEstimateAction(
  _orgId: string,
  _estimateId: string,
): Promise<{ success: boolean }> {
  console.log('sendEstimateAction called — stub, Phase 8 will implement Resend send')
  return { success: true }
}

export async function countEstimatesByStatus(
  orgId: string,
): Promise<Record<string, number> & { all: Record<string, number> }> {
  const ALL_STATUSES = [
    'estimate_requested',
    'estimate_provided',
    'estimate_accepted',
    'estimate_won',
    'estimate_lost',
  ]

  const base: Record<string, number> = {}
  for (const s of ALL_STATUSES) base[s] = 0

  return withTenant(orgId, async (tx) => {
    const allRows = await tx
      .select({ status: estimates.status, count: sql<number>`count(*)::int` })
      .from(estimates)
      .where(eq(estimates.tenantId, orgId))
      .groupBy(estimates.status)

    const all: Record<string, number> = { ...base }
    for (const row of allRows) {
      if (row.status) all[row.status] = row.count
    }

    return { ...all, all } as { all: Record<string, number> } & Record<string, number>
  })
}

// ── Template actions ──────────────────────────────────────────────────────────

export async function createEstimateTemplateAction(
  orgId: string,
  input: {
    name: string
    description?: string
    lineItems: Array<{
      type: 'product' | 'service' | 'discount' | 'expense'
      refId?: string | null
      title?: string | null
      description: string
      qty?: string
      rate?: string
      cost?: string
      taxItemId?: string | null
      groupName?: string | null
    }>
    tasks: Array<{ label: string }>
  },
): Promise<{ id: string; error?: string }> {
  const { createEstimateTemplate } = await import('@/lib/estimates/templates')
  return createEstimateTemplate(orgId, input)
}

export async function listEstimateTemplatesAction(orgId: string) {
  const { listEstimateTemplates } = await import('@/lib/estimates/templates')
  return listEstimateTemplates(orgId)
}

export async function applyEstimateTemplateAction(orgId: string, templateId: string) {
  const { applyEstimateTemplate } = await import('@/lib/estimates/templates')
  return applyEstimateTemplate(orgId, templateId)
}

export async function updateEstimateTemplateAction(
  orgId: string,
  templateId: string,
  input: {
    name: string
    description?: string
    lineItems: Array<{
      type: 'product' | 'service' | 'discount' | 'expense'
      refId?: string | null
      title?: string | null
      description: string
      qty?: string
      rate?: string
      cost?: string
      taxItemId?: string | null
      groupName?: string | null
    }>
    tasks: Array<{ label: string }>
  },
): Promise<{ id: string; error?: string }> {
  const { updateEstimateTemplate } = await import('@/lib/estimates/templates')
  return updateEstimateTemplate(orgId, templateId, input)
}

export async function deleteEstimateTemplateAction(orgId: string, templateId: string): Promise<{ success?: boolean; error?: string }> {
  const { deleteEstimateTemplate } = await import('@/lib/estimates/templates')
  return deleteEstimateTemplate(orgId, templateId)
}

// ── Estimate tasks ─────────────────────────────────────────────────────────────

export async function createEstimateTaskAction(
  estimateId: string,
  label: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      const [{ maxOrder }] = await tx
        .select({ maxOrder: sql<number>`COALESCE(MAX(${estimateTasks.sortOrder}), -1)` })
        .from(estimateTasks)
        .where(and(eq(estimateTasks.tenantId, orgId), eq(estimateTasks.estimateId, estimateId)))

      await tx.insert(estimateTasks).values({
        tenantId: orgId,
        estimateId,
        label: label.trim(),
        sortOrder: (maxOrder ?? -1) + 1,
      })
    })
    revalidatePath(`/estimates/${estimateId}`)
    return { success: true }
  } catch (err) {
    logger.error('createEstimateTaskAction', err)
    return { error: extractErrorMessage(err) || 'Could not add task.' }
  }
}

export async function updateEstimateTaskAction(
  taskId: string,
  estimateId: string,
  updates: { label?: string; done?: boolean },
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      const setFields: Record<string, unknown> = { updatedAt: new Date() }
      if (updates.label !== undefined) setFields.label = updates.label.trim()
      if (updates.done !== undefined) setFields.done = updates.done

      await tx
        .update(estimateTasks)
        .set(setFields)
        .where(
          and(
            eq(estimateTasks.tenantId, orgId),
            eq(estimateTasks.id, taskId),
            eq(estimateTasks.estimateId, estimateId),
          ),
        )
    })
    revalidatePath(`/estimates/${estimateId}`)
    return { success: true }
  } catch (err) {
    logger.error('updateEstimateTaskAction', err)
    return { error: extractErrorMessage(err) || 'Could not update task.' }
  }
}

export async function deleteEstimateTaskAction(
  taskId: string,
  estimateId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .delete(estimateTasks)
        .where(
          and(
            eq(estimateTasks.tenantId, orgId),
            eq(estimateTasks.id, taskId),
            eq(estimateTasks.estimateId, estimateId),
          ),
        )
    })
    revalidatePath(`/estimates/${estimateId}`)
    return { success: true }
  } catch (err) {
    logger.error('deleteEstimateTaskAction', err)
    return { error: extractErrorMessage(err) || 'Could not delete task.' }
  }
}

// ── Estimate reminders ─────────────────────────────────────────────────────────

export async function createEstimateReminderAction(
  estimateId: string,
  input: { remindAt?: string | null; note?: string },
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      await tx.insert(estimateReminders).values({
        tenantId: orgId,
        estimateId,
        remindAt: input.remindAt ? new Date(input.remindAt) : null,
        note: input.note,
      })
    })
    revalidatePath(`/estimates/${estimateId}`)
    return { success: true }
  } catch (err) {
    logger.error('createEstimateReminderAction', err)
    return { error: extractErrorMessage(err) || 'Could not add reminder.' }
  }
}

export async function deleteEstimateReminderAction(
  reminderId: string,
  estimateId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .delete(estimateReminders)
        .where(
          and(
            eq(estimateReminders.tenantId, orgId),
            eq(estimateReminders.id, reminderId),
            eq(estimateReminders.estimateId, estimateId),
          ),
        )
    })
    revalidatePath(`/estimates/${estimateId}`)
    return { success: true }
  } catch (err) {
    logger.error('deleteEstimateReminderAction', err)
    return { error: extractErrorMessage(err) || 'Could not delete reminder.' }
  }
}

// ── Catalog search passthroughs for estimate forms ────────────────────────────

export async function searchProductsAction(
  q: string,
): Promise<Array<{ id: string; name: string; unitPrice: string | null; unitCost: string | null; description: string | null }>> {
  return jobsSearchProductsAction(q)
}

export async function searchServicesAction(
  q: string,
): Promise<Array<{ id: string; name: string; unitPrice: string | null; unitCost: string | null; description: string | null }>> {
  return jobsSearchServicesAction(q)
}

export async function listJobSources(orgId: string): Promise<Array<{ id: string; name: string }>> {
  return jobsListJobSources(orgId)
}

export async function getCustomerContacts(
  customerId: string,
): Promise<{ contacts: Array<{ id: string; firstName: string; lastName: string | null }>; primaryContactId: string | null }> {
  return jobsGetCustomerContacts(customerId)
}

export async function getCustomerLocations(
  customerId: string,
): Promise<{
  locations: Array<{
    id: string
    name: string | null
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    gated: boolean | null
  }>
  primaryLocationId: string | null
}> {
  return jobsGetCustomerLocations(customerId)
}

export async function listJobCategories(orgId: string): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
  return jobsListJobCategories(orgId)
}

export async function listTaxItems(orgId: string): Promise<Array<{ id: string; name: string; rate: string | null }>> {
  return jobsListTaxItems(orgId)
}

export async function listOrgMembers(orgId: string): Promise<Array<{ id: string; label: string; role: string | null }>> {
  return jobsListOrgMembers(orgId)
}

export async function listSalesRepsAction(orgId: string): Promise<Array<{ id: string; name: string }>> {
  return listSalesReps(orgId)
}
