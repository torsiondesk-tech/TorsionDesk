/**
 * CAT-02 — Service creation with tenant isolation (RED until src/lib/catalog.ts exists).
 *
 * Contract: createService(orgId, serviceData) inserts under active tenant and returns {id}.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory tenant-scoped store for services.
const serviceStore = new Map<string, Array<{ id: string; name: string; tenantId: string }>>()

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => {
            const id = `svc_${Math.random().toString(36).slice(2)}`
            const row = { id, name: '', tenantId: orgId }
            if (!serviceStore.has(orgId)) serviceStore.set(orgId, [])
            serviceStore.get(orgId)!.push(row)
            return [row]
          }),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const rows = serviceStore.get(orgId) || []
              return rows.slice(0, 1)
            }),
          })),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { createService } from '@/lib/catalog'

describe('createService', () => {
  beforeEach(() => {
    serviceStore.clear()
  })

  it('inserts a service under the active tenant and returns {id}', async () => {
    const result = await createService(ORG_A, { name: 'Tune Up' })
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
  })

  it('scopes rows to the tenant', async () => {
    await createService(ORG_A, { name: 'Spring Replacement' })
    auth.mockResolvedValueOnce({ orgId: ORG_B })
    await createService(ORG_B, { name: 'Panel Install' })
    const orgARows = serviceStore.get(ORG_A) || []
    const orgBRows = serviceStore.get(ORG_B) || []
    expect(orgARows.length).toBe(1)
    expect(orgBRows.length).toBe(1)
    expect(orgARows[0].tenantId).toBe(ORG_A)
    expect(orgBRows[0].tenantId).toBe(ORG_B)
  })
})
