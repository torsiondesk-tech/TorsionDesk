/**
 * JOB-06 — computeJobTotals cent-exact money math (RED until src/lib/jobs/totals.ts exists).
 *
 * Contract:
 *   1. Float-breaking inputs yield cent-exact string totals (integer-cents arithmetic).
 *   2. Discount line items reduce jobTotal and are excluded from jobCost.
 *   3. Per-item tax is rounded per line, then summed.
 *   4. driveLabor is always "0.00" (D-11).
 *   5. payments is always "0.00" in Phase 3 (Phase 7 wires payments).
 *   6. Gross Profit % guards divide-by-zero when jobTotal is 0.
 *
 * Rounding policy (per-line tax) marked [ASSUMED] per RESEARCH Assumption A3 —
 * owner must confirm against an SF invoice before Wave 2 implementation.
 */

import { describe, it, expect } from 'vitest'

// Not-yet-existing module under test — RED signal.
import { computeJobTotals } from '@/lib/jobs/totals'

describe('computeJobTotals', () => {
  it('is cent-exact on float-breaking inputs (3 × 19.99 = 59.97) [ASSUMED rounding]', () => {
    const result = computeJobTotals([
      {
        type: 'product',
        qty: '3',
        rate: '19.99',
        cost: '10.00',
        taxRate: null,
      },
    ])
    expect(result.products).toBe('59.97')
    expect(result.jobTotal).toBe('59.97')
  })

  it('reduces jobTotal by a discount line and excludes discount from jobCost', () => {
    const result = computeJobTotals([
      {
        type: 'product',
        qty: '2',
        rate: '50.00',
        cost: '25.00',
        taxRate: null,
      },
      {
        type: 'discount',
        qty: '1',
        rate: '-5.00',
        cost: null,
        taxRate: null,
      },
    ])
    // 2 × 50.00 − 5.00 = 95.00
    expect(result.jobTotal).toBe('95.00')
    // Cost = 2 × 25.00 = 50.00 (discount excluded from cost)
    expect(result.jobCost).toBe('50.00')
  })

  it('calculates per-item tax rounded per line [ASSUMED]', () => {
    const result = computeJobTotals([
      {
        type: 'service',
        qty: '1',
        rate: '100.00',
        cost: '0',
        taxRate: '8.25',
      },
    ])
    // 100.00 × 8.25% = 8.25
    expect(result.taxes).toBe('8.25')
    expect(result.jobTotal).toBe('108.25')
  })

  it('returns driveLabor as "0.00" always (D-11)', () => {
    const result = computeJobTotals([])
    expect(result.driveLabor).toBe('0.00')
  })

  it('returns payments as "0.00" in Phase 3 (Phase 7 wires payments)', () => {
    const result = computeJobTotals([])
    expect(result.payments).toBe('0.00')
  })

  it('returns grossProfitPct as null when jobTotal is 0 (divide-by-zero guard)', () => {
    const result = computeJobTotals([
      {
        type: 'discount',
        qty: '1',
        rate: '-10.00',
        cost: null,
        taxRate: null,
      },
    ])
    // Discount of -10.00 makes jobTotal = -10.00, which is non-zero — try an all-zero case
    // Actually, let's test with a line that nets to zero:
    const zeroResult = computeJobTotals([
      {
        type: 'product',
        qty: '1',
        rate: '0.00',
        cost: '0.00',
        taxRate: null,
      },
    ])
    expect(zeroResult.jobTotal).toBe('0.00')
    expect(zeroResult.grossProfitPct).toBeNull()
  })

  it('calculates grossProfitPct for a normal job', () => {
    const result = computeJobTotals([
      {
        type: 'product',
        qty: '1',
        rate: '200.00',
        cost: '100.00',
        taxRate: null,
      },
    ])
    // GP% = (200 - 100) / 200 = 50.0%
    expect(result.jobTotal).toBe('200.00')
    expect(result.jobCost).toBe('100.00')
    expect(result.grossProfitPct).toBe('50.0')
  })

  it('handles mixed products, services, expenses, and discounts', () => {
    const result = computeJobTotals([
      {
        type: 'product',
        qty: '2',
        rate: '25.00',
        cost: '10.00',
        taxRate: null,
      },
      {
        type: 'service',
        qty: '1.5',
        rate: '80.00',
        cost: '0',
        taxRate: null,
      },
      {
        type: 'expense',
        qty: '1',
        rate: '12.50',
        cost: '12.50',
        taxRate: null,
      },
      {
        type: 'discount',
        qty: '1',
        rate: '-10.00',
        cost: null,
        taxRate: null,
      },
    ])
    // products: 2 × 25.00 = 50.00
    expect(result.products).toBe('50.00')
    // services: 1.5 × 80.00 = 120.00
    expect(result.services).toBe('120.00')
    // expenses: 1 × 12.50 = 12.50
    expect(result.expenses).toBe('12.50')
    // jobTotal: 50 + 120 + 12.5 - 10 = 172.50
    expect(result.jobTotal).toBe('172.50')
    // jobCost: 2×10 + 1.5×0 + 1×12.50 = 32.50 (discount excluded)
    expect(result.jobCost).toBe('32.50')
    // totalDue equals jobTotal in Phase 3 (no payments yet)
    expect(result.totalDue).toBe('172.50')
  })
})
