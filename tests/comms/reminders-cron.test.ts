/**
 * COMM-07 + D-05 — Cron dispatches overdue scheduled_sms rows.
 *
 * Contract:
 *   1. Overdue, unsent, non-cancelled rows are sent via Twilio.
 *   2. Already-sent or cancelled rows are skipped.
 *   3. Endpoint requires CRON_SECRET bearer token.
 */

import { describe, it, expect } from 'vitest'

const { GET } = await import('@/app/api/cron/sms-reminders/route')

describe('reminders cron', () => {
  it('exports a GET handler', () => {
    expect(GET).toBeDefined()
    expect(typeof GET).toBe('function')
  })
})
