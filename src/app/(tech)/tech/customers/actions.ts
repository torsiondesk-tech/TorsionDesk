'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { broadcastJobEvent } from '@/lib/jobs/broadcast'
import { eq, and } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import { customers, contacts, contactPhones, contactEmails, serviceLocations } from '@/db/schema'
import { listCustomers } from '@/lib/customers'
import { nextAccountNo } from '@/lib/account-number'
import { normalizePhone } from '@/lib/utils'

export async function listTechCustomersAction(orgId: string, _userId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }

  return listCustomers(orgId, { pageSize: 1000 })
}

export interface CreateTechCustomerInput {
  name: string
  contactFirstName?: string | null
  contactLastName?: string | null
  phone?: string | null
  email?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}

export async function createTechCustomerAction(
  input: CreateTechCustomerInput,
): Promise<{ success: true; customerId: string; locationId: string | null } | { success: false; error: string }> {
  const { orgId } = await auth()
  if (!orgId) return { success: false, error: 'Unauthorized' }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Name is required' }

  try {
    const result = await withTenant(orgId, async (tx) => {
      const accountNo = await nextAccountNo(tx, orgId)

      const [customerRow] = await tx
        .insert(customers)
        .values({ tenantId: orgId, accountNo, name })
        .returning({ id: customers.id })

      const phone = input.phone ? normalizePhone(input.phone) : null
      const email = input.email?.trim() || null
      const contactFirstName = input.contactFirstName?.trim() || name
      const contactLastName = input.contactLastName?.trim() || null
      if (phone || email || input.contactFirstName?.trim()) {
        const [contactRow] = await tx
          .insert(contacts)
          .values({ tenantId: orgId, customerId: customerRow.id, firstName: contactFirstName, lastName: contactLastName })
          .returning({ id: contacts.id })
        if (phone) {
          await tx.insert(contactPhones).values({
            tenantId: orgId,
            contactId: contactRow.id,
            number: phone,
            type: 'cell',
            isPrimary: true,
          })
        }
        if (email) {
          await tx.insert(contactEmails).values({
            tenantId: orgId,
            contactId: contactRow.id,
            address: email,
            type: 'work',
            isPrimary: true,
          })
        }
        await tx
          .update(customers)
          .set({ primaryContactId: contactRow.id })
          .where(eq(customers.id, customerRow.id))
      }

      let locationId: string | null = null
      if (input.addressLine1 || input.city) {
        const [locRow] = await tx
          .insert(serviceLocations)
          .values({
            tenantId: orgId,
            customerId: customerRow.id,
            addressLine1: input.addressLine1 ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
            postalCode: input.postalCode ?? null,
          })
          .returning({ id: serviceLocations.id })
        locationId = locRow.id
        await tx
          .update(customers)
          .set({ primaryLocationId: locRow.id })
          .where(eq(customers.id, customerRow.id))
      }

      return { customerId: customerRow.id, locationId }
    })

    return { success: true, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create customer'
    return { success: false, error: message }
  }
}

export interface CreateTechServiceLocationInput {
  customerId: string
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}

export async function createTechServiceLocationAction(
  input: CreateTechServiceLocationInput,
): Promise<{ success: true; locationId: string } | { success: false; error: string }> {
  const { orgId } = await auth()
  if (!orgId) return { success: false, error: 'Unauthorized' }

  if (!input.customerId) return { success: false, error: 'Customer is required' }
  if (!input.addressLine1?.trim() && !input.city?.trim()) {
    return { success: false, error: 'Address or city is required' }
  }

  try {
    const result = await withTenant(orgId, async (tx) => {
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
      return { locationId: locRow.id }
    })
    return { success: true, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create location'
    return { success: false, error: message }
  }
}

export async function listTechServiceLocationsAction(orgId: string, _userId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }

  const rows = await withTenant(orgId, async (tx) => {
    return tx
      .select({
        id: serviceLocations.id,
        tenantId: serviceLocations.tenantId,
        customerId: serviceLocations.customerId,
        name: serviceLocations.name,
        addressLine1: serviceLocations.addressLine1,
        addressLine2: serviceLocations.addressLine2,
        city: serviceLocations.city,
        state: serviceLocations.state,
        postalCode: serviceLocations.postalCode,
        country: serviceLocations.country,
        latitude: serviceLocations.latitude,
        longitude: serviceLocations.longitude,
        gated: serviceLocations.gated,
      })
      .from(serviceLocations)
      .where(eq(serviceLocations.tenantId, orgId))
      .orderBy(serviceLocations.name)
  })
  return { rows }
}

// ── Contact upsert ─────────────────────────────────────────────────────────────

export interface UpsertTechContactInput {
  customerId: string
  contactId: string | null
  jobId: string
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
}

export async function upsertTechContactAction(
  input: UpsertTechContactInput,
): Promise<{ success: true; contactId: string } | { success: false; error: string }> {
  const { orgId } = await auth()
  if (!orgId) return { success: false, error: 'Unauthorized' }

  const firstName = input.firstName.trim()
  if (!firstName) return { success: false, error: 'First name is required' }

  try {
    const result = await withTenant(orgId, async (tx) => {
      let contactId = input.contactId

      if (!contactId) {
        const [row] = await tx
          .insert(contacts)
          .values({ tenantId: orgId, customerId: input.customerId, firstName, lastName: input.lastName?.trim() || null })
          .returning({ id: contacts.id })
        contactId = row.id
        await tx.update(customers).set({ primaryContactId: contactId }).where(eq(customers.id, input.customerId))
      } else {
        await tx
          .update(contacts)
          .set({ firstName, lastName: input.lastName?.trim() || null })
          .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, contactId)))
      }

      // Upsert primary phone
      const phone = input.phone ? normalizePhone(input.phone) : null
      const [existingPhone] = await tx
        .select({ id: contactPhones.id })
        .from(contactPhones)
        .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.contactId, contactId!), eq(contactPhones.isPrimary, true)))
        .limit(1)
      if (phone && existingPhone) {
        await tx.update(contactPhones).set({ number: phone }).where(eq(contactPhones.id, existingPhone.id))
      } else if (phone) {
        await tx.insert(contactPhones).values({ tenantId: orgId, contactId: contactId!, number: phone, type: 'cell', isPrimary: true })
      } else if (existingPhone) {
        await tx.delete(contactPhones).where(eq(contactPhones.id, existingPhone.id))
      }

      // Upsert primary email
      const email = input.email?.trim() || null
      const [existingEmail] = await tx
        .select({ id: contactEmails.id })
        .from(contactEmails)
        .where(and(eq(contactEmails.tenantId, orgId), eq(contactEmails.contactId, contactId!), eq(contactEmails.isPrimary, true)))
        .limit(1)
      if (email && existingEmail) {
        await tx.update(contactEmails).set({ address: email }).where(eq(contactEmails.id, existingEmail.id))
      } else if (email) {
        await tx.insert(contactEmails).values({ tenantId: orgId, contactId: contactId!, address: email, type: 'work', isPrimary: true })
      } else if (existingEmail) {
        await tx.delete(contactEmails).where(eq(contactEmails.id, existingEmail.id))
      }

      return { contactId: contactId! }
    })

    revalidatePath(`/tech/jobs/${input.jobId}`)
    return { success: true, contactId: result.contactId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save contact'
    return { success: false, error: message }
  }
}

// ── Customer primary contact fetch ────────────────────────────────────────────

export async function getTechCustomerPrimaryContactAction(customerId: string): Promise<{
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
} | null> {
  const { orgId } = await auth()
  if (!orgId) return null

  try {
    const result = await withTenant(orgId, async (tx) => {
      const [customer] = await tx
        .select({ primaryContactId: customers.primaryContactId })
        .from(customers)
        .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
        .limit(1)
      if (!customer?.primaryContactId) return null

      const [contact] = await tx
        .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, customer.primaryContactId)))
        .limit(1)
      if (!contact) return null

      const [primaryPhone] = await tx
        .select({ number: contactPhones.number })
        .from(contactPhones)
        .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.contactId, contact.id), eq(contactPhones.isPrimary, true)))
        .limit(1)

      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName ?? null,
        phone: primaryPhone?.number ?? null,
      }
    })
    return result
  } catch {
    return null
  }
}

// ── Location update ────────────────────────────────────────────────────────────

export interface UpdateTechLocationInput {
  locationId: string
  jobId: string
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}

export async function updateTechLocationAction(
  input: UpdateTechLocationInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const { orgId } = await auth()
  if (!orgId) return { success: false, error: 'Unauthorized' }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .update(serviceLocations)
        .set({
          addressLine1: input.addressLine1 ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          postalCode: input.postalCode ?? null,
        })
        .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, input.locationId)))
    })
    revalidatePath(`/tech/jobs/${input.jobId}`)
    after(() => broadcastJobEvent(orgId, 'job-updated', { jobId: input.jobId }).catch(() => {}))
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update location'
    return { success: false, error: message }
  }
}
