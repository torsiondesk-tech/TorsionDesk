'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq, and } from 'drizzle-orm'
import { listJobs } from '@/lib/jobs/jobs'
import { transitionJobStatusAction as _transitionJobStatusAction } from '@/app/(app)/jobs/actions'
import { broadcastJobEvent } from '@/lib/jobs/broadcast'

export interface CreateTechJobInput {
  customerId: string
  serviceLocationId: string | null
  description: string
  startDate: string | null
  contactId?: string | null
  newContactFirstName?: string | null
  newContactLastName?: string | null
  newContactPhone?: string | null
}

export async function createTechJobAction(
  input: CreateTechJobInput,
): Promise<{ success: false; error: string } | { success: true; id: string }> {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    return { success: false, error: 'Not authenticated.' }
  }

  if (!input.customerId) {
    return { success: false, error: 'Customer is required.' }
  }
  if (!input.description?.trim()) {
    return { success: false, error: 'Description is required.' }
  }

  try {
    const { withTenant } = await import('@/db/with-tenant')
    const { jobs, jobAssignees, contacts, contactPhones, customers } = await import('@/db/schema')
    const { nextJobNo } = await import('@/lib/jobs/job-number')
    const { normalizePhone } = await import('@/lib/utils')

    const id = await withTenant(orgId, async (tx) => {
      const jobNo = await nextJobNo(tx, orgId)

      // Resolve the contactId to link to the job
      let resolvedContactId: string | null = input.contactId ?? null

      if (!resolvedContactId && input.newContactFirstName?.trim()) {
        // Create a new contact and link it
        const firstName = input.newContactFirstName.trim()
        const [contactRow] = await tx
          .insert(contacts)
          .values({
            tenantId: orgId,
            customerId: input.customerId,
            firstName,
            lastName: input.newContactLastName?.trim() || null,
          })
          .returning({ id: contacts.id })
        resolvedContactId = contactRow.id
        const phone = input.newContactPhone ? normalizePhone(input.newContactPhone) : null
        if (phone) {
          await tx.insert(contactPhones).values({
            tenantId: orgId,
            contactId: contactRow.id,
            number: phone,
            type: 'cell',
            isPrimary: true,
          })
        }
        // Promote to primary contact if the customer has none yet
        const [cust] = await tx
          .select({ primaryContactId: customers.primaryContactId })
          .from(customers)
          .where(and(eq(customers.tenantId, orgId), eq(customers.id, input.customerId)))
          .limit(1)
        if (!cust?.primaryContactId) {
          await tx
            .update(customers)
            .set({ primaryContactId: contactRow.id })
            .where(and(eq(customers.tenantId, orgId), eq(customers.id, input.customerId)))
        }
      } else if (!resolvedContactId) {
        // Fall back to the customer's existing primary contact
        const [cust] = await tx
          .select({ primaryContactId: customers.primaryContactId })
          .from(customers)
          .where(and(eq(customers.tenantId, orgId), eq(customers.id, input.customerId)))
          .limit(1)
        resolvedContactId = cust?.primaryContactId ?? null
      }

      const [row] = await tx
        .insert(jobs)
        .values({
          tenantId: orgId,
          jobNo,
          customerId: input.customerId,
          contactId: resolvedContactId,
          serviceLocationId: input.serviceLocationId ?? null,
          status: 'unscheduled',
          description: input.description.trim(),
          startDate: input.startDate ? new Date(`${input.startDate}T00:00:00`) : null,
        })
        .returning({ id: jobs.id })

      await tx.insert(jobAssignees).values({
        tenantId: orgId,
        jobId: row.id,
        userId,
        notify: false,
      })

      return row.id
    })

    revalidatePath('/tech/jobs')
    revalidatePath('/jobs')
    after(() => broadcastJobEvent(orgId, 'job-updated', { jobId: id }).catch(() => {}))
    return { success: true, id }
  } catch (err) {
    const message = extractErrorMessage(err)
    return { success: false, error: message || 'Could not create job. Please try again.' }
  }
}

export async function transitionJobStatusAction(jobId: string, toStatus: string) {
  return _transitionJobStatusAction(jobId, toStatus)
}

export async function listTechJobsAction(orgId: string, userId: string) {
  const { orgId: sessionOrgId, userId: sessionUserId } = await auth()
  if (!sessionOrgId || !sessionUserId) {
    throw new Error('Not authenticated')
  }
  if (sessionOrgId !== orgId || sessionUserId !== userId) {
    throw new Error('Unauthorized')
  }

  return listJobs(orgId, {
    assigneeUserId: userId,
    pageSize: 200,
  })
}

export async function getEquipmentByServiceLocationAction(
  orgId: string,
  serviceLocationId: string,
) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }

  const { getEquipmentByServiceLocation } = await import('@/lib/customers')
  return getEquipmentByServiceLocation(orgId, serviceLocationId)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

// ── Signature upload ───────────────────────────────────────────────────────

export async function getJobSignatureUploadUrlAction(
  jobId: string,
  filename: string,
  fileSize: number,
): Promise<{ error?: string; signedUrl?: string; path?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  if (!filename || fileSize === 0) {
    return { error: 'No signature captured.' }
  }

  try {
    const { createJobSignatureSignedUploadUrl } = await import('@/lib/jobs/signatures')
    const result = await createJobSignatureSignedUploadUrl(orgId, jobId, filename, fileSize)
    return { signedUrl: result.signedUrl, path: result.path }
  } catch (err) {
    const message = extractErrorMessage(err)
    return { error: message }
  }
}

export async function confirmJobSignatureAction(
  jobId: string,
  path: string,
  signedBy: string,
  signatureType: 'start' | 'complete',
): Promise<{ error?: string; success?: boolean }> {
  const { orgId, userId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  if (!signedBy.trim()) {
    return { error: 'Signed-by name is required.' }
  }

  try {
    const { confirmJobSignature } = await import('@/lib/jobs/signatures')
    await confirmJobSignature(orgId, jobId, path, signedBy, userId ?? '', signatureType)
    revalidatePath(`/tech/jobs/${jobId}`)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    return { error: message }
  }
}

// ── Assign existing location to the job ────────────────────────────────────────

export async function assignJobLocationAction(input: {
  jobId: string
  locationId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const { orgId } = await auth()
  if (!orgId) return { success: false, error: 'Unauthorized' }

  try {
    const { withTenant } = await import('@/db/with-tenant')
    const { jobs } = await import('@/db/schema')

    await withTenant(orgId, async (tx) => {
      await tx
        .update(jobs)
        .set({ serviceLocationId: input.locationId })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, input.jobId)))
    })

    revalidatePath(`/tech/jobs/${input.jobId}`)
    revalidatePath(`/jobs/${input.jobId}`)
    after(() => broadcastJobEvent(orgId, 'job-updated', { jobId: input.jobId }).catch(() => {}))
    return { success: true }
  } catch (err) {
    return { success: false, error: extractErrorMessage(err) || 'Failed to assign location' }
  }
}

// ── Add new location and assign it to the job ──────────────────────────────────

export async function addAndAssignJobLocationAction(input: {
  jobId: string
  customerId: string
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}): Promise<{ success: true; locationId: string } | { success: false; error: string }> {
  const { orgId } = await auth()
  if (!orgId) return { success: false, error: 'Unauthorized' }

  if (!input.addressLine1?.trim() && !input.city?.trim()) {
    return { success: false, error: 'Address or city is required' }
  }

  try {
    const { withTenant } = await import('@/db/with-tenant')
    const { jobs, serviceLocations } = await import('@/db/schema')

    const locationId = await withTenant(orgId, async (tx) => {
      const [locRow] = await tx
        .insert(serviceLocations)
        .values({
          tenantId: orgId,
          customerId: input.customerId,
          addressLine1: input.addressLine1 ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          postalCode: input.postalCode ?? null,
        })
        .returning({ id: serviceLocations.id })

      await tx
        .update(jobs)
        .set({ serviceLocationId: locRow.id })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, input.jobId)))

      return locRow.id
    })

    revalidatePath(`/tech/jobs/${input.jobId}`)
    revalidatePath(`/jobs/${input.jobId}`)
    after(() => broadcastJobEvent(orgId, 'job-updated', { jobId: input.jobId }).catch(() => {}))
    return { success: true, locationId }
  } catch (err) {
    return { success: false, error: extractErrorMessage(err) || 'Failed to add location' }
  }
}

// ── Equipment CRUD (tech-side) ────────────────────────────────────────────────

export async function createTechEquipmentAction(
  serviceLocationId: string,
  jobId: string,
  formData: FormData,
): Promise<{ success?: boolean; id?: string; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  const { equipmentSchema } = await import('@/lib/equipment-schema')
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }

  const parsed = equipmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const data = parsed.data

  try {
    const { withTenant: wt } = await import('@/db/with-tenant')
    const { serviceLocations: sl, equipment: eq } = await import('@/db/schema')
    const { eq: dEq, and: dAnd } = await import('drizzle-orm')

    const id = await wt(orgId, async (tx) => {
      const loc = await tx
        .select({ id: sl.id })
        .from(sl)
        .where(dAnd(dEq(sl.tenantId, orgId), dEq(sl.id, serviceLocationId)))
        .limit(1)
      if (loc.length === 0) throw new Error('Invalid service location')

      const base = {
        tenantId: orgId,
        serviceLocationId,
        kind: data.kind,
        installDate: data.installDate || null,
        warrantyExpires: data.warrantyExpires || null,
        notes: data.notes ?? null,
      }

      let specific: Record<string, unknown> = {}
      switch (data.kind) {
        case 'door':
          specific = {
            brand: data.brand,
            widthFt: data.widthFt,
            heightFt: data.heightFt,
            material: data.material ?? null,
            style: data.style ?? null,
            color: data.color ?? null,
            modelSeries: data.modelSeries ?? null,
          }
          break
        case 'opener':
          specific = {
            brand: data.brand,
            model: data.model ?? null,
            hp: data.hp ?? null,
            serial: data.serial ?? null,
          }
          break
        case 'spring':
          specific = {
            wireSize: data.wireSize,
            insideDiameter: data.insideDiameter,
            length: data.length,
            windDirection: data.windDirection,
            cycleRating: data.cycleRating ?? null,
          }
          break
      }

      const [row] = await tx
        .insert(eq)
        .values({ ...base, ...specific })
        .returning({ id: eq.id })
      return row.id
    })

    revalidatePath(`/tech/jobs/${jobId}`)
    revalidatePath('/customers')
    return { success: true, id }
  } catch (err) {
    return { error: extractErrorMessage(err) || 'Could not save equipment.' }
  }
}

export async function updateTechEquipmentAction(
  equipmentId: string,
  jobId: string,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  const { equipmentSchema } = await import('@/lib/equipment-schema')
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }

  const parsed = equipmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const data = parsed.data

  try {
    const { withTenant: wt } = await import('@/db/with-tenant')
    const { equipment: eq } = await import('@/db/schema')
    const { eq: dEq, and: dAnd } = await import('drizzle-orm')

    await wt(orgId, async (tx) => {
      const base = {
        installDate: data.installDate || null,
        warrantyExpires: data.warrantyExpires || null,
        notes: data.notes ?? null,
      }

      let specific: Record<string, unknown> = {}
      switch (data.kind) {
        case 'door':
          specific = {
            brand: data.brand,
            widthFt: data.widthFt,
            heightFt: data.heightFt,
            material: data.material ?? null,
            style: data.style ?? null,
            color: data.color ?? null,
            modelSeries: data.modelSeries ?? null,
          }
          break
        case 'opener':
          specific = {
            brand: data.brand,
            model: data.model ?? null,
            hp: data.hp ?? null,
            serial: data.serial ?? null,
          }
          break
        case 'spring':
          specific = {
            wireSize: data.wireSize,
            insideDiameter: data.insideDiameter,
            length: data.length,
            windDirection: data.windDirection,
            cycleRating: data.cycleRating ?? null,
          }
          break
      }

      await tx
        .update(eq)
        .set({ ...base, ...specific })
        .where(dAnd(dEq(eq.tenantId, orgId), dEq(eq.id, equipmentId)))
    })

    revalidatePath(`/tech/jobs/${jobId}`)
    revalidatePath('/customers')
    return { success: true }
  } catch (err) {
    return { error: extractErrorMessage(err) || 'Could not update equipment.' }
  }
}

export async function deleteTechEquipmentAction(
  equipmentId: string,
  jobId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'Unauthorized' }

  try {
    const { withTenant: wt } = await import('@/db/with-tenant')
    const { equipment: eq } = await import('@/db/schema')
    const { eq: dEq, and: dAnd } = await import('drizzle-orm')

    await wt(orgId, async (tx) => {
      await tx.delete(eq).where(dAnd(dEq(eq.tenantId, orgId), dEq(eq.id, equipmentId)))
    })

    revalidatePath(`/tech/jobs/${jobId}`)
    revalidatePath('/customers')
    return { success: true }
  } catch (err) {
    return { error: extractErrorMessage(err) || 'Could not delete equipment.' }
  }
}

// ── Job description ───────────────────────────────────────────────────────────

export async function saveJobDescriptionAction(
  jobId: string,
  description: string,
): Promise<{ error?: string; success?: boolean }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'No active organization. Please sign in to your workspace.' }

  if (description.length > 5000) {
    return { error: 'Description must be 5,000 characters or fewer.' }
  }

  try {
    const { withTenant } = await import('@/db/with-tenant')
    const { jobs } = await import('@/db/schema')

    await withTenant(orgId, async (tx) => {
      await tx
        .update(jobs)
        .set({ description: description.trim() || null })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
    })

    revalidatePath(`/tech/jobs/${jobId}`)
    revalidatePath(`/jobs/${jobId}`)
    after(() => broadcastJobEvent(orgId, 'job-updated', { jobId }).catch(() => {}))
    return { success: true }
  } catch (err) {
    return { error: extractErrorMessage(err) }
  }
}

// ── Completion notes ─────────────────────────────────────────────────────────

export async function saveCompletionNotesAction(
  jobId: string,
  notes: string,
): Promise<{ error?: string; success?: boolean }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  if (notes.length > 10000) {
    return { error: 'Notes must be 10,000 characters or fewer.' }
  }

  try {
    const { withTenant } = await import('@/db/with-tenant')
    const { jobs } = await import('@/db/schema')
    const { eq, and } = await import('drizzle-orm')

    await withTenant(orgId, async (tx) => {
      await tx
        .update(jobs)
        .set({ completionNotes: notes })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
    })

    revalidatePath(`/tech/jobs/${jobId}`)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    return { error: message }
  }
}
