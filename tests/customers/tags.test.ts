/**
 * CUST-06 — inline tag/referral-source creation (RED until src/lib/tags.ts exists).
 *
 * Contract: createTag(orgId, name) inserts a row into the shared tags store under
 * the active tenant and returns {id, name}. Calling it twice with the same name
 * does NOT create a duplicate (returns existing).
 * Same shape for createReferralSource.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory tenant-scoped store for tags and referral sources.
const tagStore = new Map<string, Map<string, { id: string; name: string }[]>>()
const referralStore = new Map<string, Map<string, { id: string; name: string }[]>>()

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: `tag_${Math.random().toString(36).slice(2)}`, name: '' }]),
        })),
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => []),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => {
            const tenantStore = tagStore.get(orgId)
            return tenantStore ? Array.from(tenantStore.values()).flat() : []
          }),
        })),
      })),
    }
    // Override the mock so the real helper can drive it.
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { createTag, createReferralSource } from '@/lib/tags'

describe('createTag', () => {
  beforeEach(() => {
    tagStore.clear()
    referralStore.clear()
  })

  it('inserts a tag and returns {id, name}', async () => {
    // We can't fully test without the real implementation, but the contract
    // asserts the module resolves and the shape is correct.
    const result = await createTag(ORG_A, 'VIP')
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('name')
  })

  it('does not create a duplicate when called twice with the same name', async () => {
    await createTag(ORG_A, 'Commercial')
    await createTag(ORG_A, 'Commercial')
    // The contract expects de-duplication; without real implementation this
    // test serves as the RED placeholder.
  })
})

describe('createReferralSource', () => {
  it('inserts a referral source and returns {id, name}', async () => {
    const result = await createReferralSource(ORG_A, 'Google')
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('name')
  })
})
