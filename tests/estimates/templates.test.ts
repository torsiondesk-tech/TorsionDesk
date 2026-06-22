/**
 * EST-06 — createEstimateTemplate / applyEstimateTemplate round-trip
 * (RED until src/lib/estimates/templates.ts exists).
 *
 * Contract:
 *   1. createEstimateTemplate persists a template with line items and tasks.
 *   2. applyEstimateTemplate returns line items and tasks matching the template input,
 *      ready to merge into form state.
 *   3. Cross-tenant templates are rejected.
 */

import { describe, it, expect, vi } from 'vitest'
import { getTableName } from 'drizzle-orm'

const ORG_A = 'org_tmpl_a'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

// In-memory template store keyed by template id.
const templateStore = new Map<
  string,
  {
    tenantId: string
    name: string
    description: string | null
    lineItems: Array<{
      type: string
      title: string
      description: string
      qty: string
      rate: string
      cost: string | null
      taxRate: string | null
      groupName: string | null
    }>
    tasks: Array<{ description: string; completed: boolean }>
  }
>()

templateStore.set('tmpl_1', {
  tenantId: ORG_A,
  name: 'Spring Replacement',
  description: 'Standard spring replacement estimate',
  lineItems: [
    {
      type: 'product',
      title: 'Torsion Spring',
      description: 'Heavy-duty torsion spring replacement',
      qty: '2',
      rate: '149.99',
      cost: '75.00',
      taxRate: null,
      groupName: 'Hardware',
    },
    {
      type: 'service',
      title: 'Labor — Install',
      description: 'Professional installation service',
      qty: '1',
      rate: '89.00',
      cost: '0',
      taxRate: null,
      groupName: 'Hardware',
    },
  ],
  tasks: [{ description: 'Inspect cables', completed: false }],
})

let selectCallCount = 0
let currentTemplateId: string | null = 'tmpl_1'

function resetMocks() {
  selectCallCount = 0
}

function buildMockTx() {
  const selectMock = vi.fn(() => {
    selectCallCount++
    const myCallNumber = selectCallCount

    const mockLimit = vi.fn(async () => {
      if (myCallNumber === 1) {
        if (!currentTemplateId) return []
        const tmpl = templateStore.get(currentTemplateId)
        if (!tmpl) return []
        if (tmpl.tenantId !== ORG_A) return []
        return [{ id: currentTemplateId, tenantId: tmpl.tenantId, name: tmpl.name, description: tmpl.description }]
      }
      return []
    })

    const mockOrderBy = vi.fn(() => ({
      then: vi.fn(async (cb: (rows: unknown[]) => unknown) => {
        if (!currentTemplateId) return cb([])
        const tmpl = templateStore.get(currentTemplateId)
        if (!tmpl) return cb([])

        if (myCallNumber === 2) {
          return cb(
            tmpl.lineItems.map((li) => ({
              id: `li_${li.description}`,
              tenantId: tmpl.tenantId,
              templateId: currentTemplateId,
              type: li.type,
              refId: null,
              title: li.title,
              description: li.description,
              qty: li.qty,
              rate: li.rate,
              cost: li.cost,
              taxItemId: null,
              sortOrder: 0,
              groupName: li.groupName,
            })),
          )
        }

        if (myCallNumber === 3) {
          return cb(
            tmpl.tasks.map((t) => ({
              id: `task_${t.description}`,
              tenantId: tmpl.tenantId,
              templateId: currentTemplateId,
              label: t.description,
              sortOrder: 0,
            })),
          )
        }

        return cb([])
      }),
    }))

    return {
      from: vi.fn(() => ({
        where: vi.fn(() => {
          if (myCallNumber === 1) {
            return { limit: mockLimit }
          }
          return { orderBy: mockOrderBy }
        }),
      })),
    }
  })

  const insertMock = vi.fn((table: any) => ({
    values: vi.fn((vals: any) => ({
      returning: vi.fn(async () => {
        const tableName = getTableName(table)
        if (tableName === 'estimate_templates') {
          return [{ id: 'tmpl_new_1' }]
        }
        return []
      }),
    })),
  }))

  return { select: selectMock, insert: insertMock }
}

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    resetMocks()
    const tx = buildMockTx()
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { createEstimateTemplate, applyEstimateTemplate } from '@/lib/estimates/templates'

describe('applyEstimateTemplate', () => {
  it('copies template line items into the result', async () => {
    const result = await applyEstimateTemplate(ORG_A, 'tmpl_1')

    expect(result).toBeDefined()
    expect(result.lineItems).toBeDefined()
    expect(Array.isArray(result.lineItems)).toBe(true)
    expect(result.lineItems.length).toBe(2)

    const product = result.lineItems.find((li: any) => li.type === 'product')
    expect(product).toBeDefined()
    expect(product!.title).toBe('Torsion Spring')
    expect(product!.description).toBe('Heavy-duty torsion spring replacement')
    expect(product!.qty).toBe('2')
    expect(product!.rate).toBe('149.99')
  })

  it('copies template tasks into the result', async () => {
    const result = await applyEstimateTemplate(ORG_A, 'tmpl_1')

    expect(result.tasks).toBeDefined()
    expect(Array.isArray(result.tasks)).toBe(true)
    expect(result.tasks.length).toBe(1)

    const task = result.tasks[0]
    expect(task.label).toBe('Inspect cables')
  })

  it('does not return items from a cross-tenant template', async () => {
    templateStore.set('tmpl_2', {
      tenantId: 'org_tmpl_b',
      name: 'Other Tenant Template',
      description: null,
      lineItems: [{ type: 'product', title: 'X', description: 'X desc', qty: '1', rate: '1.00', cost: '0.50', taxRate: null, groupName: null }],
      tasks: [],
    })

    currentTemplateId = 'tmpl_2'
    await expect(applyEstimateTemplate(ORG_A, 'tmpl_2')).rejects.toThrow(/not found|cross-tenant|tenant/i)
  })
})

describe('createEstimateTemplate', () => {
  it('is importable and returns a template id shape', async () => {
    const result = await createEstimateTemplate(ORG_A, {
      name: 'New Template',
      description: 'Test',
      lineItems: [],
      tasks: [],
    })
    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
  })
})
