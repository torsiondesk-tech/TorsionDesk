/**
 * Integer-cents money math for invoice line items.
 *
 * Mirrors src/lib/estimates/totals.ts with invoice-specific totals. Balance is
 * intentionally not computed here — it is a locked recompute from payment
 * allocations (D-05).
 */

export interface InvoiceLineItemInput {
  type: 'product' | 'service' | 'discount' | 'expense'
  qty: string | null
  rate: string | null
  cost: string | null
  taxRate: string | null
  groupId: string | null
}

export interface InvoiceTotals {
  subtotal: string
  taxTotal: string
  discountTotal: string
  invoiceTotal: string
  groupSubtotals: Record<string, string>
}

/** Convert a money string to integer cents. */
function toCents(s: string | null | undefined): number {
  return Math.round(parseFloat(s ?? '0') * 100) || 0
}

/** Convert integer cents to a formatted dollar string. */
function fromCents(c: number): string {
  return (c / 100).toFixed(2)
}

/**
 * Compute invoice totals from line items.
 *
 * - Subtotal = products + services (customer charges before discounts/tax).
 * - Discounts reduce invoiceTotal and are excluded from customer charges.
 * - Tax is calculated per taxable line and summed.
 * - Expenses are excluded from the invoice total (internal cost only).
 * - Group subtotals aggregate billable line totals per groupId.
 */
export function computeInvoiceTotals(items: InvoiceLineItemInput[]): InvoiceTotals {
  let productC = 0
  let serviceC = 0
  let discountC = 0
  let taxC = 0
  const groupCents: Record<string, number> = {}

  for (const item of items) {
    const rateCents = toCents(item.rate)
    const qty = parseFloat(item.qty ?? '0') || 0
    const lineCents = Math.round(rateCents * qty)

    // Billable buckets (expenses are not billed to the customer)
    switch (item.type) {
      case 'product':
        productC += lineCents
        break
      case 'service':
        serviceC += lineCents
        break
      case 'discount':
        discountC += lineCents
        break
    }

    // Group subtotals include billable lines only
    if (item.groupId && item.type !== 'expense') {
      groupCents[item.groupId] = (groupCents[item.groupId] ?? 0) + lineCents
    }

    // Per-item tax rounded per line
    if (item.taxRate != null) {
      const taxRatePct = parseFloat(item.taxRate) || 0
      taxC += Math.round(lineCents * (taxRatePct / 100))
    }
  }

  const subtotalC = productC + serviceC
  const invoiceTotalC = subtotalC + discountC + taxC

  const groupSubtotals: Record<string, string> = {}
  for (const [groupId, cents] of Object.entries(groupCents)) {
    groupSubtotals[groupId] = fromCents(cents)
  }

  return {
    subtotal: fromCents(subtotalC),
    taxTotal: fromCents(taxC),
    discountTotal: fromCents(Math.abs(discountC)),
    invoiceTotal: fromCents(invoiceTotalC),
    groupSubtotals,
  }
}
