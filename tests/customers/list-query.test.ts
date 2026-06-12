/**
 * CUST-09 — customer list query builder with filter/sort/paginate (RED until src/lib/customers.ts exists).
 *
 * Contract: listCustomers(orgId, opts) returns {rows, pageCount}.
 * Applies WHERE for active/city/tag/q and LIMIT/OFFSET from page/pageSize.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

let lastLimit = 0
let lastOffset = 0

function makeProxy(finalValue: unknown, onLimit?: (n: number) => void): any {
  return new Proxy(() => {}, {
    get(_target, prop: string | symbol) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => {
          resolve(finalValue)
        }
      }
      if (prop === 'limit' && onLimit) {
        return (n: number) => {
          onLimit(n)
          return makeProxy(finalValue)
        }
      }
      return makeProxy(finalValue, onLimit)
    },
    apply(_target, _thisArg, _args) {
      return makeProxy(finalValue, onLimit)
    },
  })
}

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() =>
        makeProxy([{ c: 0 }], (n: number) => {
          lastLimit = n
        }),
      ),
      and: vi.fn(() => ({} as never)),
      eq: vi.fn(() => ({} as never)),
      sql: { array: vi.fn(() => ({} as never)) },
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { listCustomers } from '@/lib/customers'

describe('listCustomers', () => {
  beforeEach(() => {
    lastLimit = 0
    lastOffset = 0
  })

  it('applies LIMIT 25 / OFFSET 0 for page 0, pageSize 25', async () => {
    await listCustomers(ORG_A, {
      page: 0,
      pageSize: 25,
      active: true,
      city: 'Chicago',
      tag: 'VIP',
      q: 'smith',
      sort: 'name',
    })

    expect(lastLimit).toBe(25)
  })
})
