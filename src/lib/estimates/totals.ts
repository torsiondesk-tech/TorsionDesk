/**
 * Integer-cents money math for estimate line items.
 *
 * Mirrors src/lib/jobs/totals.ts with estimate-specific totals and per-group
 * subtotals (D-05 / D-07).
 */

export interface EstimateLineItemInput {
  type: 'product' | 'service' | 'discount' | 'expense'
  qty: string | null
  rate: string | null
  cost: string | null
  taxRate: string | null
  groupId: string | null
}

export interface EstimateTotals {
  products: string
  services: string
  discount: string
  taxes: string
  estimateTotal: string
  estimateCost: string
  grossProfit: string
  grossProfitPct: string | null
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
 * Compute estimate totals from line items and groups.
 *
 * - Products / services are bucketed separately (estimates do not use expenses).
 * - Discounts reduce estimateTotal and are excluded from estimateCost.
 * - Per-item tax is rounded per line then summed.
 * - Group subtotals aggregate line totals per groupId.
 * - Gross Profit % guards divide-by-zero.
 */
export function computeEstimateTotals(
  items: EstimateLineItemInput[],
  _groups: { id: string; name: string }[],
): EstimateTotals {
  let productC = 0
  let serviceC = 0
  let discountC = 0
  let taxC = 0
  let costC = 0
  const groupCents: Record<string, number> = {}

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
      case 'discount':
        discountC += lineCents
        break
    }

    // Per-group subtotals (all line types except discounts, matching visible subtotal)
    if (item.groupId) {
      groupCents[item.groupId] = (groupCents[item.groupId] ?? 0) + lineCents
    }

    // Cost (excluding discounts)
    if (item.type !== 'discount') {
      const costRateCents = toCents(item.cost)
      costC += Math.round(costRateCents * qty)
    }

    // Per-item tax rounded per line
    if (item.taxRate != null) {
      const taxRatePct = parseFloat(item.taxRate) || 0
      taxC += Math.round(lineCents * (taxRatePct / 100))
    }
  }

  const estimateTotalC = productC + serviceC + discountC + taxC

  // Gross Profit % guards divide-by-zero
  let grossProfitPct: string | null = null
  if (estimateTotalC !== 0) {
    grossProfitPct = ((estimateTotalC - costC) / estimateTotalC * 100).toFixed(1)
  }

  const groupSubtotals: Record<string, string> = {}
  for (const [groupId, cents] of Object.entries(groupCents)) {
    groupSubtotals[groupId] = fromCents(cents)
  }

  return {
    products: fromCents(productC),
    services: fromCents(serviceC),
    discount: fromCents(Math.abs(discountC)),
    taxes: fromCents(taxC),
    estimateTotal: fromCents(estimateTotalC),
    estimateCost: fromCents(costC),
    grossProfit: fromCents(estimateTotalC - costC),
    grossProfitPct,
    groupSubtotals,
  }
}
