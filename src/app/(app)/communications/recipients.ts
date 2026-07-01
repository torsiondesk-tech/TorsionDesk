import { eq, and, desc } from 'drizzle-orm'
import { withTenant, type Tx } from '@/db/with-tenant'
import {
  contacts,
  contactEmails,
  contactPhones,
  jobs,
  customers,
  teamProfiles,
  jobAssignees,
} from '@/db/schema'

interface EmailRecipient {
  email: string
  contactId?: string
}

interface SmsRecipient {
  phone: string
  contactId: string
}

export async function resolveEmailRecipient(
  tx: Tx,
  tenantId: string,
  refKind: 'estimate' | 'invoice' | 'job',
  refId: string,
  explicitTo?: string,
): Promise<EmailRecipient | null> {
  if (explicitTo) {
    return { email: explicitTo }
  }

  let customerId: string | null = null

  if (refKind === 'job') {
    const [job] = await tx
      .select({ customerId: jobs.customerId, contactId: jobs.contactId })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, refId)))
      .limit(1)
    if (!job) return null
    customerId = job.customerId
    if (job.contactId) {
      const [email] = await tx
        .select({ address: contactEmails.address, contactId: contactEmails.contactId })
        .from(contactEmails)
        .where(and(eq(contactEmails.tenantId, tenantId), eq(contactEmails.contactId, job.contactId)))
        .orderBy(desc(contactEmails.isPrimary))
        .limit(1)
      if (email) return { email: email.address, contactId: email.contactId }
    }
  } else if (refKind === 'estimate' || refKind === 'invoice') {
    // Estimate/invoice recipient resolution: look up customer from the estimate/invoice
    // table. Both share the same customerId/contactId shape.
    const { estimates, invoices } = await import('@/db/schema')
    const table = refKind === 'estimate' ? estimates : invoices
    const [row] = await tx
      .select({ customerId: table.customerId, contactId: table.contactId })
      .from(table)
      .where(and(eq(table.tenantId, tenantId), eq(table.id, refId)))
      .limit(1)
    if (!row) return null
    customerId = row.customerId
    if (row.contactId) {
      const [email] = await tx
        .select({ address: contactEmails.address, contactId: contactEmails.contactId })
        .from(contactEmails)
        .where(and(eq(contactEmails.tenantId, tenantId), eq(contactEmails.contactId, row.contactId)))
        .orderBy(desc(contactEmails.isPrimary))
        .limit(1)
      if (email) return { email: email.address, contactId: email.contactId }
    }
  }

  if (!customerId) return null

  // Fall back to the customer's primary contact email.
  const [customer] = await tx
    .select({ primaryContactId: customers.primaryContactId })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1)

  if (customer?.primaryContactId) {
    const [email] = await tx
      .select({ address: contactEmails.address, contactId: contactEmails.contactId })
      .from(contactEmails)
      .where(
        and(
          eq(contactEmails.tenantId, tenantId),
          eq(contactEmails.contactId, customer.primaryContactId),
        ),
      )
      .orderBy(desc(contactEmails.isPrimary))
      .limit(1)
    if (email) return { email: email.address, contactId: email.contactId }
  }

  // Last resort: any email on any contact for this customer.
  const [email] = await tx
    .select({ address: contactEmails.address, contactId: contactEmails.contactId })
    .from(contactEmails)
    .innerJoin(contacts, and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactEmails.contactId)))
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.customerId, customerId)))
    .orderBy(desc(contactEmails.isPrimary))
    .limit(1)

  return email ? { email: email.address, contactId: email.contactId } : null
}

export async function resolveSmsRecipient(
  tx: Tx,
  tenantId: string,
  refKind: 'estimate' | 'invoice' | 'job',
  refId: string,
): Promise<SmsRecipient | null> {
  let customerId: string | null = null
  let preferredContactId: string | null = null

  if (refKind === 'job') {
    const [job] = await tx
      .select({ customerId: jobs.customerId, contactId: jobs.contactId })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, refId)))
      .limit(1)
    if (!job) return null
    customerId = job.customerId
    preferredContactId = job.contactId
  } else {
    const { estimates, invoices } = await import('@/db/schema')
    const table = refKind === 'estimate' ? estimates : invoices
    const [row] = await tx
      .select({ customerId: table.customerId, contactId: table.contactId })
      .from(table)
      .where(and(eq(table.tenantId, tenantId), eq(table.id, refId)))
      .limit(1)
    if (!row) return null
    customerId = row.customerId
    preferredContactId = row.contactId
  }

  async function phoneForContact(contactId: string): Promise<SmsRecipient | null> {
    const [contact] = await tx
      .select({ smsConsent: contacts.smsConsent })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
      .limit(1)
    if (!contact || contact.smsConsent === false) return null

    const [phone] = await tx
      .select({ number: contactPhones.number })
      .from(contactPhones)
      .where(and(eq(contactPhones.tenantId, tenantId), eq(contactPhones.contactId, contactId)))
      .orderBy(desc(contactPhones.isPrimary))
      .limit(1)

    return phone ? { phone: phone.number, contactId } : null
  }

  if (preferredContactId) {
    const found = await phoneForContact(preferredContactId)
    if (found) return found
  }

  // Find the booking contact for this customer.
  const [booking] = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        eq(contacts.customerId, customerId),
        eq(contacts.bookingContact, true),
      ),
    )
    .limit(1)
  if (booking) {
    const found = await phoneForContact(booking.id)
    if (found) return found
  }

  // Fall back to the customer's primary contact.
  const [customer] = await tx
    .select({ primaryContactId: customers.primaryContactId })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1)
  if (customer?.primaryContactId) {
    const found = await phoneForContact(customer.primaryContactId)
    if (found) return found
  }

  return null
}

export async function resolveTechEmail(
  tx: Tx,
  tenantId: string,
  jobId: string,
): Promise<string | null> {
  const [assignee] = await tx
    .select({ userId: jobAssignees.userId })
    .from(jobAssignees)
    .where(and(eq(jobAssignees.tenantId, tenantId), eq(jobAssignees.jobId, jobId)))
    .orderBy(desc(jobAssignees.createdAt))
    .limit(1)

  if (!assignee?.userId) return null

  const [profile] = await tx
    .select({ email: teamProfiles.email })
    .from(teamProfiles)
    .where(and(eq(teamProfiles.tenantId, tenantId), eq(teamProfiles.userId, assignee.userId)))
    .limit(1)

  return profile?.email ?? null
}

export async function resolveEmailRecipientAction(
  orgId: string,
  refKind: 'estimate' | 'invoice' | 'job',
  refId: string,
  explicitTo?: string,
): Promise<string | null> {
  return withTenant(orgId, async (tx) => {
    const result = await resolveEmailRecipient(tx, orgId, refKind, refId, explicitTo)
    return result?.email ?? null
  })
}

export async function resolveSmsRecipientAction(
  orgId: string,
  refKind: 'estimate' | 'invoice' | 'job',
  refId: string,
): Promise<{ phone: string; contactId: string } | null> {
  return withTenant(orgId, async (tx) => {
    return resolveSmsRecipient(tx, orgId, refKind, refId)
  })
}
