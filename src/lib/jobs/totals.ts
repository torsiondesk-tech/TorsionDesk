/**
 * Integer-cents money math for job line items.
 *
 * Pitfall 2: Never use floating-point arithmetic for money.
 * All rates, costs, and quantities are parsed to integer cents,
 * math is done in cents, and the result is formatted back to strings.
 *
 * Assumption A3 (per-line tax rounding) and A6 (GP% formula) are marked
 * with [ASSUMED] — owner must confirm against SF invoices.
 */

export interface LineItemInput {
  type: 'product' | 'service' | 'discount' | 'expense'
  qty: string | null
  rate: string | null
  cost: string | null
  taxRate: string | null
}

export interface JobTotals {
  products: string
  services: string
  expenses: string
  taxes: string
  driveLabor: string
  jobTotal: string
  jobCost: string
  payments: string
  totalDue: string
  grossProfitPct: string | null
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
 * Compute job totals from line items.
 *
 * - Products / services / expenses are bucketed separately.
 * - Discounts reduce jobTotal and are excluded from jobCost.
 * - Per-item tax is rounded per line then summed [ASSUMED A3].
 * - driveLabor is always $0.00 (D-11).
 * - payments is always $0.00 in Phase 3 (wired in Phase 7).
 * - Gross Profit % guards divide-by-zero [ASSUMED A6].
 */
export function computeJobTotals(items: LineItemInput[]): JobTotals {
  let productC = 0
  let serviceC = 0
  let expenseC = 0
  let discountC = 0
  let taxC = 0
  let costC = 0

  for (const item of items) {
    const rateCents = toCents(item.rate)
    const qty = parseFloat(item.qty ?? '0') || 0
    const lineCents = Math.round(rateCents * qty)

    // Bucket by type
    switch (item.type) {
      case 'product':
        productC += lineCents
        break
      case 'service':
        serviceC += lineCents
        break
      case 'expense':
        expenseC += lineCents
        break
      case 'discount':
        discountC += lineCents
        break
    }

    // Cost (excluding discounts)
    if (item.type !== 'discount') {
      const costRateCents = toCents(item.cost)
      costC += Math.round(costRateCents * qty)
    }

    // Per-item tax rounded per line [ASSUMED A3 — owner confirm]
    if (item.taxRate != null) {
      const taxRatePct = parseFloat(item.taxRate) || 0
      taxC += Math.round(lineCents * (taxRatePct / 100))
    }
  }

  const jobTotalC = productC + serviceC + expenseC + discountC + taxC

  // Gross Profit % guards divide-by-zero (Pitfall 3)
  let grossProfitPct: string | null = null
  if (jobTotalC !== 0) {
    // [ASSUMED A6 — owner confirm GP% formula]
    grossProfitPct = ((jobTotalC - costC) / jobTotalC * 100).toFixed(1)
  }

  return {
    products: fromCents(productC),
    services: fromCents(serviceC),
    expenses: fromCents(expenseC),
    taxes: fromCents(taxC),
    driveLabor: '0.00', // D-11 placeholder
    jobTotal: fromCents(jobTotalC),
    jobCost: fromCents(costC),
    payments: '0.00', // Phase 7 placeholder
    totalDue: fromCents(jobTotalC),
    grossProfitPct,
  }
}
