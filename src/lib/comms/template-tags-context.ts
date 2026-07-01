import 'server-only'

import { eq, and, sql } from 'drizzle-orm'
import type { Tx } from '@/db/with-tenant'
import {
  invoices,
  invoiceLineItems,
  customers,
  contacts,
  serviceLocations,
  jobs,
  tenants,
  paymentAllocations,
  payments,
} from '@/db/schema'
import { getLogoSignedUrl } from '@/lib/storage'
import type { InvoiceTagContext, TagContext } from './template-tags'
import type { TriggerType } from './triggers'

function toDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function toCents(s: string | number | null | undefined): number {
  if (s == null) return 0
  if (typeof s === 'number') return Math.round(s * 100) || 0
  return Math.round(parseFloat(s) * 100) || 0
}

export async function buildInvoiceContext(
  tx: Tx,
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceTagContext> {
  const [invoice] = await tx
    .select({
      id: invoices.id,
      tenantId: invoices.tenantId,
      invoiceNo: invoices.invoiceNo,
      invoiceDate: invoices.invoiceDate,
      dueDate: invoices.dueDate,
      total: invoices.total,
      notes: invoices.notes,
      paymentTermsDays: invoices.paymentTermsDays,
      jobId: invoices.jobId,
      customerId: invoices.customerId,
      contactId: invoices.contactId,
      serviceLocationId: invoices.serviceLocationId,
    })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
    .limit(1)

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`)
  }

  const [customer] = invoice.customerId
    ? await tx
        .select({ name: customers.name })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, invoice.customerId)))
        .limit(1)
    : [null]

  const [contact] = invoice.contactId
    ? await tx
        .select({ firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, invoice.contactId)))
        .limit(1)
    : [null]

  const [location] = invoice.serviceLocationId
    ? await tx
        .select({
          addressLine1: serviceLocations.addressLine1,
          addressLine2: serviceLocations.addressLine2,
          city: serviceLocations.city,
          state: serviceLocations.state,
          postalCode: serviceLocations.postalCode,
        })
        .from(serviceLocations)
        .where(and(eq(serviceLocations.tenantId, tenantId), eq(serviceLocations.id, invoice.serviceLocationId)))
        .limit(1)
    : [null]

  const [job] = invoice.jobId
    ? await tx
        .select({ jobNo: jobs.jobNo, description: jobs.description })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, invoice.jobId)))
        .limit(1)
    : [null]

  const lineItems = await tx
    .select({
      id: invoiceLineItems.id,
      type: invoiceLineItems.type,
      title: invoiceLineItems.title,
      description: invoiceLineItems.description,
      qty: invoiceLineItems.qty,
      rate: invoiceLineItems.rate,
      cost: invoiceLineItems.cost,
    })
    .from(invoiceLineItems)
    .where(and(eq(invoiceLineItems.tenantId, tenantId), eq(invoiceLineItems.invoiceId, invoiceId)))
    .orderBy(invoiceLineItems.sortOrder)

  const paymentRows = await tx
    .select({ amountApplied: paymentAllocations.amountApplied })
    .from(paymentAllocations)
    .innerJoin(
      payments,
      and(eq(payments.tenantId, paymentAllocations.tenantId), eq(payments.id, paymentAllocations.paymentId)),
    )
    .where(and(eq(paymentAllocations.tenantId, tenantId), eq(paymentAllocations.invoiceId, invoiceId)))

  const totalCents = toCents(invoice.total)
  const appliedCents = paymentRows.reduce((sum, p) => sum + toCents(p.amountApplied), 0)
  const balance = (Math.max(0, totalCents - appliedCents) / 100).toFixed(2)

  const [tenant] = await tx
    .select({
      companyName: tenants.companyName,
      phone: tenants.phone,
      email: tenants.email,
      address: tenants.address,
      logoUrl: tenants.logoUrl,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const logoSignedUrl = tenant?.logoUrl ? await getLogoSignedUrl(tenant.logoUrl, 3600) : null

  return {
    kind: 'invoice',
    tenantId,
    invoiceId,
    invoice: {
      invoiceNo: invoice.invoiceNo,
      invoiceDate: toDateString(invoice.invoiceDate),
      dueDate: toDateString(invoice.dueDate),
      total: String(invoice.total),
      balance,
      notes: invoice.notes ?? null,
      paymentTermsDays: invoice.paymentTermsDays ?? null,
      jobId: invoice.jobId ?? null,
      customerId: invoice.customerId,
      contactId: invoice.contactId ?? null,
      serviceLocationId: invoice.serviceLocationId ?? null,
    },
    customer: { name: customer?.name ?? null },
    contact: contact ? { firstName: contact.firstName, lastName: contact.lastName ?? null } : null,
    location: location
      ? {
          addressLine1: location.addressLine1 ?? null,
          addressLine2: location.addressLine2 ?? null,
          city: location.city ?? null,
          state: location.state ?? null,
          postalCode: location.postalCode ?? null,
        }
      : null,
    job: job ? { jobNo: job.jobNo, description: job.description ?? null } : null,
    lineItems: lineItems.map((li) => ({
      id: li.id,
      type: li.type ?? null,
      title: li.title ?? null,
      description: li.description ?? null,
      qty: li.qty ?? null,
      rate: li.rate ?? null,
      cost: li.cost ?? null,
    })),
    company: {
      name: tenant?.companyName ?? null,
      phone: tenant?.phone ?? null,
      email: tenant?.email ?? null,
      address: tenant?.address ?? null,
      logoSignedUrl,
    },
  }
}

export async function buildContextForTrigger(
  tx: Tx,
  tenantId: string,
  triggerType: TriggerType,
  refId: string,
): Promise<TagContext> {
  switch (triggerType) {
    case 'invoice_send':
      return buildInvoiceContext(tx, tenantId, refId)
    case 'payment_receipt': {
      // For receipts the refId is the payment id; find the allocated invoice.
      const [allocation] = await tx
        .select({ invoiceId: paymentAllocations.invoiceId })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.tenantId, tenantId), eq(paymentAllocations.paymentId, refId)))
        .orderBy(sql`${paymentAllocations.amountApplied} DESC`)
        .limit(1)
      if (allocation?.invoiceId) {
        return buildInvoiceContext(tx, tenantId, allocation.invoiceId)
      }
      throw new Error(`No invoice found for payment ${refId}`)
    }
    case 'estimate_send':
    case 'job_confirmation':
    case 'tech_notify':
    case 'on_the_way':
    case 'appointment_reminder':
    default:
      // General fallback: only company tags resolve. Estimate/job builders can be added here.
      const [tenant] = await tx
        .select({
          companyName: tenants.companyName,
          phone: tenants.phone,
          email: tenants.email,
          address: tenants.address,
          logoUrl: tenants.logoUrl,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1)
      const logoSignedUrl = tenant?.logoUrl ? await getLogoSignedUrl(tenant.logoUrl, 3600) : null
      return {
        kind: 'general',
        tenantId,
        company: {
          name: tenant?.companyName ?? null,
          phone: tenant?.phone ?? null,
          email: tenant?.email ?? null,
          address: tenant?.address ?? null,
          logoSignedUrl,
        },
      }
  }
}
