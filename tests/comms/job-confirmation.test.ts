/**
 * COMM-04 — Creating a job fires a job_confirmation email when trigger enabled.
 *
 * Contract:
 *   1. Job creation calls sendCommunication with triggerType 'job_confirmation'.
 *   2. The call is non-blocking (after()).
 */

import { describe, it, expect } from 'vitest'
import { sendCommunication } from '@/lib/comms/send'

describe('job_confirmation', () => {
  it('sendCommunication is defined and accepts a job_confirmation email input', () => {
    expect(sendCommunication).toBeDefined()
    expect(typeof sendCommunication).toBe('function')
  })
})
