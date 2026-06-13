'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import {
  createTaxItem,
  updateTaxItem,
  deleteTaxItem,
} from '@/lib/settings'

export type TaxItemActionState = {
  error?: string
  success?: boolean
  id?: string
}

const taxItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  rate: z
    .string()
    .trim()
    .min(1, 'Rate is required')
    .refine(
      (val) => {
        const n = Number(val)
        return !Number.isNaN(n) && n >= 0 && n <= 100
      },
      { message: 'Rate must be a percentage between 0 and 100.' },
    ),
})

const updateTaxItemSchema = taxItemSchema.extend({
  id: z.string().min(1),
})

export async function createTaxItemAction(
  _prevState: TaxItemActionState,
  formData: FormData,
): Promise<TaxItemActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = taxItemSchema.safeParse({
    name: formData.get('name'),
    rate: formData.get('rate'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    const result = await createTaxItem(orgId, parsed.data)
    revalidatePath('/settings/tax-items')
    return { success: true, id: result.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not create tax item.'
    return { error: message }
  }
}

export async function updateTaxItemAction(
  _prevState: TaxItemActionState,
  formData: FormData,
): Promise<TaxItemActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = updateTaxItemSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    rate: formData.get('rate'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const { id, ...data } = parsed.data

  try {
    await updateTaxItem(orgId, id, data)
    revalidatePath('/settings/tax-items')
    return { success: true, id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not update tax item.'
    return { error: message }
  }
}

export async function deleteTaxItemAction(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await deleteTaxItem(orgId, id)
    revalidatePath('/settings/tax-items')
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not delete tax item.'
    return { error: message }
  }
}
