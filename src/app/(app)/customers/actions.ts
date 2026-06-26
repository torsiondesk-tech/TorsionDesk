'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and, ne } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import { customers, customerTags, contacts, contactPhones, contactEmails, serviceLocations, equipment } from '@/db/schema'
import { nextAccountNo } from '@/lib/account-number'
import { equipmentSchema } from '@/lib/equipment-schema'
import { createContact, createLocation, setPrimaryLocation, setPrimaryContact } from '@/lib/customers'
import { createTag, createReferralSource } from '@/lib/tags'
import { logger } from '@/lib/logger'
import { normalizePhone } from '@/lib/utils'

/**
 * ── Phone handling policy ──────────────────────────────────────────────────
 *  • DB stores RAW DIGITS ONLY (e.g. "7735597272").
 *  • Client-side formatting is display-only (e.g. "(773) 559-7272").
 *  • `normalizePhone` strips non-digits before every insert / upsert.
 *  • Downstream integrations (Twilio SMS, Stripe) never see parens or dashes.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function extractIndexedArrays(formData: FormData) {
  const phones: Array<{ number: string; type: string; isPrimary: boolean }> = []
  const emails: Array<{ address: string; type: string; isPrimary: boolean }> = []

  for (const [key, value] of formData.entries()) {
    const phoneMatch = key.match(/^phones\[(\d+)\]\.(number|type|isPrimary)$/)
    if (phoneMatch) {
      const idx = Number(phoneMatch[1])
      const field = phoneMatch[2] as 'number' | 'type' | 'isPrimary'
      phones[idx] = phones[idx] ?? { number: '', type: 'cell', isPrimary: false }
      if (field === 'isPrimary') {
        phones[idx][field] = value === 'true' || value === 'on'
      } else {
        phones[idx][field] = String(value)
      }
    }

    const emailMatch = key.match(/^emails\[(\d+)\]\.(address|type|isPrimary)$/)
    if (emailMatch) {
      const idx = Number(emailMatch[1])
      const field = emailMatch[2] as 'address' | 'type' | 'isPrimary'
      emails[idx] = emails[idx] ?? { address: '', type: 'work', isPrimary: false }
      if (field === 'isPrimary') {
        emails[idx][field] = value === 'true' || value === 'on'
      } else {
        emails[idx][field] = String(value)
      }
    }
  }

  return {
    phones: phones.filter((p) => p.number.trim()),
    emails: emails.filter((e) => e.address.trim()),
  }
}

function extractInlineContacts(formData: FormData): Array<{ firstName: string; lastName: string; phone: string; email: string }> {
  const map = new Map<number, { firstName: string; lastName: string; phone: string; email: string }>()

  for (const [key, value] of formData.entries()) {
    const match = key.match(/^contacts\[(\d+)\]\.(firstName|lastName|phone|email)$/)
    if (match) {
      const idx = Number(match[1])
      const field = match[2] as 'firstName' | 'lastName' | 'phone' | 'email'
      const entry = map.get(idx) ?? { firstName: '', lastName: '', phone: '', email: '' }
      entry[field] = String(value)
      map.set(idx, entry)
    }
  }

  return Array.from(map.values()).filter((c) => c.firstName.trim())
}

// ── Schemas ────────────────────────────────────────────────────────────────

// Base UI Checkbox does not render a native <input>, so we use hidden inputs
// that submit '1' (checked) or '0' (unchecked). This helper maps those back to
// booleans and falls back to the default when the field is missing.
const formBool = (defaultValue: boolean) =>
  z.preprocess(
    (val) => {
      if (val === '1' || val === true) return true
      if (val === '0' || val === false) return false
      return undefined
    },
    z.boolean().default(defaultValue),
  )

const opt = (max = 255) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().max(max).optional(),
  )

const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  vip: formBool(false),
  active: formBool(true),
  parentCustomerId: opt(),
  assignedAgentId: opt(),
  referralSourceId: opt(),
  internalNotes: opt(2000),
  publicNotes: opt(2000),
  tagIds: z.array(z.string()).default([]),
  // Inline service location (create mode only)
  locationName: opt(),
  locationAddress1: opt(),
  locationAddress2: opt(),
  locationCity: opt(100),
  locationState: opt(50),
  locationZip: opt(20),
  locationGated: z.preprocess((v) => v === 'true' || v === true, z.boolean().default(false)),
  locationLat: opt(),
  locationLng: opt(),
})

const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().min(1),
})

const createLocationSchema = z.object({
  customerId: z.string().min(1),
  name: opt(),
  addressLine1: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().max(255).optional(),
  ),
  addressLine2: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().max(255).optional(),
  ),
  city: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().max(100).optional(),
  ),
  state: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().max(50).optional(),
  ),
  postalCode: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().max(20).optional(),
  ),
  country: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().max(100).optional(),
  ),
  gated: formBool(false),
  latitude: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().optional(),
  ),
  longitude: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : val,
    z.string().optional(),
  ),
})

const updateLocationSchema = createLocationSchema.extend({
  id: z.string().min(1),
})

// ── Action State Types ─────────────────────────────────────────────────────

export type CustomerActionState = {
  error?: string
  success?: boolean
  id?: string
}

export type ContactActionState = {
  error?: string
  success?: boolean
  id?: string
}

export type LocationActionState = {
  error?: string
  success?: boolean
  id?: string
}

export type EquipmentActionState = {
  error?: string
  success?: boolean
  id?: string
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function createCustomer(
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  // Parse tagIds from hidden inputs
  const tagIds: string[] = formData.getAll('tagIds').map((v) => String(v))

  const parsed = createCustomerSchema.safeParse({
    name: formData.get('name'),
    vip: formData.get('vip'),
    active: formData.get('active'),
    parentCustomerId: formData.get('parentCustomerId'),
    assignedAgentId: formData.get('assignedAgentId'),
    referralSourceId: formData.get('referralSourceId'),
    internalNotes: formData.get('internalNotes'),
    publicNotes: formData.get('publicNotes'),
    tagIds,
    locationName: formData.get('locationName'),
    locationAddress1: formData.get('locationAddress1'),
    locationAddress2: formData.get('locationAddress2'),
    locationCity: formData.get('locationCity'),
    locationState: formData.get('locationState'),
    locationZip: formData.get('locationZip'),
    locationGated: formData.get('locationGated'),
    locationLat: formData.get('locationLat'),
    locationLng: formData.get('locationLng'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const {
    tagIds: parsedTagIds,
    locationName, locationAddress1, locationAddress2,
    locationCity, locationState, locationZip, locationGated,
    locationLat, locationLng,
    ...customerData
  } = parsed.data

  const inlineContacts = extractInlineContacts(formData)

  // Retry loop for rare unique-constraint race on account_no
  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    try {
      const id = await withTenant(orgId, async (tx) => {
        const accountNo = await nextAccountNo(tx, orgId)

        const [row] = await tx
          .insert(customers)
          .values({
            tenantId: orgId,
            accountNo,
            ...customerData,
          })
          .returning({ id: customers.id })

        if (parsedTagIds.length > 0) {
          await tx.insert(customerTags).values(
            parsedTagIds.map((tagId) => ({
              tenantId: orgId,
              customerId: row.id,
              tagId,
            })),
          )
        }

        // Inline contacts
        for (const ic of inlineContacts) {
          const [contact] = await tx
            .insert(contacts)
            .values({
              tenantId: orgId,
              customerId: row.id,
              firstName: ic.firstName,
              lastName: ic.lastName || null,
            })
            .returning({ id: contacts.id })
          const normPhone = normalizePhone(ic.phone)
          if (normPhone) {
            await tx.insert(contactPhones).values({
              tenantId: orgId,
              contactId: contact.id,
              number: normPhone,
              type: 'cell',
              isPrimary: true,
            })
          }
          if (ic.email.trim()) {
            await tx.insert(contactEmails).values({
              tenantId: orgId,
              contactId: contact.id,
              address: ic.email.trim(),
              type: 'work',
              isPrimary: true,
            })
          }
        }

        // Inline service location
        if (locationAddress1 || locationCity) {
          const [newLoc] = await tx.insert(serviceLocations).values({
            tenantId: orgId,
            customerId: row.id,
            name: locationName ?? null,
            addressLine1: locationAddress1 ?? null,
            addressLine2: locationAddress2 ?? null,
            city: locationCity ?? null,
            state: locationState ?? null,
            postalCode: locationZip ?? null,
            gated: locationGated ?? false,
            latitude: locationLat ?? null,
            longitude: locationLng ?? null,
          }).returning({ id: serviceLocations.id })

          // First (only) location becomes primary
          await tx
            .update(customers)
            .set({ primaryLocationId: newLoc.id, updatedAt: new Date() })
            .where(and(eq(customers.tenantId, orgId), eq(customers.id, row.id)))
        }

        return row.id
      })

      revalidatePath('/customers')
      return { success: true, id }
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== '23505') {
        // Only retry on unique-constraint violation; rethrow everything else
        throw err
      }
      attempts++
      if (attempts >= maxAttempts) {
        logger.error('createCustomer', err)
        return { error: 'Could not create customer. Please try again.' }
      }
      // Exponential backoff ~100ms
      await new Promise((r) => setTimeout(r, 100 * attempts))
    }
  }

  return { error: 'Could not create customer. Please try again.' }
}

export async function updateCustomer(
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const tagIds: string[] = formData.getAll('tagIds').map((v) => String(v))

  const parsed = updateCustomerSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    vip: formData.get('vip'),
    active: formData.get('active'),
    parentCustomerId: formData.get('parentCustomerId'),
    assignedAgentId: formData.get('assignedAgentId'),
    referralSourceId: formData.get('referralSourceId'),
    internalNotes: formData.get('internalNotes'),
    publicNotes: formData.get('publicNotes'),
    tagIds,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { id, tagIds: parsedTagIds, ...customerData } = parsed.data

  await withTenant(orgId, async (tx) => {
    await tx
      .update(customers)
      .set({
        ...customerData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customers.tenantId, orgId),
          eq(customers.id, id),
        ),
      )

    // Replace tags
    await tx
      .delete(customerTags)
      .where(
        and(
          eq(customerTags.tenantId, orgId),
          eq(customerTags.customerId, id),
        ),
      )

    if (parsedTagIds.length > 0) {
      await tx.insert(customerTags).values(
        parsedTagIds.map((tagId) => ({
          tenantId: orgId,
          customerId: id,
          tagId,
        })),
      )
    }
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { success: true, id }
}

// ── Inline customer detail update (customer + contacts + tags) ─────────────

const updateCustomerDetailSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(255),
  vip: z.boolean().default(false),
  active: z.boolean().default(true),
  taxable: z.boolean().default(true),
  parentCustomerId: z.string().max(255).nullable().optional(),
  assignedAgentId: z.string().max(255).nullable().optional(),
  referralSourceId: z.string().max(255).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  publicNotes: z.string().max(2000).nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  contacts: z
    .array(
      z.object({
        id: z.string().optional(),
        firstName: z.string().min(1, 'First name is required').max(255),
        lastName: z.string().max(255).nullable().optional(),
        jobTitle: z.string().max(255).nullable().optional(),
        birthday: z.string().nullable().optional(),
        anniversary: z.string().nullable().optional(),
        smsConsent: z.boolean().default(true),
        billingContact: z.boolean().default(false),
        bookingContact: z.boolean().default(false),
        phones: z
          .array(
            z.object({
              number: z.string().min(1).max(50),
              ext: z.string().max(20).nullable().optional(),
              type: z.string().max(20),
              isPrimary: z.boolean(),
            }),
          )
          .default([]),
        emails: z
          .array(
            z.object({
              address: z.string().min(1).max(255),
              type: z.string().max(20),
              isPrimary: z.boolean(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
})

export async function updateCustomerDetail(
  data: z.infer<typeof updateCustomerDetailSchema>,
): Promise<{ success: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { success: false, error: 'No active organization.' }
  }

  const parsed = updateCustomerDetailSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  const { id, tagIds, contacts: contactList, ...customerData } = parsed.data

  await withTenant(orgId, async (tx) => {
    // Update customer
    await tx
      .update(customers)
      .set({
        ...customerData,
        updatedAt: new Date(),
      })
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, id)))

    // Replace tags
    await tx
      .delete(customerTags)
      .where(
        and(
          eq(customerTags.tenantId, orgId),
          eq(customerTags.customerId, id),
        ),
      )

    if (tagIds.length > 0) {
      await tx.insert(customerTags).values(
        tagIds.map((tagId) => ({
          tenantId: orgId,
          customerId: id,
          tagId,
        })),
      )
    }

    // Upsert contacts
    for (const contact of contactList) {
      if (contact.id) {
        const cid = contact.id

        // Verify the contact belongs to the customer being updated (AUDIT-007)
        const contactCheck = await tx
          .select({ customerId: contacts.customerId })
          .from(contacts)
          .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, cid)))
          .limit(1)
        if (contactCheck.length === 0 || contactCheck[0].customerId !== id) {
          throw new Error('Invalid contact: does not belong to this customer')
        }

        if (contact.billingContact) {
          await tx
            .update(contacts)
            .set({ billingContact: false })
            .where(
              and(
                eq(contacts.tenantId, orgId),
                eq(contacts.customerId, id),
                ne(contacts.id, cid),
              ),
            )
        }

        await tx
          .update(contacts)
          .set({
            firstName: contact.firstName,
            lastName: contact.lastName || null,
            jobTitle: contact.jobTitle ?? null,
            birthday: contact.birthday || null,
            anniversary: contact.anniversary || null,
            smsConsent: contact.smsConsent,
            billingContact: contact.billingContact,
            bookingContact: contact.bookingContact,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(contacts.tenantId, orgId),
              eq(contacts.id, cid),
            ),
          )

        await tx
          .delete(contactPhones)
          .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.contactId, cid)))
        const normPhones = contact.phones
          .map((p) => ({ ...p, number: normalizePhone(p.number) }))
          .filter((p) => p.number)
        if (normPhones.length > 0) {
          await tx.insert(contactPhones).values(
            normPhones.map((p) => ({
              tenantId: orgId,
              contactId: cid,
              number: p.number!,
              ext: p.ext ?? null,
              type: p.type as 'cell' | 'home' | 'work',
              isPrimary: p.isPrimary,
            })),
          )
        }

        await tx
          .delete(contactEmails)
          .where(and(eq(contactEmails.tenantId, orgId), eq(contactEmails.contactId, cid)))
        if (contact.emails.length > 0) {
          await tx.insert(contactEmails).values(
            contact.emails.map((e) => ({
              tenantId: orgId,
              contactId: cid,
              address: e.address,
              type: e.type as 'work' | 'personal',
              isPrimary: e.isPrimary,
            })),
          )
        }
      } else {
        if (contact.billingContact) {
          await tx
            .update(contacts)
            .set({ billingContact: false })
            .where(
              and(
                eq(contacts.tenantId, orgId),
                eq(contacts.customerId, id),
              ),
            )
        }

        const [newContact] = await tx
          .insert(contacts)
          .values({
            tenantId: orgId,
            customerId: id,
            firstName: contact.firstName,
            lastName: contact.lastName || null,
            jobTitle: contact.jobTitle ?? null,
            birthday: contact.birthday || null,
            anniversary: contact.anniversary || null,
            smsConsent: contact.smsConsent,
            billingContact: contact.billingContact,
            bookingContact: contact.bookingContact,
          })
          .returning({ id: contacts.id })

        const newNormPhones = contact.phones
          .map((p) => ({ ...p, number: normalizePhone(p.number) }))
          .filter((p) => p.number)
        if (newNormPhones.length > 0 && newContact) {
          await tx.insert(contactPhones).values(
            newNormPhones.map((p) => ({
              tenantId: orgId,
              contactId: newContact.id,
              number: p.number!,
              ext: p.ext ?? null,
              type: p.type as 'cell' | 'home' | 'work',
              isPrimary: p.isPrimary,
            })),
          )
        }
        if (contact.emails.length > 0) {
          await tx.insert(contactEmails).values(
            contact.emails.map((e) => ({
              tenantId: orgId,
              contactId: newContact.id,
              address: e.address,
              type: e.type as 'work' | 'personal',
              isPrimary: e.isPrimary,
            })),
          )
        }
      }
    }
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { success: true }
}

export async function createContactAction(
  _prevState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const customerId = String(formData.get('customerId') ?? '')
  const firstName = String(formData.get('firstName') ?? '')
  const lastName = String(formData.get('lastName') ?? '') || null
  if (!customerId || !firstName) {
    return { error: 'Customer ID and first name are required.' }
  }

  const { phones, emails } = extractIndexedArrays(formData)

  const result = await createContact(orgId, {
    customerId,
    firstName,
    lastName,
    smsConsent: formData.get('smsConsent') === '1',
    billingContact: formData.get('billingContact') === '1',
    bookingContact: formData.get('bookingContact') === '1',
    jobTitle: String(formData.get('jobTitle') ?? ''),
    birthday: String(formData.get('birthday') ?? '') || null,
    anniversary: String(formData.get('anniversary') ?? '') || null,
    phones,
    emails,
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true, id: result.id }
}

export async function createLocationAction(
  _prevState: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = createLocationSchema.safeParse({
    customerId: formData.get('customerId'),
    name: formData.get('name'),
    addressLine1: formData.get('addressLine1'),
    addressLine2: formData.get('addressLine2'),
    city: formData.get('city'),
    state: formData.get('state'),
    postalCode: formData.get('postalCode'),
    country: formData.get('country'),
    gated: formData.get('gated'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { customerId, ...locationData } = parsed.data

  const result = await createLocation(orgId, { customerId, ...locationData })

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true, id: result.id }
}

export async function updateLocationAction(
  _prevState: LocationActionState,
  formData: FormData,
): Promise<LocationActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = updateLocationSchema.safeParse({
    id: formData.get('id'),
    customerId: formData.get('customerId'),
    name: formData.get('name'),
    addressLine1: formData.get('addressLine1'),
    addressLine2: formData.get('addressLine2'),
    city: formData.get('city'),
    state: formData.get('state'),
    postalCode: formData.get('postalCode'),
    country: formData.get('country'),
    gated: formData.get('gated'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { id, customerId, ...locationData } = parsed.data

  await withTenant(orgId, async (tx) => {
    await tx
      .update(serviceLocations)
      .set({
        ...locationData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(serviceLocations.tenantId, orgId),
          eq(serviceLocations.id, id),
        ),
      )
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true, id }
}

export async function deleteLocationAction(
  id: string,
  customerId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  await withTenant(orgId, async (tx) => {
    await tx
      .delete(serviceLocations)
      .where(
        and(
          eq(serviceLocations.tenantId, orgId),
          eq(serviceLocations.id, id),
        ),
      )
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true }
}

export async function createEquipmentAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  // Collect all form fields into a plain object for Zod
  const raw: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    raw[key] = value
  }

  const parsed = equipmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const data = parsed.data
  const serviceLocationId = String(formData.get('serviceLocationId') ?? '')

  const id = await withTenant(orgId, async (tx) => {
    // Verify service location belongs to this tenant (AUDIT-004)
    const loc = await tx
      .select({ id: serviceLocations.id })
      .from(serviceLocations)
      .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, serviceLocationId)))
      .limit(1)
    if (loc.length === 0) {
      throw new Error('Invalid service location: cross-tenant access denied')
    }

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
      .insert(equipment)
      .values({ ...base, ...specific })
      .returning({ id: equipment.id })
    return row.id
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${formData.get('customerId')}`)
  return { success: true, id }
}

export async function deleteEquipmentAction(
  id: string,
  customerId: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  await withTenant(orgId, async (tx) => {
    await tx
      .delete(equipment)
      .where(
        and(
          eq(equipment.tenantId, orgId),
          eq(equipment.id, id),
        ),
      )
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true }
}

export async function deactivateCustomer(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  await withTenant(orgId, async (tx) => {
    await tx
      .update(customers)
      .set({ active: false, archivedAt: new Date() })
      .where(
        and(eq(customers.tenantId, orgId), eq(customers.id, id)),
      )
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { success: true }
}

export async function setPrimaryLocationAction(
  customerId: string,
  locationId: string | null,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await setPrimaryLocation(orgId, customerId, locationId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set primary location.'
    return { error: message }
  }

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true }
}

export async function setPrimaryContactAction(
  customerId: string,
  contactId: string | null,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await setPrimaryContact(orgId, customerId, contactId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set primary contact.'
    return { error: message }
  }

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { success: true }
}

// ── RPC-style actions (called imperatively from client components) ─────────

export async function createTagAction(name: string): Promise<{ id: string; name: string }> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No active organization')
  return createTag(orgId, name)
}

export async function createReferralSourceAction(
  name: string,
): Promise<{ id: string; name: string }> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No active organization')
  return createReferralSource(orgId, name)
}

export async function searchCustomersAction(
  q: string,
): Promise<Array<{ id: string; name: string; primaryAddress: string }>> {
  const { orgId } = await auth()
  if (!orgId) return []

  const { searchCustomers } = await import('@/lib/customers')
  return searchCustomers(orgId, q)
}

export async function renameCustomerAction(
  id: string,
  name: string,
): Promise<{ error?: string }> {
  const { orgId } = await auth()
  if (!orgId) return { error: 'No active organization.' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required.' }

  await withTenant(orgId, async (tx) => {
    await tx
      .update(customers)
      .set({ name: trimmed, updatedAt: new Date() })
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, id)))
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return {}
}
