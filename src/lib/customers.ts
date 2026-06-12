'use server'

import { eq, ilike, and, desc, asc, sql, max, count, inArray } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { withTenant, type Tx } from '@/db/with-tenant'
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

async function activeOrgId(): Promise<string> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No active organization')
  return orgId
}

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
      conditions.push(
        sql`${customers.name} ILIKE ${term}`,
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
      })
      .from(customers)
      .where(and(...conditions))
      .orderBy(order)
      .limit(pageSize)
      .offset(page * pageSize)

    // Fetch related data in batch to avoid N+1
    const customerIds = rows.map((r) => r.id)

    let phones: Array<{ customerId: string; number: string; isPrimary: boolean | null }> = []
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
        primaryPhone: primary?.number ?? null,
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
      .where(
        and(
          eq(customers.tenantId, orgId),
          sql`${customers.name} ILIKE ${term}`,
        ),
      )
      .limit(20)

    // Deduplicate by customer id (leftJoin may produce multiple rows per customer)
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
          .where(eq(contactPhones.contactId, c.id))
        const emails = await tx
          .select()
          .from(contactEmails)
          .where(eq(contactEmails.contactId, c.id))
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
          .where(eq(equipment.serviceLocationId, loc.id))
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
  return withTenant(orgId, async (tx) => {
    return tx
      .select()
      .from(customerEvents)
      .where(
        and(eq(customerEvents.tenantId, orgId), eq(customerEvents.customerId, id)),
      )
      .orderBy(desc(customerEvents.occurredAt))
  })
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

export interface CreateContactInput {
  customerId: string
  name: string
  smsConsent?: boolean
  billingContact?: boolean
  bookingContact?: boolean
  jobTitle?: string
  birthday?: string | null
  anniversary?: string | null
  phones: Array<{ number: string; type: string; isPrimary: boolean }>
  emails: Array<{ address: string; type: string; isPrimary: boolean }>
}

export interface CreateLocationInput {
  customerId: string
  name: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  gated?: boolean
}

/** Create a contact with phones and emails (called from tests and actions). */
export async function createContact(
  orgId: string,
  data: CreateContactInput,
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    const [contact] = await tx
      .insert(contacts)
      .values({
        tenantId: orgId,
        customerId: data.customerId,
        name: data.name,
        smsConsent: data.smsConsent ?? false,
        billingContact: data.billingContact ?? false,
        bookingContact: data.bookingContact ?? false,
        jobTitle: data.jobTitle ?? null,
        birthday: data.birthday ? new Date(data.birthday) : null,
        anniversary: data.anniversary ? new Date(data.anniversary) : null,
      } as any)
      .returning({ id: contacts.id })

    if (data.phones.length > 0) {
      await tx.insert(contactPhones).values(
        data.phones.map((p) => ({
          tenantId: orgId,
          contactId: contact.id,
          number: p.number,
          type: p.type,
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
          type: e.type,
          isPrimary: e.isPrimary,
        })),
      )
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
      })
      .returning({ id: serviceLocations.id })
    return { id: row.id }
  })
}
