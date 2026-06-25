import { max, eq } from 'drizzle-orm'
import type { Tx } from '@/db/with-tenant'
import { invoices, payments } from '@/db/schema'

/**
 * Compute the next per-tenant invoice number inside the caller's withTenant tx.
 * Must run inside the same transaction as the invoice insert — never outside.
 * The UNIQUE(tenant_id, invoice_no) constraint is the backstop for the rare race.
 * Seed base is 1000; Phase 10 reseeds above the max imported SF invoice number.
 */
export async function nextInvoiceNo(tx: Tx, tenantId: string): Promise<number> {
  const [{ m }] = await tx
    .select({ m: max(invoices.invoiceNo) })
    .from(invoices)
    .where(eq(invoices.tenantId, tenantId))
  return (m ?? 1000) + 1
}

/**
 * Compute the next per-tenant payment number inside the caller's withTenant tx.
 * Mirrors nextInvoiceNo but uses the payments table (INV-14 unique payment#).
 */
export async function nextPaymentNo(tx: Tx, tenantId: string): Promise<number> {
  const [{ m }] = await tx
    .select({ m: max(payments.paymentNo) })
    .from(payments)
    .where(eq(payments.tenantId, tenantId))
  return (m ?? 1000) + 1
}
