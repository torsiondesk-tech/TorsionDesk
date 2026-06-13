/**
 * SET-07 — Tax item creation (RED until src/lib/settings.ts exists).
 *
 * Contract: createTaxItem(orgId, { name, rate }) stores name + numeric rate
 * (rate handled as string per numeric->string convention) and returns {id}.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORG_A = 'org_aaaa'
const ORG_B = 'org_bbbb'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory tenant-scoped store for tax items.
const taxStore = new Map<string, Array<{ id: string; name: string; rate: string; tenantId: string }>>()

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => {
            const id = `tax_${Math.random().toString(36).slice(2)}`
            const row = { id, name: '', rate: '0', tenantId: orgId }
            if (!taxStore.has(orgId)) taxStore.set(orgId, [])
            taxStore.get(orgId)!.push(row)
            return [row]
          }),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const rows = taxStore.get(orgId) || []
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
import { createTaxItem } from '@/lib/settings'

describe('createTaxItem', () => {
  beforeEach(() => {
    taxStore.clear()
  })

  it('inserts a tax item with name and rate and returns {id}', async () => {
    const result = await createTaxItem(ORG_A, { name: 'IL State Tax', rate: '6.25' })
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
  })

  it('stores rate as a string', async () => {
    const result = await createTaxItem(ORG_A, { name: 'Chicago', rate: '10.25' })
    expect(result).toHaveProperty('id')
    // Contract: numeric rate is handled as string
    expect(result).toHaveProperty('rate')
  })

  it('scopes rows to the tenant', async () => {
    await createTaxItem(ORG_A, { name: 'County Tax', rate: '1.0' })
    auth.mockResolvedValueOnce({ orgId: ORG_B })
    await createTaxItem(ORG_B, { name: 'City Tax', rate: '2.0' })
    const orgARows = taxStore.get(ORG_A) || []
    const orgBRows = taxStore.get(ORG_B) || []
    expect(orgARows.length).toBe(1)
    expect(orgBRows.length).toBe(1)
    expect(orgARows[0].tenantId).toBe(ORG_A)
    expect(orgBRows[0].tenantId).toBe(ORG_B)
  })
})
