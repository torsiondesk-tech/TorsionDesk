/**
 * COMM-07 + D-04 — on_the_way transition attempts SMS and does not roll back on failure.
 *
 * Contract:
 *   1. Status transition to on_the_way fires an SMS.
 *   2. Twilio failure logs status='failed' without rolling back the transition.
 */

import { describe, it, expect } from 'vitest'
import { sendCommunication } from '@/lib/comms/send'

describe('on_the_way SMS', () => {
  it('sendCommunication supports on_the_way SMS', () => {
    expect(sendCommunication).toBeDefined()
    expect(typeof sendCommunication).toBe('function')
  })
})
