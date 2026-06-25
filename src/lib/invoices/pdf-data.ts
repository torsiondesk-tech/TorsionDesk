import { eq, and, sql } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  invoices,
  invoiceLineItems,
  customers,
  contacts,
  serviceLocations,
  jobs,
  jobSignatures,
  paymentAllocations,
  payments,
} from '@/db/schema'

export interface InvoicePdfLineItem {
  id: string
  type: string | null
  refId: string | null
  title: string | null
  description: string | null
  qty: string | null
  rate: string | null
  cost: string | null
  taxItemId: string | null
  sortOrder: number | null
  groupId: string | null
}

export interface InvoicePdfPayment {
  paymentNo: number
  receivedOn: string | null
  method: string
  amountApplied: string
}

export interface InvoicePdfData {
  id: string
  tenantId: string
  invoiceNo: number
  invoiceDate: string | null
  dueDate: string | null
  paymentTermsDays: number | null
  total: string
  balance: string
  notes: string | null
  internalNotes: string | null
  customer: {
    id: string
    name: string | null
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
  } | null
  contact: {
    firstName: string
    lastName: string | null
  } | null
  job: {
    id: string
    jobNo: number
    completionNotes: string | null
  } | null
  signatureUrl: string | null
  signedBy: string | null
  lineItems: InvoicePdfLineItem[]
  payments: InvoicePdfPayment[]
}

function toDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export async function getInvoiceForPdf(
  orgId: string,
  id: string,
): Promise<InvoicePdfData | null> {
  return withTenant(orgId, async (tx) => {
    const [invoice] = await tx
      .select({
        id: invoices.id,
        tenantId: invoices.tenantId,
        invoiceNo: invoices.invoiceNo,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        paymentTermsDays: invoices.paymentTermsDays,
        total: invoices.total,
        notes: invoices.notes,
        internalNotes: invoices.internalNotes,
        customerId: invoices.customerId,
        contactId: invoices.contactId,
        serviceLocationId: invoices.serviceLocationId,
        jobId: invoices.jobId,
      })
      .from(invoices)
      .where(and(eq(invoices.tenantId, orgId), eq(invoices.id, id)))
      .limit(1)

    if (!invoice) return null

    const [customerRow] = await tx
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, invoice.customerId)))
      .limit(1)

    const locationId = invoice.serviceLocationId ?? null
    const [locationRow] = locationId
      ? await tx
          .select({
            addressLine1: serviceLocations.addressLine1,
            addressLine2: serviceLocations.addressLine2,
            city: serviceLocations.city,
            state: serviceLocations.state,
            postalCode: serviceLocations.postalCode,
          })
          .from(serviceLocations)
          .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, locationId)))
          .limit(1)
      : [null]

    const [contactRow] = invoice.contactId
      ? await tx
          .select({ firstName: contacts.firstName, lastName: contacts.lastName })
          .from(contacts)
          .where(and(eq(contacts.tenantId, orgId), eq(contacts.id, invoice.contactId)))
          .limit(1)
      : [null]

    const [jobRow] = await tx
      .select({ id: jobs.id, jobNo: jobs.jobNo, completionNotes: jobs.completionNotes })
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, invoice.jobId)))
      .limit(1)

    const [signatureRow] = await tx
      .select({ storagePath: jobSignatures.storagePath, signedBy: jobSignatures.signedBy })
      .from(jobSignatures)
      .where(
        and(
          eq(jobSignatures.tenantId, orgId),
          eq(jobSignatures.jobId, invoice.jobId),
          eq(jobSignatures.signatureType, 'complete'),
        ),
      )
      .orderBy(sql`${jobSignatures.createdAt} DESC`)
      .limit(1)

    const lineItems = await tx
      .select()
      .from(invoiceLineItems)
      .where(and(eq(invoiceLineItems.tenantId, orgId), eq(invoiceLineItems.invoiceId, id)))
      .orderBy(invoiceLineItems.sortOrder)

    const paymentRows = await tx
      .select({
        paymentNo: payments.paymentNo,
        receivedOn: payments.receivedOn,
        method: payments.method,
        amountApplied: paymentAllocations.amountApplied,
      })
      .from(paymentAllocations)
      .innerJoin(
        payments,
        and(eq(payments.tenantId, paymentAllocations.tenantId), eq(payments.id, paymentAllocations.paymentId)),
      )
      .where(and(eq(paymentAllocations.tenantId, orgId), eq(paymentAllocations.invoiceId, id)))
      .orderBy(sql`${paymentAllocations.createdAt} DESC`)

    const totalNum = parseFloat(invoice.total)
    const applied = paymentRows.reduce((sum, p) => sum + parseFloat(p.amountApplied), 0)
    const balance = Math.max(0, totalNum - applied).toFixed(2)

    return {
      id: invoice.id,
      tenantId: invoice.tenantId,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: toDateString(invoice.invoiceDate),
      dueDate: toDateString(invoice.dueDate),
      paymentTermsDays: invoice.paymentTermsDays,
      total: String(invoice.total),
      balance,
      notes: invoice.notes ?? null,
      internalNotes: invoice.internalNotes ?? null,
      customer: customerRow
        ? {
            id: customerRow.id,
            name: customerRow.name,
            addressLine1: locationRow?.addressLine1 ?? null,
            addressLine2: locationRow?.addressLine2 ?? null,
            city: locationRow?.city ?? null,
            state: locationRow?.state ?? null,
            postalCode: locationRow?.postalCode ?? null,
          }
        : null,
      contact: contactRow
        ? { firstName: contactRow.firstName, lastName: contactRow.lastName ?? null }
        : null,
      job: jobRow
        ? { id: jobRow.id, jobNo: jobRow.jobNo, completionNotes: jobRow.completionNotes ?? null }
        : null,
      signatureUrl: signatureRow?.storagePath ?? null,
      signedBy: signatureRow?.signedBy ?? null,
      lineItems: lineItems.map((li) => ({
        id: li.id,
        type: li.type,
        refId: li.refId ?? null,
        title: li.title ?? null,
        description: li.description ?? null,
        qty: li.qty,
        rate: li.rate,
        cost: li.cost,
        taxItemId: li.taxItemId ?? null,
        sortOrder: li.sortOrder,
        groupId: li.groupId ?? null,
      })),
      payments: paymentRows.map((p) => ({
        paymentNo: p.paymentNo,
        receivedOn: toDateString(p.receivedOn),
        method: p.method,
        amountApplied: String(p.amountApplied),
      })),
    }
  })
}
