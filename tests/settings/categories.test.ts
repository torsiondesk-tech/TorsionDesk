/**
 * SET-01 — Hierarchical job category creation (RED until src/lib/categories.ts exists).
 *
 * Contract: createJobCategory(orgId, { name, parentId? }) inserts under active tenant,
 * accepts an optional parentId, and returns {id}.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory tenant-scoped store for categories.
const categoryStore = new Map<string, Array<{ id: string; name: string; parentId?: string | null; tenantId: string }>>()

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => {
              const id = `cat_${Math.random().toString(36).slice(2)}`
              const row = { id, name: '', parentId: null, tenantId: orgId }
              if (!categoryStore.has(orgId)) categoryStore.set(orgId, [])
              categoryStore.get(orgId)!.push(row)
              return [row]
            }),
          })),
          returning: vi.fn(async () => [{ id: `cat_${Math.random().toString(36).slice(2)}`, name: '' }]),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const rows = categoryStore.get(orgId) || []
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
import { createJobCategory } from '@/lib/categories'

describe('createJobCategory', () => {
  beforeEach(() => {
    categoryStore.clear()
  })

  it('inserts a category under the active tenant and returns {id}', async () => {
    const result = await createJobCategory(ORG_A, { name: 'Residential' })
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
  })

  it('accepts an optional parentId', async () => {
    const parent = await createJobCategory(ORG_A, { name: 'Commercial' })
    expect(parent).toHaveProperty('id')
    const child = await createJobCategory(ORG_A, { name: 'New Door', parentId: parent.id })
    expect(child).toHaveProperty('id')
  })

  it('scopes rows to the tenant', async () => {
    await createJobCategory(ORG_A, { name: 'Repair' })
    auth.mockResolvedValueOnce({ orgId: ORG_B })
    await createJobCategory(ORG_B, { name: 'Service' })
    const orgARows = categoryStore.get(ORG_A) || []
    const orgBRows = categoryStore.get(ORG_B) || []
    expect(orgARows.length).toBe(1)
    expect(orgBRows.length).toBe(1)
    expect(orgARows[0].tenantId).toBe(ORG_A)
    expect(orgBRows[0].tenantId).toBe(ORG_B)
  })
})
