/**
 * EST-04 — computeEstimateTotals cent-exact money math + group subtotals
 * (RED until src/lib/estimates/totals.ts exists).
 *
 * Contract:
 *   1. Float-breaking inputs yield cent-exact string totals (integer-cents arithmetic).
 *   2. Group subtotals are computed per groupId and formatted as strings.
 *   3. Discount line items reduce estimateTotal and are excluded from estimateCost.
 *   4. Per-item tax is rounded per line, then summed.
 *   5. Gross Profit % guards divide-by-zero when estimateTotal is 0.
 *
 * Rounding policy (per-line tax) marked [ASSUMED] per RESEARCH Assumption A3.
 */

import { describe, it, expect } from 'vitest'

// Not-yet-existing module under test — RED signal.
import { computeEstimateTotals } from '@/lib/estimates/totals'

describe('computeEstimateTotals', () => {
  it('is cent-exact on float-breaking inputs (3 × 19.99 = 59.97)', () => {
    const result = computeEstimateTotals(
      [
        {
          type: 'product',
          qty: '3',
          rate: '19.99',
          cost: '10.00',
          taxRate: null,
          groupId: null,
        },
      ],
      [],
    )
    expect(result.products).toBe('59.97')
    expect(result.estimateTotal).toBe('59.97')
  })

  it('accumulates groupSubtotals for items in the same group', () => {
    const result = computeEstimateTotals(
      [
        {
          type: 'product',
          qty: '1',
          rate: '10.00',
          cost: '5.00',
          taxRate: null,
          groupId: 'g1',
        },
        {
          type: 'service',
          qty: '1',
          rate: '5.00',
          cost: '0',
          taxRate: null,
          groupId: 'g1',
        },
      ],
      [{ id: 'g1', name: 'Hardware' }],
    )
    expect(result.groupSubtotals['g1']).toBe('15.00')
    expect(result.estimateTotal).toBe('15.00')
  })

  it('keeps ungrouped items out of groupSubtotals', () => {
    const result = computeEstimateTotals(
      [
        {
          type: 'product',
          qty: '1',
          rate: '20.00',
          cost: '10.00',
          taxRate: null,
          groupId: null,
        },
      ],
      [],
    )
    expect(Object.keys(result.groupSubtotals)).toHaveLength(0)
    expect(result.estimateTotal).toBe('20.00')
  })

  it('reduces estimateTotal by a discount line and excludes discount from estimateCost', () => {
    const result = computeEstimateTotals(
      [
        {
          type: 'product',
          qty: '2',
          rate: '50.00',
          cost: '25.00',
          taxRate: null,
          groupId: null,
        },
        {
          type: 'discount',
          qty: '1',
          rate: '-5.00',
          cost: null,
          taxRate: null,
          groupId: null,
        },
      ],
      [],
    )
    // 2 × 50.00 − 5.00 = 95.00
    expect(result.estimateTotal).toBe('95.00')
    // Cost = 2 × 25.00 = 50.00 (discount excluded from cost)
    expect(result.estimateCost).toBe('50.00')
  })

  it('calculates per-item tax rounded per line', () => {
    const result = computeEstimateTotals(
      [
        {
          type: 'service',
          qty: '1',
          rate: '100.00',
          cost: '0',
          taxRate: '8.25',
          groupId: null,
        },
      ],
      [],
    )
    // 100.00 × 8.25% = 8.25
    expect(result.taxes).toBe('8.25')
    expect(result.estimateTotal).toBe('108.25')
  })

  it('returns grossProfitPct as null when estimateTotal is 0 (divide-by-zero guard)', () => {
    const zeroResult = computeEstimateTotals(
      [
        {
          type: 'product',
          qty: '1',
          rate: '0.00',
          cost: '0.00',
          taxRate: null,
          groupId: null,
        },
      ],
      [],
    )
    expect(zeroResult.estimateTotal).toBe('0.00')
    expect(zeroResult.grossProfitPct).toBeNull()
  })

  it('calculates grossProfitPct for a normal estimate', () => {
    const result = computeEstimateTotals(
      [
        {
          type: 'product',
          qty: '1',
          rate: '200.00',
          cost: '100.00',
          taxRate: null,
          groupId: null,
        },
      ],
      [],
    )
    expect(result.estimateTotal).toBe('200.00')
    expect(result.estimateCost).toBe('100.00')
    expect(result.grossProfitPct).toBe('50.0')
  })

  it('handles mixed products, services, and discounts', () => {
    const result = computeEstimateTotals(
      [
        {
          type: 'product',
          qty: '2',
          rate: '25.00',
          cost: '10.00',
          taxRate: null,
          groupId: 'g1',
        },
        {
          type: 'service',
          qty: '1.5',
          rate: '80.00',
          cost: '0',
          taxRate: null,
          groupId: 'g1',
        },
        {
          type: 'discount',
          qty: '1',
          rate: '-10.00',
          cost: null,
          taxRate: null,
          groupId: null,
        },
      ],
      [{ id: 'g1', name: 'Spring bundle' }],
    )
    // products: 2 × 25.00 = 50.00
    expect(result.products).toBe('50.00')
    // services: 1.5 × 80.00 = 120.00
    expect(result.services).toBe('120.00')
    // estimateTotal: 50 + 120 - 10 = 160.00
    expect(result.estimateTotal).toBe('160.00')
    // group subtotal
    expect(result.groupSubtotals['g1']).toBe('170.00')
    // cost: 2×10 + 1.5×0 = 20.00 (discount excluded)
    expect(result.estimateCost).toBe('20.00')
  })
})
