import { describe, expect, it } from 'vitest'
import { ALLOWED_TRANSITIONS } from '@/lib/jobs/transitions'

describe('status bottom sheet data contract', () => {
  it('exposes only the legal next statuses for on_site', () => {
    const legal = ALLOWED_TRANSITIONS['on_site']
    expect(legal).toEqual([
      'unscheduled',
      'scheduled',
      'dispatched',
      'started',
      'paused',
      'completed',
      'partially_completed',
      'cancelled',
    ])
  })

  it('does not include paid statuses in the on_site options', () => {
    const legal = new Set(ALLOWED_TRANSITIONS['on_site'])
    expect(legal.has('paid_in_full')).toBe(false)
    expect(legal.has('invoiced')).toBe(false)
  })
})
