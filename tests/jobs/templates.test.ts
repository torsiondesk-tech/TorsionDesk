/**
 * JOB-07 — applyJobTemplate copies line items + tasks (RED until
 * src/lib/job-templates.ts exists).
 *
 * Contract: applyJobTemplate(tx, tenantId, templateId) returns a structure
 * containing the copied line items and tasks from the template, ready to be
 * inserted alongside a new job.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_aaaa'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory template store.
const templateStore = new Map<
  string,
  {
    tenantId: string
    name: string
    lineItems: Array<{
      type: string
      description: string
      qty: string
      rate: string
      cost: string | null
      taxRate: string | null
    }>
    tasks: Array<{ description: string; completed: boolean }>
  }
>()

templateStore.set('tmpl_1', {
  tenantId: ORG_A,
  name: 'Spring Replacement',
  lineItems: [
    {
      type: 'product',
      description: 'Torsion Spring',
      qty: '2',
      rate: '149.99',
      cost: '75.00',
      taxRate: null,
    },
    {
      type: 'service',
      description: 'Labor — Install',
      qty: '1',
      rate: '89.00',
      cost: '0',
      taxRate: null,
    },
  ],
  tasks: [{ description: 'Inspect cables', completed: false }],
})

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const tmpl = templateStore.get('tmpl_1')
              return tmpl ? [{ id: 'tmpl_1', tenantId: tmpl.tenantId, name: tmpl.name }] : []
            }),
          })),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { applyJobTemplate } from '@/lib/job-templates'

describe('applyJobTemplate', () => {
  it('copies template line items into the result', async () => {
    const result = await applyJobTemplate('tmpl_1')

    expect(result).toBeDefined()
    expect(result.lineItems).toBeDefined()
    expect(Array.isArray(result.lineItems)).toBe(true)
    expect(result.lineItems.length).toBe(2)

    const product = result.lineItems.find((li: any) => li.type === 'product')
    expect(product).toBeDefined()
    expect(product.description).toBe('Torsion Spring')
    expect(product.qty).toBe('2')
    expect(product.rate).toBe('149.99')
  })

  it('copies template tasks into the result', async () => {
    const result = await applyJobTemplate('tmpl_1')

    expect(result.tasks).toBeDefined()
    expect(Array.isArray(result.tasks)).toBe(true)
    expect(result.tasks.length).toBe(1)

    const task = result.tasks[0]
    expect(task.description).toBe('Inspect cables')
    expect(task.completed).toBe(false)
  })

  it('does not return items from a cross-tenant template', async () => {
    templateStore.set('tmpl_2', {
      tenantId: 'org_bbbb',
      name: 'Other Tenant Template',
      lineItems: [{ type: 'product', description: 'X', qty: '1', rate: '1.00', cost: '0.50', taxRate: null }],
      tasks: [],
    })

    await expect(applyJobTemplate('tmpl_2')).rejects.toThrow(/not found|cross-tenant|tenant/i)
  })
})
