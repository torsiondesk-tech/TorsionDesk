'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import { customers, customerTags, contacts, contactPhones, contactEmails, serviceLocations, equipment } from '@/db/schema'
import { nextAccountNo } from '@/lib/account-number'
import { equipmentSchema } from '@/lib/equipment-schema'
import { createContact, createLocation } from '@/lib/customers'
import { createTag, createReferralSource } from '@/lib/tags'

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

// ── Schemas ────────────────────────────────────────────────────────────────

// Zod v4: .optional() does NOT accept null; FormData.get() returns null for
// missing keys. This helper converts null/empty-string → undefined so optional
// fields work correctly with native form submissions.
const optionalString = z.preprocess(
  (val) => (val === '' || val === null || val === undefined) ? undefined : val,
  z.string().optional(),
)

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

const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  vip: formBool(false),
  active: formBool(true),
  parentCustomerId: optionalString,
  assignedAgentId: optionalString,
  referralSourceId: optionalString,
  internalNotes: optionalString,
  publicNotes: optionalString,
  tagIds: z.array(z.string()).default([]),
})

const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().min(1),
})

const createLocationSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().trim().min(1, 'Location name is required'),
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  country: optionalString,
  gated: formBool(false),
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
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { tagIds: parsedTagIds, ...customerData } = parsed.data

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

        return row.id
      })

      revalidatePath('/customers')
      return { success: true, id }
    } catch (err) {
      attempts++
      if (attempts >= maxAttempts) {
        console.error('createCustomer failed after retries:', err)
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
  name: z.string().trim().min(1, 'Name is required'),
  vip: z.boolean().default(false),
  active: z.boolean().default(true),
  taxable: z.boolean().default(true),
  parentCustomerId: z.string().nullable().optional(),
  assignedAgentId: z.string().nullable().optional(),
  referralSourceId: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  publicNotes: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  contacts: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, 'Contact name is required'),
        jobTitle: z.string().nullable().optional(),
        birthday: z.string().nullable().optional(),
        anniversary: z.string().nullable().optional(),
        smsConsent: z.boolean().default(false),
        billingContact: z.boolean().default(false),
        bookingContact: z.boolean().default(false),
        phones: z
          .array(
            z.object({
              number: z.string().min(1),
              type: z.string(),
              isPrimary: z.boolean(),
            }),
          )
          .default([]),
        emails: z
          .array(
            z.object({
              address: z.string().min(1),
              type: z.string(),
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
        await tx
          .update(contacts)
          .set({
            name: contact.name,
            jobTitle: contact.jobTitle ?? null,
            birthday: contact.birthday || null,
            anniversary: contact.anniversary || null,
            smsConsent: contact.smsConsent,
            billingContact: contact.billingContact,
            bookingContact: contact.bookingContact,
            updatedAt: new Date(),
          } as any)
          .where(
            and(
              eq(contacts.tenantId, orgId),
              eq(contacts.id, cid),
            ),
          )

        await tx
          .delete(contactPhones)
          .where(eq(contactPhones.contactId, cid))
        if (contact.phones.length > 0) {
          await tx.insert(contactPhones).values(
            contact.phones.map((p) => ({
              tenantId: orgId,
              contactId: cid,
              number: p.number,
              type: p.type,
              isPrimary: p.isPrimary,
            })),
          )
        }

        await tx
          .delete(contactEmails)
          .where(eq(contactEmails.contactId, cid))
        if (contact.emails.length > 0) {
          await tx.insert(contactEmails).values(
            contact.emails.map((e) => ({
              tenantId: orgId,
              contactId: cid,
              address: e.address,
              type: e.type,
              isPrimary: e.isPrimary,
            })),
          )
        }
      } else {
        const [newContact] = await tx
          .insert(contacts)
          .values({
            tenantId: orgId,
            customerId: id,
            name: contact.name,
            jobTitle: contact.jobTitle ?? null,
            birthday: contact.birthday || null,
            anniversary: contact.anniversary || null,
            smsConsent: contact.smsConsent,
            billingContact: contact.billingContact,
            bookingContact: contact.bookingContact,
          } as any)
          .returning({ id: contacts.id })

        if (contact.phones.length > 0 && newContact) {
          await tx.insert(contactPhones).values(
            contact.phones.map((p) => ({
              tenantId: orgId,
              contactId: newContact.id,
              number: p.number,
              type: p.type,
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
              type: e.type,
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
  const name = String(formData.get('name') ?? '')
  if (!customerId || !name) {
    return { error: 'Customer ID and name are required.' }
  }

  const { phones, emails } = extractIndexedArrays(formData)

  const result = await createContact(orgId, {
    customerId,
    name,
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
    const base = {
      tenantId: orgId,
      serviceLocationId,
      kind: data.kind,
      installDate: data.installDate ? new Date(data.installDate) : null,
      warrantyExpires: data.warrantyExpires ? new Date(data.warrantyExpires) : null,
      notes: data.notes ?? null,
    }

    let specific: Record<string, unknown> = {}
    switch (data.kind) {
      case 'door':
        specific = {
          brand: data.brand,
          widthFt: String(data.widthFt),
          heightFt: String(data.heightFt),
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
          hp: data.hp ? String(data.hp) : null,
          serial: data.serial ?? null,
        }
        break
      case 'spring':
        specific = {
          wireSize: String(data.wireSize),
          insideDiameter: String(data.insideDiameter),
          length: String(data.length),
          windDirection: data.windDirection,
          cycleRating: data.cycleRating ?? null,
        }
        break
    }

    const [row] = await tx
      .insert(equipment)
      .values({ ...base, ...specific } as any)
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
