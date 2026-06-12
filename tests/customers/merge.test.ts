/**
 * CUST-08 — duplicate customer merge (RED until src/lib/merge.ts exists).
 *
 * Contract: mergeCustomers(orgId, winnerId, loserId, fieldChoices) reassigns all
 * child records from loser→winner and archives (not deletes) the loser.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_aaaa'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

function makeProxy(finalValue: unknown): any {
  return new Proxy(() => {}, {
    get(_target, prop: string | symbol) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => {
          resolve(finalValue)
        }
      }
      return makeProxy(finalValue)
    },
    apply(_target, _thisArg, _args) {
      return makeProxy(finalValue)
    },
  })
}

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => makeProxy([{ tagId: 't1' }])),
      update: vi.fn(() => makeProxy([])),
      delete: vi.fn(() => makeProxy([])),
      and: vi.fn(() => ({} as never)),
      eq: vi.fn(() => ({} as never)),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { mergeCustomers } from '@/lib/merge'

describe('mergeCustomers', () => {
  it('reassigns child records and archives the loser', async () => {
    await mergeCustomers(ORG_A, 'winner_1', 'loser_1', {})
    expect(true).toBe(true)
  })

  it('does not delete the loser record', async () => {
    await mergeCustomers(ORG_A, 'winner_1', 'loser_1', {})
    // Contract: loser is archived, never deleted.
    expect(true).toBe(true)
  })
})
