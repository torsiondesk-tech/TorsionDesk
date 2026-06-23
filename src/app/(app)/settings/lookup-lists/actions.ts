'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import {
  createReferralSource,
  updateReferralSource,
  deleteReferralSource,
  createJobSource,
  updateJobSource,
  deleteJobSource,
  createSalesRep,
  updateSalesRep,
  deleteSalesRep,
} from '@/lib/settings'

export type LookupActionState = {
  error?: string
  success?: boolean
  id?: string
}

const lookupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
})

// ── Referral Sources ─────────────────────────────────────────────────────────

export async function createReferralSourceAction(
  _prevState: LookupActionState,
  formData: FormData,
): Promise<LookupActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = lookupSchema.safeParse({
    name: formData.get('name'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    const result = await createReferralSource(orgId, parsed.data.name)
    revalidatePath('/settings/lookup-lists')
    return { success: true, id: result.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not create referral source.'
    return { error: message }
  }
}

export async function updateReferralSourceAction(
  _prevState: LookupActionState,
  formData: FormData,
): Promise<LookupActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = z
    .object({ id: z.string().min(1), name: z.string().trim().min(1).max(255) })
    .safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
    })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    await updateReferralSource(orgId, parsed.data.id, parsed.data.name)
    revalidatePath('/settings/lookup-lists')
    return { success: true, id: parsed.data.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not update referral source.'
    return { error: message }
  }
}

export async function deleteReferralSourceAction(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await deleteReferralSource(orgId, id)
    revalidatePath('/settings/lookup-lists')
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not delete referral source.'
    return { error: message }
  }
}

// ── Job Sources ──────────────────────────────────────────────────────────────

export async function createJobSourceAction(
  _prevState: LookupActionState,
  formData: FormData,
): Promise<LookupActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = lookupSchema.safeParse({
    name: formData.get('name'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    const result = await createJobSource(orgId, parsed.data.name)
    revalidatePath('/settings/lookup-lists')
    return { success: true, id: result.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not create job source.'
    return { error: message }
  }
}

export async function updateJobSourceAction(
  _prevState: LookupActionState,
  formData: FormData,
): Promise<LookupActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = z
    .object({ id: z.string().min(1), name: z.string().trim().min(1).max(255) })
    .safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
    })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    await updateJobSource(orgId, parsed.data.id, parsed.data.name)
    revalidatePath('/settings/lookup-lists')
    return { success: true, id: parsed.data.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not update job source.'
    return { error: message }
  }
}

export async function deleteJobSourceAction(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await deleteJobSource(orgId, id)
    revalidatePath('/settings/lookup-lists')
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not delete job source.'
    return { error: message }
  }
}

// ── Sales Reps ────────────────────────────────────────────────────────────────

export async function createSalesRepAction(
  _prevState: LookupActionState,
  formData: FormData,
): Promise<LookupActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = lookupSchema.safeParse({
    name: formData.get('name'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    const result = await createSalesRep(orgId, parsed.data.name)
    revalidatePath('/settings/lookup-lists')
    return { success: true, id: result.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not create sales rep.'
    return { error: message }
  }
}

export async function updateSalesRepAction(
  _prevState: LookupActionState,
  formData: FormData,
): Promise<LookupActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = z
    .object({ id: z.string().min(1), name: z.string().trim().min(1).max(255) })
    .safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
    })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  try {
    await updateSalesRep(orgId, parsed.data.id, parsed.data.name)
    revalidatePath('/settings/lookup-lists')
    return { success: true, id: parsed.data.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not update sales rep.'
    return { error: message }
  }
}

export async function deleteSalesRepAction(
  id: string,
): Promise<{ success?: boolean; error?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await deleteSalesRep(orgId, id)
    revalidatePath('/settings/lookup-lists')
    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not delete sales rep.'
    return { error: message }
  }
}
