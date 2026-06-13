'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import {
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
} from '@/lib/categories'

export type ProductCategoryActionState = {
  error?: string
  success?: boolean
  id?: string
}

const productCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
})

const updateProductCategorySchema = productCategorySchema.extend({
  id: z.string().min(1),
})

export async function createProductCategoryAction(
  _prevState: ProductCategoryActionState,
  formData: FormData,
): Promise<ProductCategoryActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = productCategorySchema.safeParse({
    name: formData.get('name'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    const result = await createProductCategory(orgId, parsed.data.name)
    revalidatePath('/settings/product-categories')
    return { success: true, id: result.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not create category.'
    return { error: message }
  }
}

export async function updateProductCategoryAction(
  _prevState: ProductCategoryActionState,
  formData: FormData,
): Promise<ProductCategoryActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = updateProductCategorySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { id, name } = parsed.data

  try {
    await updateProductCategory(orgId, id, name)
    revalidatePath('/settings/product-categories')
    return { success: true, id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not update category.'
    return { error: message }
  }
}

export async function deleteProductCategoryAction(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await deleteProductCategory(orgId, id)
    revalidatePath('/settings/product-categories')
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not delete category.'
    return { error: message }
  }
}
