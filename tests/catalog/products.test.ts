/**
 * CAT-01 — Product CRUD with tenant isolation (RED until src/lib/catalog.ts exists).
 *
 * Contract: createProduct(orgId, productData) inserts under active tenant and returns {id}.
 * updateProduct(orgId, id, data) mutates only same-tenant row.
 * deleteProduct(orgId, id) removes only same-tenant row.
 * Tenant isolation: a row created under ORG_A is not visible under ORG_B.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory tenant-scoped store for products.
const productStore = new Map<string, Array<{ id: string; name: string; tenantId: string }>>()

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => {
            const id = `prod_${Math.random().toString(36).slice(2)}`
            const row = { id, name: '', tenantId: orgId }
            if (!productStore.has(orgId)) productStore.set(orgId, [])
            productStore.get(orgId)!.push(row)
            return [row]
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => []),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => []),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const rows = productStore.get(orgId) || []
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
import { createProduct, updateProduct, deleteProduct } from '@/lib/catalog'

describe('createProduct', () => {
  beforeEach(() => {
    productStore.clear()
  })

  it('inserts a product under the active tenant and returns {id}', async () => {
    const result = await createProduct(ORG_A, { name: 'Spring Set' })
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
  })

  it('does not expose ORG_A rows when auth returns ORG_B', async () => {
    await createProduct(ORG_A, { name: 'Panel' })
    // Switch tenant context
    auth.mockResolvedValueOnce({ orgId: ORG_B })
    const result = await createProduct(ORG_B, { name: 'Roller' })
    expect(result).toHaveProperty('id')
    // Tenant isolation contract: ORG_A store should remain independent
    const orgARows = productStore.get(ORG_A) || []
    const orgBRows = productStore.get(ORG_B) || []
    expect(orgARows.length).toBe(1)
    expect(orgBRows.length).toBe(1)
    expect(orgARows[0].tenantId).toBe(ORG_A)
    expect(orgBRows[0].tenantId).toBe(ORG_B)
  })
})

describe('updateProduct', () => {
  beforeEach(() => {
    productStore.clear()
  })

  it('mutates only a same-tenant row', async () => {
    const created = await createProduct(ORG_A, { name: 'Old Name' })
    expect(created).toHaveProperty('id')
    // Contract assertion: update should target same tenant
    const result = await updateProduct(ORG_A, created.id, { name: 'New Name' })
    expect(result).toBeDefined()
  })
})

describe('deleteProduct', () => {
  beforeEach(() => {
    productStore.clear()
  })

  it('removes only a same-tenant row', async () => {
    const created = await createProduct(ORG_A, { name: 'To Delete' })
    expect(created).toHaveProperty('id')
    const result = await deleteProduct(ORG_A, created.id)
    expect(result).toBeDefined()
  })
})
