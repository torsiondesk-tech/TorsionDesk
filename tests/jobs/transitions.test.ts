/**
 * JOB-03 — FSM transition validation (RED until src/lib/jobs/transitions.ts exists).
 *
 * Contract: ALLOWED_TRANSITIONS map + STATUS_GROUPS + isLegalTransition()
 * Enforces server-side status machine; illegal jumps throw/reject.
 *
 * Exact transition edges marked [ASSUMED] per RESEARCH Assumption A1 —
 * owner must confirm against Service Fusion before Wave 2 implementation.
 */

import { describe, it, expect } from 'vitest'

// Not-yet-existing module under test — RED signal.
import {
  ALLOWED_TRANSITIONS,
  STATUS_GROUPS,
  isLegalTransition,
} from '@/lib/jobs/transitions'

describe('STATUS_GROUPS', () => {
  it('has exactly three keys: open, in_progress, closed', () => {
    expect(Object.keys(STATUS_GROUPS).sort()).toEqual([
      'closed',
      'in_progress',
      'open',
    ])
  })

  it('contains all 15 canonical status values across the three groups', () => {
    const allStatuses = new Set<string>([
      ...STATUS_GROUPS.open,
      ...STATUS_GROUPS.in_progress,
      ...STATUS_GROUPS.closed,
    ])
    const expected = new Set([
      'unscheduled',
      'scheduled',
      'dispatched',
      'cancelled',
      'delayed',
      'on_the_way',
      'on_site',
      'started',
      'paused',
      'resumed',
      'partially_completed',
      'completed',
      'invoiced',
      'paid_in_full',
      'job_closed',
    ])
    expect(allStatuses).toEqual(expected)
  })

  it('has no overlap between groups', () => {
    const openSet = new Set(STATUS_GROUPS.open)
    const inProgressSet = new Set(STATUS_GROUPS.in_progress)
    const closedSet = new Set(STATUS_GROUPS.closed)

    for (const s of inProgressSet) {
      expect(openSet.has(s)).toBe(false)
      expect(closedSet.has(s)).toBe(false)
    }
    for (const s of closedSet) {
      expect(openSet.has(s)).toBe(false)
      expect(inProgressSet.has(s)).toBe(false)
    }
  })
})

describe('isLegalTransition', () => {
  it('returns true for a legal forward edge (completed -> invoiced) [ASSUMED]', () => {
    expect(isLegalTransition('completed', 'invoiced')).toBe(true)
  })

  it('returns false for a terminal -> open jump (job_closed -> scheduled) [ASSUMED]', () => {
    expect(isLegalTransition('job_closed', 'scheduled')).toBe(false)
  })

  it('returns false for an illegal jump across groups (unscheduled -> paid_in_full) [ASSUMED]', () => {
    expect(isLegalTransition('unscheduled', 'paid_in_full')).toBe(false)
  })

  it('returns false for cancelled -> anything [ASSUMED]', () => {
    expect(isLegalTransition('cancelled', 'scheduled')).toBe(false)
    expect(isLegalTransition('cancelled', 'completed')).toBe(false)
  })

  it('returns true for on_the_way -> on_site [ASSUMED]', () => {
    expect(isLegalTransition('on_the_way', 'on_site')).toBe(true)
  })

  it('returns false for any transition when from status is not in ALLOWED_TRANSITIONS', () => {
    expect(isLegalTransition('nonexistent' as any, 'scheduled')).toBe(false)
  })
})

describe('ALLOWED_TRANSITIONS', () => {
  it('is defined and is a Record<JobStatusValue, JobStatusValue[]>', () => {
    expect(ALLOWED_TRANSITIONS).toBeDefined()
    expect(typeof ALLOWED_TRANSITIONS).toBe('object')
  })

  it('contains an entry for every status in STATUS_GROUPS', () => {
    for (const group of Object.values(STATUS_GROUPS)) {
      for (const status of group) {
        expect(ALLOWED_TRANSITIONS).toHaveProperty(status)
        expect(Array.isArray(ALLOWED_TRANSITIONS[status as keyof typeof ALLOWED_TRANSITIONS])).toBe(true)
      }
    }
  })

  it('has empty arrays for terminal statuses (job_closed, cancelled) [ASSUMED]', () => {
    expect(ALLOWED_TRANSITIONS['job_closed' as keyof typeof ALLOWED_TRANSITIONS]).toEqual([])
    expect(ALLOWED_TRANSITIONS['cancelled' as keyof typeof ALLOWED_TRANSITIONS]).toEqual([])
  })
})
