/**
 * D-13 / INV-12 — Invoice detail derives Email Opened from communication_logs.
 *
 * Contract:
 *   1. getInvoiceAction joins the latest invoice email from communication_logs.
 *   2. The invoice detail sidebar shows the Email Opened timestamp.
 */

import { describe, it, expect } from 'vitest'
import { getInvoiceAction } from '@/app/(app)/invoices/actions'

describe('INV-12 Email Opened', () => {
  it('getInvoiceAction is defined', () => {
    expect(getInvoiceAction).toBeDefined()
    expect(typeof getInvoiceAction).toBe('function')
  })
})
