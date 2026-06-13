'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import {
  createTag,
  updateTag,
  deleteTag,
  getTagUsageCount,
} from '@/lib/settings'

export type TagActionState = {
  error?: string
  success?: boolean
  id?: string
  name?: string
  color?: string
  usageCount?: number
}

const PRESET_COLORS = [
  '#64748b',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const

const tagSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  color: z.enum(PRESET_COLORS, {
    message: 'Please select a preset color.',
  }),
})

const updateTagSchema = tagSchema.extend({
  id: z.string().min(1),
})

export async function createTagAction(
  _prevState: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = tagSchema.safeParse({
    name: formData.get('name'),
    color: formData.get('color'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    const result = await createTag(orgId, parsed.data)
    revalidatePath('/settings/tags')
    return { success: true, id: result.id, name: result.name, color: result.color }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not create tag.'
    return { error: message }
  }
}

export async function updateTagAction(
  _prevState: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = updateTagSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    color: formData.get('color'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { id, ...data } = parsed.data

  try {
    await updateTag(orgId, id, data)
    revalidatePath('/settings/tags')
    return { success: true, id, name: data.name, color: data.color }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not update tag.'
    return { error: message }
  }
}

export async function deleteTagAction(
  id: string,
): Promise<{ success?: boolean; error?: string; usageCount?: number }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const usageCount = await getTagUsageCount(orgId, id)
    await deleteTag(orgId, id)
    revalidatePath('/settings/tags')
    return { success: true, usageCount }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not delete tag.'
    return { error: message }
  }
}
