import { eq, ilike, and, desc, asc, sql, max, count, inArray } from 'drizzle-orm'
import { clerkClient } from '@clerk/nextjs/server'
import { withTenant, type Tx } from '@/db/with-tenant'
import { normalizePhone } from '@/lib/utils'
import {
  customers,
  contacts,
  contactPhones,
  contactEmails,
  serviceLocations,
  equipment,
  tags,
  customerTags,
  customerEvents,
} from '@/db/schema'

export interface ListOpts {
  page?: number
  pageSize?: number
  active?: boolean
  city?: string
  tag?: string
  q?: string
  sort?: string
}

export interface CustomerRow {
  id: string
  name: string
  accountNo: number
  active: boolean | null
  vip: boolean | null
  primaryPhone: string | null
  primaryEmail: string | null
  primaryCity: string | null
  tagNames: string[]
}

/**
 * List customers with server-side pagination, filtering, and sorting.
 * Returns aggregated rows with primary phone/city and tag names.
 */
export async function listCustomers(
  orgId: string,
  opts: ListOpts,
): Promise<{ rows: CustomerRow[]; pageCount: number }> {
  const page = opts.page ?? 0
  const pageSize = opts.pageSize ?? 25

  return withTenant(orgId, async (tx) => {
    // Build WHERE conditions
    const conditions: Array<ReturnType<typeof eq>> = [eq(customers.tenantId, orgId)]

    if (opts.active !== undefined) {
      conditions.push(eq(customers.active, opts.active))
    }

    if (opts.q) {
      const term = `%${opts.q}%`
      // Strip non-digits for phone matching (DB stores raw digits)
      const phoneDigits = opts.q.replace(/\D/g, '')
      const phoneTerm = phoneDigits ? `%${phoneDigits}%` : null
      const phoneClause = phoneTerm
        ? sql`OR EXISTS (
            SELECT 1 FROM contact_phones cp
            JOIN contacts c ON cp.contact_id = c.id
            WHERE c.customer_id = ${customers.id} AND cp.number ILIKE ${phoneTerm}
          )`
        : sql``
      conditions.push(
        sql`(
          ${customers.name} ILIKE ${term}
          OR EXISTS (
            SELECT 1 FROM contact_emails ce
            JOIN contacts c ON ce.contact_id = c.id
            WHERE c.customer_id = ${customers.id} AND ce.address ILIKE ${term}
          )
          OR EXISTS (
            SELECT 1 FROM service_locations sl
            WHERE sl.customer_id = ${customers.id}
              AND (sl.address_line1 ILIKE ${term} OR sl.city ILIKE ${term} OR sl.postal_code ILIKE ${term})
          )
          ${phoneClause}
        )`,
      )
    }

    // Sort
    const sortCol = opts.sort === 'name' ? customers.name : customers.createdAt
    const order = opts.sort === 'name' ? asc(sortCol) : desc(sortCol)

    // Count query
    const [{ c }] = await tx
      .select({ c: count() })
      .from(customers)
      .where(and(...conditions))

    const pageCount = Math.ceil(c / pageSize)

    // Main query — paginated customer list
    const rows = await tx
      .select({
        id: customers.id,
        name: customers.name,
        accountNo: customers.accountNo,
        active: customers.active,
        vip: customers.vip,
        primaryLocationId: customers.primaryLocationId,
      })
      .from(customers)
      .where(and(...conditions))
      .orderBy(order)
      .limit(pageSize)
      .offset(page * pageSize)

    // Fetch related data in batch to avoid N+1
    const customerIds = rows.map((r) => r.id)

    let phones: Array<{ customerId: string; number: string; isPrimary: boolean | null }> = []
    let emails: Array<{ customerId: string; address: string; isPrimary: boolean | null }> = []
    let locations: Array<{ customerId: string; city: string | null }> = []
    let tagRows: Array<{ customerId: string; tagName: string }> = []

    if (customerIds.length > 0) {
      phones = await tx
        .select({
          customerId: contacts.customerId,
          number: contactPhones.number,
          isPrimary: contactPhones.isPrimary,
        })
        .from(contactPhones)
        .innerJoin(contacts, eq(contactPhones.contactId, contacts.id))
        .where(
          and(
            eq(contacts.tenantId, orgId),
            inArray(contacts.customerId, customerIds),
          ),
        )

      emails = await tx
        .select({
          customerId: contacts.customerId,
          address: contactEmails.address,
          isPrimary: contactEmails.isPrimary,
        })
        .from(contactEmails)
        .innerJoin(contacts, eq(contactEmails.contactId, contacts.id))
        .where(
          and(
            eq(contacts.tenantId, orgId),
            inArray(contacts.customerId, customerIds),
          ),
        )

      locations = await tx
        .select({
          customerId: serviceLocations.customerId,
          city: serviceLocations.city,
        })
        .from(serviceLocations)
        .where(
          and(
            eq(serviceLocations.tenantId, orgId),
            inArray(serviceLocations.customerId, customerIds),
          ),
        )

      tagRows = await tx
        .select({
          customerId: customerTags.customerId,
          tagName: tags.name,
        })
        .from(customerTags)
        .innerJoin(tags, eq(customerTags.tagId, tags.id))
        .where(
          and(
            eq(customerTags.tenantId, orgId),
            inArray(customerTags.customerId, customerIds),
          ),
        )
    }

    // Merge into row shape
    const result: CustomerRow[] = rows.map((row) => {
      const customerPhones = phones.filter((p) => p.customerId === row.id)
      const primary = customerPhones.find((p) => p.isPrimary) ?? customerPhones[0]

      const customerEmails = emails.filter((e) => e.customerId === row.id)
      const primaryEmail = customerEmails.find((e) => e.isPrimary) ?? customerEmails[0]

      const customerLocs = locations.filter((l) => l.customerId === row.id)
      const firstCity = customerLocs[0]?.city ?? null

      const customerTagNames = tagRows
        .filter((t) => t.customerId === row.id)
        .map((t) => t.tagName)

      return {
        id: row.id,
        name: row.name,
        accountNo: row.accountNo,
        active: row.active,
        vip: row.vip,
        primaryLocationId: row.primaryLocationId,
        primaryPhone: primary?.number ?? null,
        primaryEmail: primaryEmail?.address ?? null,
        primaryCity: firstCity,
        tagNames: customerTagNames,
      }
    })

    return { rows: result, pageCount }
  })
}

export interface SearchResult {
  id: string
  name: string
  primaryAddress: string
}

/**
 * Type-ahead search across customers, contacts, phones, emails, and locations.
 * Returns only {id, name, primaryAddress}.
 */
export async function searchCustomers(
  orgId: string,
  q: string,
): Promise<SearchResult[]> {
  const term = `%${q}%`
  // Phones are stored as raw digits; strip non-digits for phone matching
  const phoneDigits = q.replace(/\D/g, '')
  const phoneTerm = phoneDigits ? `%${phoneDigits}%` : null

  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: customers.id,
        name: customers.name,
        addressLine1: serviceLocations.addressLine1,
        city: serviceLocations.city,
      })
      .from(customers)
      .leftJoin(serviceLocations, eq(serviceLocations.customerId, customers.id))
      .leftJoin(contacts, eq(contacts.customerId, customers.id))
      .leftJoin(contactPhones, eq(contactPhones.contactId, contacts.id))
      .leftJoin(contactEmails, eq(contactEmails.contactId, contacts.id))
      .where(
        and(
          eq(customers.tenantId, orgId),
          sql`(
            ${customers.name} ILIKE ${term}
            OR ${serviceLocations.addressLine1} ILIKE ${term}
            OR ${serviceLocations.city} ILIKE ${term}
            OR ${contactEmails.address} ILIKE ${term}
            ${phoneTerm ? sql`OR ${contactPhones.number} ILIKE ${phoneTerm}` : sql``}
          )`,
        ),
      )
      .limit(50)

    // Deduplicate by customer id (joins produce multiple rows per customer)
    const seen = new Set<string>()
    const results: SearchResult[] = []

    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)

      const address = [row.addressLine1, row.city]
        .filter(Boolean)
        .join(', ')

      results.push({
        id: row.id,
        name: row.name,
        primaryAddress: address,
      })

      if (results.length >= 20) break
    }

    return results
  })
}

/** Fetch a single customer by ID (tenant-scoped via withTenant). */
export async function getCustomerById(
  orgId: string,
  id: string,
): Promise<typeof customers.$inferSelect | null> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, id)))
      .limit(1)
    return rows[0] ?? null
  })
}

/** Fetch customer with all contacts, phones, and emails. */
export async function getCustomerWithContacts(
  orgId: string,
  id: string,
): Promise<
  | (typeof customers.$inferSelect & {
      contactList: Array<
        typeof contacts.$inferSelect & {
          phones: typeof contactPhones.$inferSelect[]
          emails: typeof contactEmails.$inferSelect[]
        }
      >
    })
  | null
> {
  return withTenant(orgId, async (tx) => {
    const customerRows = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, id)))
      .limit(1)
    const customer = customerRows[0]
    if (!customer) return null

    const contactRows = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, orgId), eq(contacts.customerId, id)))

    const contactList = await Promise.all(
      contactRows.map(async (c) => {
        const phones = await tx
          .select()
          .from(contactPhones)
          .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.contactId, c.id)))
        const emails = await tx
          .select()
          .from(contactEmails)
          .where(and(eq(contactEmails.tenantId, orgId), eq(contactEmails.contactId, c.id)))
        return { ...c, phones, emails }
      }),
    )

    return { ...customer, contactList }
  })
}

/** Fetch customer with locations and equipment. */
export async function getCustomerWithLocationsAndEquipment(
  orgId: string,
  id: string,
): Promise<
  | (typeof customers.$inferSelect & {
      locations: Array<
        typeof serviceLocations.$inferSelect & {
          equipment: typeof equipment.$inferSelect[]
        }
      >
    })
  | null
> {
  return withTenant(orgId, async (tx) => {
    const customerRows = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, id)))
      .limit(1)
    const customer = customerRows[0]
    if (!customer) return null

    const locationRows = await tx
      .select()
      .from(serviceLocations)
      .where(
        and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.customerId, id)),
      )

    const locations = await Promise.all(
      locationRows.map(async (loc) => {
        const eqRows = await tx
          .select()
          .from(equipment)
          .where(and(eq(equipment.tenantId, orgId), eq(equipment.serviceLocationId, loc.id)))
        return { ...loc, equipment: eqRows }
      }),
    )

    return { ...customer, locations }
  })
}

/** Fetch customer events (Activity Feed). */
export async function getCustomerEvents(
  orgId: string,
  id: string,
): Promise<typeof customerEvents.$inferSelect[]> {
  const rows = await withTenant(orgId, async (tx) => {
    return tx
      .select()
      .from(customerEvents)
      .where(
        and(eq(customerEvents.tenantId, orgId), eq(customerEvents.customerId, id)),
      )
      .orderBy(desc(customerEvents.occurredAt))
  })

  // Resolve Clerk user IDs (user_...) to display names
  const clerkIds = [...new Set(rows.map((r) => r.actor).filter((a): a is string => !!a && a.startsWith('user_')))]
  if (clerkIds.length === 0) return rows
  const client = await clerkClient()
  const nameMap: Record<string, string> = {}
  await Promise.all(
    clerkIds.map(async (uid) => {
      try {
        const u = await client.users.getUser(uid)
        nameMap[uid] = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.emailAddresses[0]?.emailAddress || uid
      } catch {
        // leave as-is if lookup fails
      }
    }),
  )
  return rows.map((r) => ({
    ...r,
    actor: r.actor && nameMap[r.actor] ? nameMap[r.actor] : r.actor,
  }))
}

/** Fetch tags assigned to a customer. */
export async function getCustomerTagNames(
  orgId: string,
  customerId: string,
): Promise<string[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({ name: tags.name })
      .from(customerTags)
      .innerJoin(tags, eq(customerTags.tagId, tags.id))
      .where(
        and(eq(customerTags.tenantId, orgId), eq(customerTags.customerId, customerId)),
      )
    return rows.map((r) => r.name)
  })
}

/** Fetch equipment by service location ID (read-only for job detail). */
export async function getEquipmentByServiceLocation(
  orgId: string,
  serviceLocationId: string,
): Promise<typeof equipment.$inferSelect[]> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select()
      .from(equipment)
      .where(and(eq(equipment.tenantId, orgId), eq(equipment.serviceLocationId, serviceLocationId)))
  })
}

/** Fetch equipment for multiple service locations in one query (used by PWA sync). */
export async function getEquipmentByServiceLocations(
  orgId: string,
  serviceLocationIds: string[],
): Promise<typeof equipment.$inferSelect[]> {
  if (serviceLocationIds.length === 0) return []
  return withTenant(orgId, async (tx) => {
    return tx
      .select()
      .from(equipment)
      .where(and(eq(equipment.tenantId, orgId), inArray(equipment.serviceLocationId, serviceLocationIds)))
  })
}

export interface CreateContactInput {
  customerId: string
  firstName: string
  lastName?: string | null
  smsConsent?: boolean
  billingContact?: boolean
  bookingContact?: boolean
  jobTitle?: string
  birthday?: string | null
  anniversary?: string | null
  phones: Array<{ number: string; ext?: string | null; type: string; isPrimary: boolean }>
  emails: Array<{ address: string; type: string; isPrimary: boolean }>
}

export interface CreateLocationInput {
  customerId: string
  name?: string | null
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  gated?: boolean
  latitude?: string
  longitude?: string
}

/** Create a contact with phones and emails (called from tests and actions). */
export async function createContact(
  orgId: string,
  data: CreateContactInput,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    // Verify the customer belongs to this tenant (AUDIT-002)
    const cust = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, data.customerId)))
      .limit(1)
    if (cust.length === 0) {
      throw new Error('Invalid customer: cross-tenant access denied')
    }

    const [contact] = await tx
      .insert(contacts)
      .values({
        tenantId: orgId,
        customerId: data.customerId,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        smsConsent: data.smsConsent ?? false,
        billingContact: data.billingContact ?? false,
        bookingContact: data.bookingContact ?? false,
        jobTitle: data.jobTitle ?? null,
        birthday: data.birthday || null,
        anniversary: data.anniversary || null,
      })
      .returning({ id: contacts.id })

    const normPhones = data.phones
      .map((p) => ({ ...p, number: normalizePhone(p.number) }))
      .filter((p) => p.number)
    if (normPhones.length > 0) {
      await tx.insert(contactPhones).values(
        normPhones.map((p) => ({
          tenantId: orgId,
          contactId: contact.id,
          number: p.number!,
          ext: p.ext ?? null,
          type: p.type as 'cell' | 'home' | 'work',
          isPrimary: p.isPrimary,
        })),
      )
    }

    if (data.emails.length > 0) {
      await tx.insert(contactEmails).values(
        data.emails.map((e) => ({
          tenantId: orgId,
          contactId: contact.id,
          address: e.address,
          type: e.type as 'work' | 'personal',
          isPrimary: e.isPrimary,
        })),
      )
    }

    // If this is the customer's first contact, make it primary
    const existingContactCount = await tx
      .select({ c: count() })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, orgId),
          eq(contacts.customerId, data.customerId),
        ),
      )
    if ((existingContactCount[0]?.c ?? 0) <= 1) {
      await tx
        .update(customers)
        .set({ primaryContactId: contact.id, updatedAt: new Date() })
        .where(and(eq(customers.tenantId, orgId), eq(customers.id, data.customerId)))
    }

    return { id: contact.id }
  })
}

/** Create a service location (called from tests and actions). */
export async function createLocation(
  orgId: string,
  data: CreateLocationInput,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    // Verify the customer belongs to this tenant (AUDIT-003)
    const cust = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, data.customerId)))
      .limit(1)
    if (cust.length === 0) {
      throw new Error('Invalid customer: cross-tenant access denied')
    }

    const [row] = await tx
      .insert(serviceLocations)
      .values({
        tenantId: orgId,
        customerId: data.customerId,
        name: data.name,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country ?? 'USA',
        gated: data.gated ?? false,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      })
      .returning({ id: serviceLocations.id })

    // If this is the customer's first location, make it primary
    const existingCount = await tx
      .select({ c: count() })
      .from(serviceLocations)
      .where(
        and(
          eq(serviceLocations.tenantId, orgId),
          eq(serviceLocations.customerId, data.customerId),
        ),
      )
    if ((existingCount[0]?.c ?? 0) <= 1) {
      await tx
        .update(customers)
        .set({ primaryLocationId: row.id, updatedAt: new Date() })
        .where(and(eq(customers.tenantId, orgId), eq(customers.id, data.customerId)))
    }

    return { id: row.id }
  })
}

/** Set a customer's primary location. Verifies the location belongs to the customer. */
export async function setPrimaryLocation(
  orgId: string,
  customerId: string,
  locationId: string | null,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    if (locationId) {
      // Verify the location belongs to this customer (not just tenant)
      const loc = await tx
        .select({ customerId: serviceLocations.customerId })
        .from(serviceLocations)
        .where(
          and(
            eq(serviceLocations.tenantId, orgId),
            eq(serviceLocations.id, locationId),
          ),
        )
        .limit(1)
      if (loc.length === 0 || loc[0].customerId !== customerId) {
        throw new Error('Invalid location: does not belong to this customer')
      }
    }

    await tx
      .update(customers)
      .set({ primaryLocationId: locationId, updatedAt: new Date() })
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
  })
}

/** Set a customer's primary contact. Verifies the contact belongs to the customer. */
export async function setPrimaryContact(
  orgId: string,
  customerId: string,
  contactId: string | null,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    if (contactId) {
      const contact = await tx
        .select({ customerId: contacts.customerId })
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, orgId),
            eq(contacts.id, contactId),
          ),
        )
        .limit(1)
      if (contact.length === 0 || contact[0].customerId !== customerId) {
        throw new Error('Invalid contact: does not belong to this customer')
      }
    }

    await tx
      .update(customers)
      .set({ primaryContactId: contactId, updatedAt: new Date() })
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, customerId)))
  })
}
