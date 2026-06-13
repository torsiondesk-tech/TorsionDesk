'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { mergeCustomers } from '@/lib/merge'
import { getCustomerById } from '@/lib/customers'

export interface MergeActionState {
  error?: string
  success?: boolean
}

export async function submitMerge(
  _prevState: MergeActionState,
  formData: FormData,
): Promise<MergeActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const winnerId = String(formData.get('winnerId') ?? '')
  const loserId = String(formData.get('loserId') ?? '')
  if (!winnerId || !loserId) {
    return { error: 'Both records are required to merge.' }
  }
  if (winnerId === loserId) {
    return { error: 'Cannot merge a customer into itself.' }
  }

  // Verify both records exist and belong to this tenant
  const [winner, loser] = await Promise.all([
    getCustomerById(orgId, winnerId),
    getCustomerById(orgId, loserId),
  ])
  if (!winner || !loser) {
    return { error: 'One or both records were not found.' }
  }

  // Parse field-level choices — whitelisted to prevent mass-assignment
  const ALLOWED_MERGE_FIELDS = new Set([
    'name',
    'internalNotes',
    'publicNotes',
    'assignedAgentId',
    'referralSourceId',
    'taxable',
  ])
  const fieldChoices: Record<string, 'left' | 'right'> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('field_')) {
      const fieldName = key.slice('field_'.length)
      if (ALLOWED_MERGE_FIELDS.has(fieldName) && (value === 'left' || value === 'right')) {
        fieldChoices[fieldName] = value
      }
    }
  }

  try {
    await mergeCustomers(orgId, winnerId, loserId, fieldChoices)
    revalidatePath('/customers')
    revalidatePath(`/customers/${winnerId}`)
    return { success: true }
  } catch (err) {
    console.error('merge failed:', err)
    return { error: 'Could not merge customers. Please try again.' }
  }
}
