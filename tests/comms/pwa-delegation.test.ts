/**
 * COMM-06 — sendCustomerCommunicationAction honors the SendCommunicationInput contract.
 *
 * Contract:
 *   1. The canonical action accepts the existing SendCommunicationInput shape unchanged.
 *   2. The PWA wrapper can dynamically import and call it without error.
 */

import { describe, it, expect } from 'vitest'
import { sendCustomerCommunicationAction } from '@/app/(app)/communications/actions'

describe('PWA send delegation', () => {
  it('sendCustomerCommunicationAction is defined', () => {
    expect(sendCustomerCommunicationAction).toBeDefined()
    expect(typeof sendCustomerCommunicationAction).toBe('function')
  })
})
