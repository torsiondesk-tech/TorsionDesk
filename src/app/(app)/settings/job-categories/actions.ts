'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import {
  createJobCategory,
  updateJobCategory,
  deleteJobCategory,
} from '@/lib/categories'

export type JobCategoryActionState = {
  error?: string
  success?: boolean
  id?: string
}

const jobCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  parentId: z.preprocess(
    (val) =>
      val === '' || val === null || val === undefined ? undefined : val,
    z.string().max(255).optional(),
  ),
})

const updateJobCategorySchema = jobCategorySchema.extend({
  id: z.string().min(1),
})

export async function createJobCategoryAction(
  _prevState: JobCategoryActionState,
  formData: FormData,
): Promise<JobCategoryActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = jobCategorySchema.safeParse({
    name: formData.get('name'),
    parentId: formData.get('parentId'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    const result = await createJobCategory(orgId, {
      name: parsed.data.name,
      parentId: parsed.data.parentId,
    })
    revalidatePath('/settings/job-categories')
    return { success: true, id: result.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not create category.'
    return { error: message }
  }
}

export async function updateJobCategoryAction(
  _prevState: JobCategoryActionState,
  formData: FormData,
): Promise<JobCategoryActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = updateJobCategorySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    parentId: formData.get('parentId'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { id, ...data } = parsed.data

  try {
    await updateJobCategory(orgId, id, data)
    revalidatePath('/settings/job-categories')
    return { success: true, id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not update category.'
    return { error: message }
  }
}

export async function deleteJobCategoryAction(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await deleteJobCategory(orgId, id)
    revalidatePath('/settings/job-categories')
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not delete category.'
    return { error: message }
  }
}
