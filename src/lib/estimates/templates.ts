import { eq, and, desc } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  estimateTemplates,
  estimateTemplateLineItems,
  estimateTemplateTasks,
} from '@/db/schema'

export interface TemplateLineItemInput {
  type: 'product' | 'service' | 'discount' | 'expense'
  refId?: string | null
  title?: string | null
  description: string
  qty?: string
  rate?: string
  cost?: string
  taxItemId?: string | null
  groupName?: string | null
}

export interface TemplateTaskInput {
  label: string
}

export interface EstimateTemplate {
  id: string
  tenantId: string
  name: string
  description: string | null
  lineItems: EstimateTemplateLineItem[]
  tasks: EstimateTemplateTask[]
  createdAt: Date | null
  updatedAt: Date | null
}

export interface EstimateTemplateLineItem {
  id: string
  tenantId: string
  templateId: string
  groupName: string | null
  type: string | null
  refId: string | null
  title: string | null
  description: string | null
  qty: string | null
  rate: string | null
  cost: string | null
  taxItemId: string | null
  sortOrder: number | null
}

export interface EstimateTemplateTask {
  id: string
  tenantId: string
  templateId: string
  label: string | null
  sortOrder: number | null
}

export interface AppliedLineItem {
  id: string
  type: 'product' | 'service' | 'discount' | 'expense'
  refId: string | null
  title: string | null
  description: string
  qty: string
  rate: string
  cost: string
  taxItemId: string | null
  groupId: string | null
  groupName: string | null
  sortOrder: number
}

export interface AppliedTask {
  id: string
  label: string | null
  done: boolean
  sortOrder: number
}

export interface AppliedGroup {
  id: string
  name: string
  sortOrder: number
}

export async function listEstimateTemplates(orgId: string): Promise<EstimateTemplate[]> {
  return withTenant(orgId, async (tx) => {
    const templates = await tx
      .select()
      .from(estimateTemplates)
      .where(eq(estimateTemplates.tenantId, orgId))
      .orderBy(desc(estimateTemplates.createdAt))

    const [lineItems, tasks] = await Promise.all([
      tx
        .select()
        .from(estimateTemplateLineItems)
        .where(eq(estimateTemplateLineItems.tenantId, orgId))
        .orderBy(estimateTemplateLineItems.sortOrder),
      tx
        .select()
        .from(estimateTemplateTasks)
        .where(eq(estimateTemplateTasks.tenantId, orgId))
        .orderBy(estimateTemplateTasks.sortOrder),
    ])

    return templates.map((t) => ({
      ...t,
      lineItems: lineItems.filter((li) => li.templateId === t.id),
      tasks: tasks.filter((task) => task.templateId === t.id),
    }))
  })
}

export async function createEstimateTemplate(
  orgId: string,
  input: {
    name: string
    description?: string
    lineItems: TemplateLineItemInput[]
    tasks: TemplateTaskInput[]
  },
): Promise<{ id: string; error?: string }> {
  return withTenant(orgId, async (tx) => {
    const [template] = await tx
      .insert(estimateTemplates)
      .values({
        tenantId: orgId,
        name: input.name,
        description: input.description ?? null,
      })
      .returning({ id: estimateTemplates.id })

    const templateId = template.id

    if (input.lineItems.length > 0) {
      await tx.insert(estimateTemplateLineItems).values(
        input.lineItems.map((item, i) => ({
          tenantId: orgId,
          templateId,
          groupName: item.groupName ?? null,
          type: item.type,
          refId: item.refId ?? null,
          title: item.title ?? null,
          description: item.description,
          qty: item.qty ?? '1',
          rate: item.rate ?? '0',
          cost: item.cost ?? '0',
          taxItemId: item.taxItemId ?? null,
          sortOrder: i,
        })),
      )
    }

    if (input.tasks.length > 0) {
      await tx.insert(estimateTemplateTasks).values(
        input.tasks.map((task, i) => ({
          tenantId: orgId,
          templateId,
          label: task.label,
          sortOrder: i,
        })),
      )
    }

    return { id: templateId }
  })
}

export async function updateEstimateTemplate(
  orgId: string,
  templateId: string,
  input: {
    name: string
    description?: string
    lineItems: TemplateLineItemInput[]
    tasks: TemplateTaskInput[]
  },
): Promise<{ id: string; error?: string }> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({ id: estimateTemplates.id })
      .from(estimateTemplates)
      .where(and(eq(estimateTemplates.tenantId, orgId), eq(estimateTemplates.id, templateId)))
      .limit(1)
    if (!rows[0]) throw new Error('Template not found or access denied')

    await tx
      .update(estimateTemplates)
      .set({ name: input.name, description: input.description ?? null, updatedAt: new Date() })
      .where(and(eq(estimateTemplates.tenantId, orgId), eq(estimateTemplates.id, templateId)))

    await tx
      .delete(estimateTemplateLineItems)
      .where(and(eq(estimateTemplateLineItems.tenantId, orgId), eq(estimateTemplateLineItems.templateId, templateId)))
    await tx
      .delete(estimateTemplateTasks)
      .where(and(eq(estimateTemplateTasks.tenantId, orgId), eq(estimateTemplateTasks.templateId, templateId)))

    if (input.lineItems.length > 0) {
      await tx.insert(estimateTemplateLineItems).values(
        input.lineItems.map((item, i) => ({
          tenantId: orgId,
          templateId,
          groupName: item.groupName ?? null,
          type: item.type,
          refId: item.refId ?? null,
          title: item.title ?? null,
          description: item.description,
          qty: item.qty ?? '1',
          rate: item.rate ?? '0',
          cost: item.cost ?? '0',
          taxItemId: item.taxItemId ?? null,
          sortOrder: i,
        })),
      )
    }

    if (input.tasks.length > 0) {
      await tx.insert(estimateTemplateTasks).values(
        input.tasks.map((task, i) => ({
          tenantId: orgId,
          templateId,
          label: task.label,
          sortOrder: i,
        })),
      )
    }

    return { id: templateId }
  })
}

export async function deleteEstimateTemplate(
  orgId: string,
  templateId: string,
): Promise<{ success?: boolean; error?: string }> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(estimateTemplates)
      .where(and(eq(estimateTemplates.tenantId, orgId), eq(estimateTemplates.id, templateId)))
    return { success: true }
  })
}

export async function applyEstimateTemplate(
  orgId: string,
  templateId: string,
): Promise<{ lineItems: AppliedLineItem[]; tasks: AppliedTask[]; groups: AppliedGroup[] }> {
  return withTenant(orgId, async (tx) => {
    const templateRows = await tx
      .select()
      .from(estimateTemplates)
      .where(and(eq(estimateTemplates.tenantId, orgId), eq(estimateTemplates.id, templateId)))
      .limit(1)
    if (!templateRows[0]) throw new Error('Template not found or cross-tenant access denied')

    const lineItemRows = await tx
      .select()
      .from(estimateTemplateLineItems)
      .where(and(eq(estimateTemplateLineItems.tenantId, orgId), eq(estimateTemplateLineItems.templateId, templateId)))
      .orderBy(estimateTemplateLineItems.sortOrder)

    const taskRows = await tx
      .select()
      .from(estimateTemplateTasks)
      .where(and(eq(estimateTemplateTasks.tenantId, orgId), eq(estimateTemplateTasks.templateId, templateId)))
      .orderBy(estimateTemplateTasks.sortOrder)

    // Derive groups from unique groupName values in template line items.
    const groupNames = Array.from(new Set(lineItemRows.map((li) => li.groupName).filter((g): g is string => !!g)))
    const groups: AppliedGroup[] = groupNames.map((name, i) => ({
      id: `group_${i}`,
      name,
      sortOrder: i,
    }))

    const lineItems: AppliedLineItem[] = lineItemRows.map((li, i) => {
      const group = groups.find((g) => g.name === li.groupName)
      return {
        id: `applied_${i}`,
        type: (li.type as AppliedLineItem['type']) ?? 'service',
        refId: li.refId,
        title: li.title,
        description: li.description ?? '',
        qty: li.qty ?? '1',
        rate: li.rate ?? '0',
        cost: li.cost ?? '0',
        taxItemId: li.taxItemId,
        groupId: group?.id ?? null,
        groupName: li.groupName,
        sortOrder: i,
      }
    })

    const tasks: AppliedTask[] = taskRows.map((t, i) => ({
      id: `applied_task_${i}`,
      label: t.label,
      done: false,
      sortOrder: i,
    }))

    return { lineItems, tasks, groups }
  })
}
