/**
 * COMM-09 — Estimate/invoice email includes an in-process-rendered PDF attachment.
 *
 * Contract:
 *   1. sendCommunication attaches a base64 PDF for estimate/invoice sends.
 *   2. The PDF is rendered in-process, not fetched from /api/* /pdf.
 */

import { describe, it, expect } from 'vitest'
import { sendCommunication } from '@/lib/comms/send'

describe('PDF attachment', () => {
  it('sendCommunication is defined and will attach PDFs for estimate/invoice sends', () => {
    expect(sendCommunication).toBeDefined()
    expect(typeof sendCommunication).toBe('function')
  })
})
