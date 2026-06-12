/**
 * CUST-07 — multi-field tenant-scoped customer search (RED until src/lib/customers.ts exists).
 *
 * Contract: searchCustomers(orgId, q) matches q against name/phone/email/address
 * and returns {id, name, primaryAddress}[]. Results never include a customer from
 * a different tenant.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

const searchStore = new Map<
  string,
  Array<{ id: string; name: string; primaryAddress: string }
>
>()

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
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => makeProxy(searchStore.get(orgId) ?? [])),
      and: vi.fn(() => ({} as never)),
      eq: vi.fn(() => ({} as never)),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { searchCustomers } from '@/lib/customers'

describe('searchCustomers', () => {
  it('is exported and callable', async () => {
    const result = await searchCustomers(ORG_A, 'smith')
    expect(Array.isArray(result)).toBe(true)
  })

  it('never returns a customer from a different tenant', async () => {
    searchStore.set(ORG_B, [
      { id: 'cust_b', name: 'Smith Co', primaryAddress: '456 Oak St' },
    ])
    searchStore.set(ORG_A, [
      { id: 'cust_a', name: 'Acme Corp', primaryAddress: '123 Main St' },
    ])

    const results = await searchCustomers(ORG_A, 'smith')
    expect(results.some((r: { id: string }) => r.id === 'cust_b')).toBe(false)
  })
})
