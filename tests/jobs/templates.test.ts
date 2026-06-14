/**
 * JOB-07 — applyJobTemplate copies line items + tasks.
 *
 * Contract: applyJobTemplate(orgId, templateId) returns a structure
 * containing the copied line items and tasks from the template, ready to be
 * inserted alongside a new job.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_aaaa'

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

// Track which query is being executed by counting select() calls.
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
        // First query: job_templates header
        if (!currentTemplateId) return []
        const tmpl = templateStore.get(currentTemplateId)
        if (!tmpl) return []
        if (tmpl.tenantId !== ORG_A) return []
        return [{ id: currentTemplateId, tenantId: tmpl.tenantId, name: tmpl.name }]
      }
      return []
    })

    const mockOrderBy = vi.fn(() => ({
      then: vi.fn(async (cb: (rows: unknown[]) => unknown) => {
        if (!currentTemplateId) return cb([])
        const tmpl = templateStore.get(currentTemplateId)
        if (!tmpl) return cb([])

        if (myCallNumber === 2) {
          // Second query: job_template_line_items
          return cb(
            tmpl.lineItems.map((li) => ({
              id: `li_${li.description}`,
              tenantId: tmpl.tenantId,
              templateId: currentTemplateId,
              type: li.type,
              refId: null,
              description: li.description,
              qty: li.qty,
              rate: li.rate,
              cost: li.cost,
              taxItemId: null,
              sortOrder: 0,
            })),
          )
        }

        if (myCallNumber === 3) {
          // Third query: job_template_tasks
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

  return { select: selectMock }
}

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    resetMocks()
    const tx = buildMockTx()
    return fn(tx)
  }),
}))

import { applyJobTemplate } from '@/lib/job-templates'

describe('applyJobTemplate', () => {
  it('copies template line items into the result', async () => {
    const result = await applyJobTemplate(ORG_A, 'tmpl_1')

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
    const result = await applyJobTemplate(ORG_A, 'tmpl_1')

    expect(result.tasks).toBeDefined()
    expect(Array.isArray(result.tasks)).toBe(true)
    expect(result.tasks.length).toBe(1)

    const task = result.tasks[0]
    expect(task.label).toBe('Inspect cables')
  })

  it('does not return items from a cross-tenant template', async () => {
    templateStore.set('tmpl_2', {
      tenantId: 'org_bbbb',
      name: 'Other Tenant Template',
      lineItems: [{ type: 'product', description: 'X', qty: '1', rate: '1.00', cost: '0.50', taxRate: null }],
      tasks: [],
    })

    currentTemplateId = 'tmpl_2'
    await expect(applyJobTemplate(ORG_A, 'tmpl_2')).rejects.toThrow(/not found|cross-tenant|tenant/i)
  })
})
