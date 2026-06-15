'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import {
  createJobTemplate,
  updateJobTemplate,
  deleteJobTemplate,
} from '@/lib/job-templates'

export type TemplateActionState = {
  error?: string
  success?: boolean
  id?: string
}

const templateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  categoryId: z.string().nullable().optional(),
  description: z.string().trim().optional(),
  lineItemsJson: z.string().default('[]'),
  tasksJson: z.string().default('[]'),
})

const updateSchema = templateSchema.extend({
  id: z.string().min(1),
})

export async function createTemplateAction(
  _prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = templateSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    lineItemsJson: formData.get('lineItemsJson'),
    tasksJson: formData.get('tasksJson'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  let lineItems: Array<{
    type: 'product' | 'service' | 'discount' | 'expense'
    refId?: string | null
    title?: string | null
    description: string
    qty?: string
    rate?: string
    cost?: string
    taxItemId?: string | null
  }> = []
  let tasks: Array<{ label: string }> = []

  try {
    const rawLi = JSON.parse(parsed.data.lineItemsJson)
    if (Array.isArray(rawLi)) lineItems = rawLi
  } catch {
    // ignore malformed JSON
  }

  try {
    const rawTasks = JSON.parse(parsed.data.tasksJson)
    if (Array.isArray(rawTasks)) tasks = rawTasks
  } catch {
    // ignore malformed JSON
  }

  try {
    const result = await createJobTemplate(orgId, {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      lineItems: lineItems.map((li) => ({
        type: li.type,
        refId: li.refId ?? null,
        title: li.title ?? null,
        description: li.description,
        qty: li.qty ?? '1',
        rate: li.rate ?? '0',
        cost: li.cost ?? '0',
        taxItemId: li.taxItemId ?? null,
      })),
      tasks: tasks.map((t) => ({ label: t.label })),
    })
    revalidatePath('/settings/templates')
    return { success: true, id: result.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create template.'
    return { error: message }
  }
}

export async function updateTemplateAction(
  _prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    lineItemsJson: formData.get('lineItemsJson'),
    tasksJson: formData.get('tasksJson'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  let lineItems: Array<{
    type: 'product' | 'service' | 'discount' | 'expense'
    refId?: string | null
    title?: string | null
    description: string
    qty?: string
    rate?: string
    cost?: string
    taxItemId?: string | null
  }> = []
  let tasks: Array<{ label: string }> = []

  try {
    const rawLi = JSON.parse(parsed.data.lineItemsJson)
    if (Array.isArray(rawLi)) lineItems = rawLi
  } catch {
    // ignore malformed JSON
  }

  try {
    const rawTasks = JSON.parse(parsed.data.tasksJson)
    if (Array.isArray(rawTasks)) tasks = rawTasks
  } catch {
    // ignore malformed JSON
  }

  try {
    await updateJobTemplate(orgId, parsed.data.id, {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      lineItems: lineItems.map((li) => ({
        type: li.type,
        refId: li.refId ?? null,
        title: li.title ?? null,
        description: li.description,
        qty: li.qty ?? '1',
        rate: li.rate ?? '0',
        cost: li.cost ?? '0',
        taxItemId: li.taxItemId ?? null,
      })),
      tasks: tasks.map((t) => ({ label: t.label })),
    })
    revalidatePath('/settings/templates')
    return { success: true, id: parsed.data.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update template.'
    return { error: message }
  }
}

export async function deleteTemplateAction(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await deleteJobTemplate(orgId, id)
    revalidatePath('/settings/templates')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete template.'
    return { error: message }
  }
}
