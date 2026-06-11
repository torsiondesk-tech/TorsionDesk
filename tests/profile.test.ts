/**
 * TENANT-02 — business-profile save/read round-trip under a single tenant (RED).
 *
 * Contract (D-11/D-12, RESEARCH Code Examples saveProfile via withTenant):
 *   saveProfile(data) writes the business profile for the active tenant, and
 *   getProfile() reads it back. Saving { companyName, phone, address, email }
 *   under tenant A and reading it back (under tenant A's GUC) must round-trip
 *   the same values.
 *
 * We back `withTenant` with an in-memory fake keyed by tenant so the round-trip
 * is exercised without a real DB, and so the test pins the "scoped to the active
 * tenant" behavior. The active org id is taken from a mocked Clerk `auth()`.
 *
 * RED state: @/lib/profile does not exist yet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'

// Mock Clerk auth() so saveProfile/getProfile resolve the active org to ORG_A.
const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory tenant-scoped store standing in for the DB behind withTenant.
const store = new Map<string, Record<string, unknown>>()
vi.mock('@/db/with-tenant', () => ({
  // withTenant(orgId, fn) hands fn a tiny tx whose reads/writes are confined to orgId.
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      saveFor: (data: Record<string, unknown>) => {
        store.set(orgId, { ...(store.get(orgId) ?? {}), ...data })
      },
      readFor: () => store.get(orgId) ?? null,
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — resolution failure is the Wave 0 RED signal.
import { saveProfile, getProfile } from '@/lib/profile'

describe('business profile round-trip (TENANT-02)', () => {
  beforeEach(() => {
    store.clear()
  })

  it('saves and reads back { companyName, phone, address, email } under the same tenant', async () => {
    const input = {
      companyName: "Infantino's Garage Door Service",
      phone: '+1-312-555-0142',
      address: '128 Asbury Ave, Chicago, IL',
      email: 'contact@infantinosgaragedoor.com',
    }

    await saveProfile(input)
    const read = await getProfile()

    expect(read).toMatchObject(input)
  })
})
