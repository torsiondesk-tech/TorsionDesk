/**
 * SET-06 — Lookup list creation: referral sources and job sources (RED until src/lib/settings.ts exists).
 *
 * Contract: createReferralSource(orgId, name) and createJobSource(orgId, name)
 * both return {id, name}, are tenant-scoped, and dedup by name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory tenant-scoped stores for lookups.
const referralStore = new Map<string, Map<string, { id: string; name: string }>>()
const jobSourceStore = new Map<string, Map<string, { id: string; name: string }>>()

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          const name = String(vals?.name ?? '')
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => {
                const rStore = referralStore.get(orgId)
                const jStore = jobSourceStore.get(orgId)
                if (rStore?.has(name) || jStore?.has(name)) return []
                const id = `lookup_${Math.random().toString(36).slice(2)}`
                const row = { id, name }
                if (!referralStore.has(orgId)) referralStore.set(orgId, new Map())
                if (!jobSourceStore.has(orgId)) jobSourceStore.set(orgId, new Map())
                referralStore.get(orgId)!.set(name, row)
                jobSourceStore.get(orgId)!.set(name, row)
                return [row]
              }),
            })),
            returning: vi.fn(async () => {
              const rStore = referralStore.get(orgId)
              const jStore = jobSourceStore.get(orgId)
              if (rStore?.has(name) || jStore?.has(name)) return []
              const id = `lookup_${Math.random().toString(36).slice(2)}`
              const row = { id, name }
              if (!referralStore.has(orgId)) referralStore.set(orgId, new Map())
              if (!jobSourceStore.has(orgId)) jobSourceStore.set(orgId, new Map())
              referralStore.get(orgId)!.set(name, row)
              jobSourceStore.get(orgId)!.set(name, row)
              return [row]
            }),
          }
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              // Return from whichever store is being queried.
              const rRows = referralStore.get(orgId)
              const jRows = jobSourceStore.get(orgId)
              const all = [
                ...(rRows ? Array.from(rRows.values()) : []),
                ...(jRows ? Array.from(jRows.values()) : []),
              ]
              return all.slice(0, 1)
            }),
          })),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { createReferralSource, createJobSource } from '@/lib/settings'

describe('createReferralSource', () => {
  beforeEach(() => {
    referralStore.clear()
    jobSourceStore.clear()
  })

  it('inserts a referral source and returns {id, name}', async () => {
    const result = await createReferralSource(ORG_A, 'Google')
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('name')
  })

  it('dedups by name', async () => {
    const first = await createReferralSource(ORG_A, 'Yelp')
    const second = await createReferralSource(ORG_A, 'Yelp')
    expect(second.id).toBe(first.id)
  })
})

describe('createJobSource', () => {
  beforeEach(() => {
    referralStore.clear()
    jobSourceStore.clear()
  })

  it('inserts a job source and returns {id, name}', async () => {
    const result = await createJobSource(ORG_A, 'Phone Call')
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('name')
  })

  it('dedups by name', async () => {
    const first = await createJobSource(ORG_A, 'Website')
    const second = await createJobSource(ORG_A, 'Website')
    expect(second.id).toBe(first.id)
  })

  it('scopes lookups to the tenant', async () => {
    await createReferralSource(ORG_A, 'Facebook')
    auth.mockResolvedValueOnce({ orgId: ORG_B })
    await createReferralSource(ORG_B, 'Facebook')
    // Contract: same name in different tenant should be independent
    const orgARows = referralStore.get(ORG_A)
    const orgBRows = referralStore.get(ORG_B)
    expect(orgARows?.size || 0).toBeGreaterThanOrEqual(1)
    expect(orgBRows?.size || 0).toBeGreaterThanOrEqual(1)
  })
})
