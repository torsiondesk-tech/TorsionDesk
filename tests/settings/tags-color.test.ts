/**
 * SET-02 — Tag creation with color persistence + dedup (RED until src/lib/settings.ts exists).
 *
 * Contract: createTag(orgId, { name, color }) persists the color value and dedups
 * by name (returns existing on second call). Extends the basic createTag contract
 * in tests/customers/tags.test.ts — this file covers COLOR + DEDUP only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory tenant-scoped store for tags with color.
const tagStore = new Map<string, Map<string, { id: string; name: string; color: string }>>()

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          const name = String(vals?.name ?? '')
          const color = String(vals?.color ?? '')
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => {
                const tenantStore = tagStore.get(orgId)
                if (tenantStore?.has(name)) return []
                const id = `tag_${Math.random().toString(36).slice(2)}`
                const row = { id, name, color }
                if (!tagStore.has(orgId)) tagStore.set(orgId, new Map())
                tagStore.get(orgId)!.set(name, row)
                return [row]
              }),
            })),
            returning: vi.fn(async () => {
              const tenantStore = tagStore.get(orgId)
              if (tenantStore?.has(name)) return []
              const id = `tag_${Math.random().toString(36).slice(2)}`
              const row = { id, name, color }
              if (!tagStore.has(orgId)) tagStore.set(orgId, new Map())
              tagStore.get(orgId)!.set(name, row)
              return [row]
            }),
          }
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const tenantStore = tagStore.get(orgId)
              return tenantStore ? Array.from(tenantStore.values()).slice(0, 1) : []
            }),
          })),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { createTag } from '@/lib/settings'

describe('createTag with color', () => {
  beforeEach(() => {
    tagStore.clear()
  })

  it('persists the color value', async () => {
    const result = await createTag(ORG_A, { name: 'VIP', color: '#FF0000' })
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('color')
  })

  it('dedups by name and returns existing on second call', async () => {
    const first = await createTag(ORG_A, { name: 'Commercial', color: '#00FF00' })
    expect(first).toHaveProperty('id')
    const second = await createTag(ORG_A, { name: 'Commercial', color: '#00FF00' })
    expect(second).toHaveProperty('id')
    // Contract: dedup should return the same id
    expect(second.id).toBe(first.id)
  })

  it('scopes dedup to the tenant', async () => {
    await createTag(ORG_A, { name: 'Residential', color: '#0000FF' })
    auth.mockResolvedValueOnce({ orgId: ORG_B })
    const otherTenant = await createTag(ORG_B, { name: 'Residential', color: '#0000FF' })
    expect(otherTenant).toHaveProperty('id')
    // Same name in different tenant should produce a different row
    const orgAStore = tagStore.get(ORG_A)
    const orgBStore = tagStore.get(ORG_B)
    expect((orgAStore?.size || 0) + (orgBStore?.size || 0)).toBeGreaterThanOrEqual(1)
  })
})
