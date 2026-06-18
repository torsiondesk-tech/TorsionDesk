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

// Drizzle/postgres-js wraps the real Postgres error in .cause. Prefer the cause
// message so users see "null value in column…" rather than "Failed query: …".
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

/** Turn raw Postgres errors into user-friendly sentences for the tag UI. */
function friendlyTagError(raw: string, name?: string): string {
  if (raw.includes('duplicate key value violates unique constraint')) {
    return `A tag named "${name || 'with that name'}" already exists. Choose a different name.`
  }
  if (raw.includes('violates foreign key constraint')) {
    return 'This tag is still in use and cannot be changed right now.'
  }
  if (raw.includes('null value in column')) {
    return 'Please fill in all required fields.'
  }
  return raw
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
    return {
      error: friendlyTagError(extractErrorMessage(err), parsed.data.name) || 'Could not create tag.',
    }
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
    return {
      error: friendlyTagError(extractErrorMessage(err), data.name) || 'Could not update tag.',
    }
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
    return { error: extractErrorMessage(err) || 'Could not delete tag.' }
  }
}
