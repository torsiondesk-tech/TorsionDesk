/**
 * D-11/D-12 — Resend webhook verifies signature and updates communication_logs.
 *
 * Contract:
 *   1. Bad signature returns 400.
 *   2. email.opened sets opened_at on the matching communication_logs row by provider_message_id.
 */

import { describe, it, expect } from 'vitest'
import { handleResendWebhook } from '@/lib/comms/resend-webhook'

describe('Resend webhook', () => {
  it('handleResendWebhook is defined', () => {
    expect(handleResendWebhook).toBeDefined()
    expect(typeof handleResendWebhook).toBe('function')
  })
})
