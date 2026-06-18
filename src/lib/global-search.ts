import { sql, eq, and } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  customers,
  jobs,
  contacts,
  contactPhones,
  contactEmails,
  serviceLocations,
  equipment,
} from '@/db/schema'
import { formatPhone } from '@/lib/utils'

export type GlobalSearchResult = {
  id: string
  type: 'job' | 'customer' | 'contact' | 'phone' | 'email' | 'location' | 'equipment'
  title: string
  subtitle: string
  href: string
}

export async function performGlobalSearch(
  orgId: string,
  q: string,
): Promise<GlobalSearchResult[]> {
  const trimmed = q.trim()
  if (!trimmed) return []
  const term = `%${trimmed}%`

  return withTenant(orgId, async (tx) => {
    const [
      jobRows,
      customerRows,
      contactRows,
      phoneRows,
      emailRows,
      locRows,
      equipRows,
    ] = await Promise.all([
      // Jobs
      tx
        .select({
          id: jobs.id,
          jobNo: jobs.jobNo,
          description: jobs.description,
          customerName: customers.name,
        })
        .from(jobs)
        .innerJoin(customers, eq(jobs.customerId, customers.id))
        .where(
          and(
            eq(jobs.tenantId, orgId),
            sql`${jobs.jobNo}::text ILIKE ${term} OR ${jobs.description} ILIKE ${term} OR ${jobs.poNumber} ILIKE ${term}`,
          ),
        )
        .limit(5),

      // Customers
      tx
        .select({
          id: customers.id,
          name: customers.name,
          accountNo: customers.accountNo,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, orgId),
            sql`${customers.name} ILIKE ${term} OR ${customers.accountNo}::text ILIKE ${term}`,
          ),
        )
        .limit(5),

      // Contacts
      tx
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          customerId: contacts.customerId,
          customerName: customers.name,
        })
        .from(contacts)
        .innerJoin(customers, eq(contacts.customerId, customers.id))
        .where(
          and(
            eq(contacts.tenantId, orgId),
            sql`${contacts.firstName} ILIKE ${term} OR ${contacts.lastName} ILIKE ${term}`,
          ),
        )
        .limit(5),

      // Phones
      tx
        .select({
          id: contactPhones.id,
          number: contactPhones.number,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          customerId: contacts.customerId,
          customerName: customers.name,
        })
        .from(contactPhones)
        .innerJoin(contacts, eq(contactPhones.contactId, contacts.id))
        .innerJoin(customers, eq(contacts.customerId, customers.id))
        .where(
          and(
            eq(contactPhones.tenantId, orgId),
            sql`${contactPhones.number} ILIKE ${term}`,
          ),
        )
        .limit(5),

      // Emails
      tx
        .select({
          id: contactEmails.id,
          address: contactEmails.address,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          customerId: contacts.customerId,
          customerName: customers.name,
        })
        .from(contactEmails)
        .innerJoin(contacts, eq(contactEmails.contactId, contacts.id))
        .innerJoin(customers, eq(contacts.customerId, customers.id))
        .where(
          and(
            eq(contactEmails.tenantId, orgId),
            sql`${contactEmails.address} ILIKE ${term}`,
          ),
        )
        .limit(5),

      // Service locations
      tx
        .select({
          id: serviceLocations.id,
          name: serviceLocations.name,
          addressLine1: serviceLocations.addressLine1,
          city: serviceLocations.city,
          state: serviceLocations.state,
          postalCode: serviceLocations.postalCode,
          customerId: serviceLocations.customerId,
          customerName: customers.name,
        })
        .from(serviceLocations)
        .innerJoin(customers, eq(serviceLocations.customerId, customers.id))
        .where(
          and(
            eq(serviceLocations.tenantId, orgId),
            sql`${serviceLocations.name} ILIKE ${term} OR ${serviceLocations.addressLine1} ILIKE ${term} OR ${serviceLocations.city} ILIKE ${term} OR ${serviceLocations.state} ILIKE ${term} OR ${serviceLocations.postalCode} ILIKE ${term}`,
          ),
        )
        .limit(5),

      // Equipment
      tx
        .select({
          id: equipment.id,
          brand: equipment.brand,
          model: equipment.model,
          serial: equipment.serial,
          serviceLocationId: equipment.serviceLocationId,
          customerId: serviceLocations.customerId,
          customerName: customers.name,
          locationAddress: serviceLocations.addressLine1,
        })
        .from(equipment)
        .innerJoin(
          serviceLocations,
          eq(equipment.serviceLocationId, serviceLocations.id),
        )
        .innerJoin(customers, eq(serviceLocations.customerId, customers.id))
        .where(
          and(
            eq(equipment.tenantId, orgId),
            sql`${equipment.brand} ILIKE ${term} OR ${equipment.model} ILIKE ${term} OR ${equipment.serial} ILIKE ${term}`,
          ),
        )
        .limit(5),
    ])

    const results: GlobalSearchResult[] = []

    for (const row of jobRows) {
      results.push({
        id: row.id,
        type: 'job',
        title: `JOB-${row.jobNo}`,
        subtitle: [row.customerName, row.description].filter(Boolean).join(' — '),
        href: `/jobs/${row.id}`,
      })
    }

    for (const row of customerRows) {
      results.push({
        id: row.id,
        type: 'customer',
        title: row.name,
        subtitle: `Account #${row.accountNo}`,
        href: `/customers/${row.id}`,
      })
    }

    for (const row of contactRows) {
      results.push({
        id: row.id,
        type: 'contact',
        title: `${row.firstName} ${row.lastName ?? ''}`.trim(),
        subtitle: row.customerName,
        href: `/customers/${row.customerId}`,
      })
    }

    for (const row of phoneRows) {
      results.push({
        id: row.id,
        type: 'phone',
        title: formatPhone(row.number),
        subtitle: [
          `${row.contactFirstName} ${row.contactLastName ?? ''}`.trim(),
          row.customerName,
        ]
          .filter(Boolean)
          .join(' — '),
        href: `/customers/${row.customerId}`,
      })
    }

    for (const row of emailRows) {
      results.push({
        id: row.id,
        type: 'email',
        title: row.address,
        subtitle: [
          `${row.contactFirstName} ${row.contactLastName ?? ''}`.trim(),
          row.customerName,
        ]
          .filter(Boolean)
          .join(' — '),
        href: `/customers/${row.customerId}`,
      })
    }

    for (const row of locRows) {
      results.push({
        id: row.id,
        type: 'location',
        title: row.name || row.addressLine1 || 'Unnamed location',
        subtitle: [row.city, row.state, row.postalCode, row.customerName]
          .filter(Boolean)
          .join(' — '),
        href: `/customers/${row.customerId}`,
      })
    }

    for (const row of equipRows) {
      results.push({
        id: row.id,
        type: 'equipment',
        title: [row.brand, row.model].filter(Boolean).join(' ') || 'Equipment',
        subtitle: [row.customerName, row.locationAddress]
          .filter(Boolean)
          .join(' — '),
        href: `/customers/${row.customerId}`,
      })
    }

    return results
  })
}
