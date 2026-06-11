/**
 * AUTH-01 / D-02 — Clerk `organization.created` webhook → `tenants` insert (RED).
 *
 * Contract (RESEARCH Pattern 6):
 *   A verified `organization.created` event (data.id = 'org_xxx') triggers EXACTLY ONE
 *   `tenants` insert keyed on id = 'org_xxx'. Replaying the SAME event id must NOT
 *   create a duplicate (idempotency, threat T-00-03). The signature is verified via
 *   verifyWebhook() before any DB write (threat: forged webhook → fake provisioning).
 *
 * We import a testable `handleClerkWebhook` helper that the route module
 * (@/app/api/webhooks/clerk/route) is expected to export, and mock both the
 * signature verification and the DB insert so this is a pure unit test.
 *
 * RED state: @/app/api/webhooks/clerk/route does not exist yet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Clerk webhook verifier so the handler treats our payload as verified.
const verifyWebhook = vi.fn()
vi.mock('@clerk/nextjs/webhooks', () => ({
  verifyWebhook: (...args: unknown[]) => verifyWebhook(...args),
}))

// Mock the DB layer the handler uses to provision tenants. The handler is
// expected to insert idempotently (onConflictDoNothing on the org id PK).
const insertedIds: string[] = []
vi.mock('@/db/provision-tenant', () => ({
  // provisionTenant(orgId) inserts a tenants row idempotently and reports whether
  // a new row was actually created.
  provisionTenant: vi.fn(async (orgId: string) => {
    if (insertedIds.includes(orgId)) return { created: false }
    insertedIds.push(orgId)
    return { created: true }
  }),
}))

// Not-yet-existing module under test — resolution failure is the Wave 0 RED signal.
import { handleClerkWebhook } from '@/app/api/webhooks/clerk/route'

function makeRequest(): Request {
  return new Request('https://app.test/api/webhooks/clerk', {
    method: 'POST',
    body: '{}',
    headers: { 'content-type': 'application/json' },
  })
}

describe('Clerk organization.created webhook (AUTH-01 / D-02)', () => {
  beforeEach(() => {
    insertedIds.length = 0
    verifyWebhook.mockReset()
  })

  it('inserts exactly one tenants row for an organization.created event', async () => {
    verifyWebhook.mockResolvedValue({
      type: 'organization.created',
      data: { id: 'org_xxx' },
    })

    const res = await handleClerkWebhook(makeRequest())

    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(300)
    expect(insertedIds).toEqual(['org_xxx'])
  })

  it('is idempotent: replaying the same event id does not duplicate the tenant', async () => {
    verifyWebhook.mockResolvedValue({
      type: 'organization.created',
      data: { id: 'org_xxx' },
    })

    await handleClerkWebhook(makeRequest())
    await handleClerkWebhook(makeRequest())

    // Still exactly one row for org_xxx after the replay (T-00-03).
    expect(insertedIds).toEqual(['org_xxx'])
  })
})
