/**
 * D-05 — computeInvoiceTotals cent-exact money math + discount handling.
 * (RED until src/lib/invoices/totals.ts exists).
 *
 * Contract:
 *   1. Float-breaking inputs yield cent-exact string totals (integer-cents arithmetic).
 *   2. Discount line items reduce invoiceTotal.
 *   3. Tax items are applied to taxable items only.
 *   4. Group subtotals aggregate line totals per groupId.
 */

import { describe, it, expect } from 'vitest'

// Not-yet-existing module under test — RED signal.
import { computeInvoiceTotals } from '@/lib/invoices/totals'

describe('computeInvoiceTotals', () => {
  it('is cent-exact on float-breaking inputs (3 × 19.99 = 59.97)', () => {
    const result = computeInvoiceTotals([
      {
        type: 'product',
        qty: '3',
        rate: '19.99',
        cost: '10.00',
        taxRate: null,
        groupId: null,
      },
    ])
    expect(result.invoiceTotal).toBe('59.97')
  })

  it('reduces invoiceTotal by a discount line item', () => {
    const result = computeInvoiceTotals([
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
    ])
    expect(result.invoiceTotal).toBe('95.00')
  })

  it('applies tax to taxable items only', () => {
    const result = computeInvoiceTotals([
      {
        type: 'service',
        qty: '1',
        rate: '100.00',
        cost: '0',
        taxRate: '8.25',
        groupId: null,
      },
      {
        type: 'product',
        qty: '1',
        rate: '50.00',
        cost: '30.00',
        taxRate: null,
        groupId: null,
      },
    ])
    expect(result.taxTotal).toBe('8.25')
    expect(result.subtotal).toBe('150.00')
    expect(result.invoiceTotal).toBe('158.25')
  })

  it('accumulates groupSubtotals for grouped items', () => {
    const result = computeInvoiceTotals([
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
    ])
    expect(result.groupSubtotals['g1']).toBe('15.00')
    expect(result.invoiceTotal).toBe('15.00')
  })
})
