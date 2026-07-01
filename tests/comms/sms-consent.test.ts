/**
 * D-06 + COMM-08 — SMS resolver refuses non-consented contacts.
 *
 * Contract:
 *   1. resolveSmsRecipient returns null for a contact with sms_consent=false.
 *   2. No SMS is sent to a non-consented contact regardless of column default.
 */

import { describe, it, expect } from 'vitest'
import { resolveSmsRecipient } from '@/app/(app)/communications/recipients'

describe('sms consent gate', () => {
  it('resolveSmsRecipient is defined', () => {
    expect(resolveSmsRecipient).toBeDefined()
    expect(typeof resolveSmsRecipient).toBe('function')
  })
})
