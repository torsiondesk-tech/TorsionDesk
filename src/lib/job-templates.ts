import { eq, and, desc, sql } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  jobTemplates,
  jobTemplateLineItems,
  jobTemplateTasks,
  jobCategories,
} from '@/db/schema'

export interface TemplateRow {
  id: string
  name: string
  categoryId: string | null
  categoryName: string | null
  description: string | null
  createdAt: Date | null
}

export interface TemplateLineItem {
  id?: string
  type: 'product' | 'service' | 'discount' | 'expense'
  refId: string | null
  description: string
  qty: string
  rate: string
  cost: string
  taxItemId: string | null
}

export interface TemplateTask {
  id?: string
  label: string
}

export interface TemplateDetail {
  id: string
  name: string
  categoryId: string | null
  description: string | null
  lineItems: TemplateLineItem[]
  tasks: TemplateTask[]
}

export async function listJobTemplates(
  orgId: string,
): Promise<TemplateRow[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: jobTemplates.id,
        name: jobTemplates.name,
        categoryId: jobTemplates.categoryId,
        categoryName: jobCategories.name,
        description: jobTemplates.description,
        createdAt: jobTemplates.createdAt,
      })
      .from(jobTemplates)
      .leftJoin(jobCategories, eq(jobTemplates.categoryId, jobCategories.id))
      .where(eq(jobTemplates.tenantId, orgId))
      .orderBy(desc(jobTemplates.createdAt))

    return rows as TemplateRow[]
  })
}

export async function getJobTemplate(
  orgId: string,
  id: string,
): Promise<TemplateDetail | null> {
  return withTenant(orgId, async (tx) => {
    const tmplRows = await tx
      .select()
      .from(jobTemplates)
      .where(and(eq(jobTemplates.tenantId, orgId), eq(jobTemplates.id, id)))
      .limit(1)

    const tmpl = tmplRows[0]
    if (!tmpl) return null

    const [lineItems, tasks] = await Promise.all([
      tx
        .select()
        .from(jobTemplateLineItems)
        .where(
          and(
            eq(jobTemplateLineItems.tenantId, orgId),
            eq(jobTemplateLineItems.templateId, id),
          ),
        )
        .orderBy(jobTemplateLineItems.sortOrder),
      tx
        .select()
        .from(jobTemplateTasks)
        .where(
          and(
            eq(jobTemplateTasks.tenantId, orgId),
            eq(jobTemplateTasks.templateId, id),
          ),
        )
        .orderBy(jobTemplateTasks.sortOrder),
    ])

    return {
      id: tmpl.id,
      name: tmpl.name,
      categoryId: tmpl.categoryId,
      description: tmpl.description,
      lineItems: lineItems.map((li) => ({
        id: li.id,
        type: (li.type ?? 'product') as TemplateLineItem['type'],
        refId: li.refId ?? null,
        description: li.description ?? '',
        qty: String(li.qty ?? '1'),
        rate: String(li.rate ?? '0'),
        cost: String(li.cost ?? '0'),
        taxItemId: li.taxItemId ?? null,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        label: t.label ?? '',
      })),
    }
  })
}

export async function createJobTemplate(
  orgId: string,
  input: {
    name: string
    categoryId?: string | null
    description?: string | null
    lineItems: Omit<TemplateLineItem, 'id'>[]
    tasks: Omit<TemplateTask, 'id'>[]
  },
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .insert(jobTemplates)
      .values({
        tenantId: orgId,
        name: input.name,
        categoryId: input.categoryId ?? null,
        description: input.description ?? null,
      })
      .returning({ id: jobTemplates.id })

    const templateId = row.id

    if (input.lineItems.length > 0) {
      await tx.insert(jobTemplateLineItems).values(
        input.lineItems.map((item, i) => ({
          tenantId: orgId,
          templateId,
          type: item.type,
          refId: item.refId ?? null,
          description: item.description,
          qty: item.qty,
          rate: item.rate,
          cost: item.cost,
          taxItemId: item.taxItemId ?? null,
          sortOrder: i,
        })),
      )
    }

    if (input.tasks.length > 0) {
      await tx.insert(jobTemplateTasks).values(
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

export async function updateJobTemplate(
  orgId: string,
  id: string,
  input: {
    name: string
    categoryId?: string | null
    description?: string | null
    lineItems: Omit<TemplateLineItem, 'id'>[]
    tasks: Omit<TemplateTask, 'id'>[]
  },
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(jobTemplates)
      .set({
        name: input.name,
        categoryId: input.categoryId ?? null,
        description: input.description ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(jobTemplates.tenantId, orgId), eq(jobTemplates.id, id)))

    // Replace line items
    await tx
      .delete(jobTemplateLineItems)
      .where(
        and(
          eq(jobTemplateLineItems.tenantId, orgId),
          eq(jobTemplateLineItems.templateId, id),
        ),
      )

    if (input.lineItems.length > 0) {
      await tx.insert(jobTemplateLineItems).values(
        input.lineItems.map((item, i) => ({
          tenantId: orgId,
          templateId: id,
          type: item.type,
          refId: item.refId ?? null,
          description: item.description,
          qty: item.qty,
          rate: item.rate,
          cost: item.cost,
          taxItemId: item.taxItemId ?? null,
          sortOrder: i,
        })),
      )
    }

    // Replace tasks
    await tx
      .delete(jobTemplateTasks)
      .where(
        and(
          eq(jobTemplateTasks.tenantId, orgId),
          eq(jobTemplateTasks.templateId, id),
        ),
      )

    if (input.tasks.length > 0) {
      await tx.insert(jobTemplateTasks).values(
        input.tasks.map((task, i) => ({
          tenantId: orgId,
          templateId: id,
          label: task.label,
          sortOrder: i,
        })),
      )
    }
  })
}

export async function deleteJobTemplate(
  orgId: string,
  id: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(jobTemplates)
      .where(and(eq(jobTemplates.tenantId, orgId), eq(jobTemplates.id, id)))
  })
}

export async function applyJobTemplate(
  orgId: string,
  templateId: string,
): Promise<{ lineItems: TemplateLineItem[]; tasks: TemplateTask[] }> {
  return withTenant(orgId, async (tx) => {
    const tmplRows = await tx
      .select()
      .from(jobTemplates)
      .where(
        and(
          eq(jobTemplates.tenantId, orgId),
          eq(jobTemplates.id, templateId),
        ),
      )
      .limit(1)

    const tmpl = tmplRows[0]
    if (!tmpl) {
      throw new Error('Template not found or cross-tenant access denied')
    }

    const [lineItems, tasks] = await Promise.all([
      tx
        .select()
        .from(jobTemplateLineItems)
        .where(
          and(
            eq(jobTemplateLineItems.tenantId, orgId),
            eq(jobTemplateLineItems.templateId, templateId),
          ),
        )
        .orderBy(jobTemplateLineItems.sortOrder),
      tx
        .select()
        .from(jobTemplateTasks)
        .where(
          and(
            eq(jobTemplateTasks.tenantId, orgId),
            eq(jobTemplateTasks.templateId, templateId),
          ),
        )
        .orderBy(jobTemplateTasks.sortOrder),
    ])

    return {
      lineItems: lineItems.map((li) => ({
        id: li.id,
        type: (li.type ?? 'product') as TemplateLineItem['type'],
        refId: li.refId ?? null,
        description: li.description ?? '',
        qty: String(li.qty ?? '1'),
        rate: String(li.rate ?? '0'),
        cost: String(li.cost ?? '0'),
        taxItemId: li.taxItemId ?? null,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        label: t.label ?? '',
      })),
    }
  })
}
