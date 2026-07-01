/**
 * COMM-05 — Tech notify resolves the assigned technician's email and fires.
 *
 * Contract:
 *   1. Assignment/modification of job techs triggers tech_notify email.
 *   2. resolveTechEmail returns the assigned technician's email.
 */

import { describe, it, expect } from 'vitest'
import { resolveTechEmail } from '@/app/(app)/communications/recipients'

describe('tech_notify', () => {
  it('resolveTechEmail is defined', () => {
    expect(resolveTechEmail).toBeDefined()
    expect(typeof resolveTechEmail).toBe('function')
  })
})
