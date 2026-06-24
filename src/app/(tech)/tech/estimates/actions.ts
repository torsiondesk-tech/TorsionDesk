'use server'

import { auth } from '@clerk/nextjs/server'
import { logger } from '@/lib/logger'
import type { CachedEstimate } from '@/app/(tech)/lib/dexie'

export interface EstimateLineItemInput {
  id?: string
  type?: 'product' | 'service' | 'discount' | 'expense'
  refId?: string | null
  title?: string | null
  description?: string
  qty?: string
  rate?: string
  unitPrice?: string
  cost?: string
  taxItemId?: string | null
  groupId?: string | null
  sortOrder?: number
}

export interface EstimateGroupInput {
  id?: string
  name: string
  sortOrder?: number
}

/**
 * Full PWA estimate payload. Matches the desktop form's `updateEstimateSchema`
 * so we can delegate directly to `createOfficeEstimateAction`.
 */
export interface CreateEstimateInput {
  customerId?: string
  newCustomerName?: string
  newContactFirstName?: string
  newContactLastName?: string
  newContactPhone?: string
  newContactEmail?: string
  newLocationAddress1?: string
  newLocationAddress2?: string
  newLocationCity?: string
  newLocationState?: string
  newLocationPostalCode?: string
  contactId?: string | null
  serviceLocationId?: string | null
  categoryId?: string | null
  description?: string
  poNumber?: string
  opportunityRating?: number | null
  referralSourceId?: string | null
  expiryDate?: string | null
  followUpDate?: string | null
  onSiteDate?: string | null
  arrivalWindowStart?: string | null
  arrivalWindowEnd?: string | null
  notesForTechs?: string
  notes?: string
  internalNotes?: string
  assignedAgentId?: string | null
  tagIds?: string[]
  assigneeUserIds?: string[]
  lineItems?: EstimateLineItemInput[]
  groups?: EstimateGroupInput[]
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

function isPhase6Missing(err: unknown): boolean {
  const message = extractErrorMessage(err)
  return /cannot find module|cannot resolve|no such file or directory|failed to resolve|is not a function|not available yet/i.test(
    message,
  )
}

/**
 * PWA wrapper for the canonical Phase 6 create estimate action.
 *
 * Delegates to `src/app/(app)/estimates/actions`' `createOfficeEstimateAction`
 * so the PWA and desktop share one creation path. Offline attempts are queued
 * in the Dexie outbox and flush automatically once connectivity returns.
 */
export async function createEstimateAction(
  input: CreateEstimateInput,
): Promise<{ success: false; error: string } | { success: true; id: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { success: false, error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const mod = (await import('@/app/(app)/estimates/actions')) as {
      createOfficeEstimateAction?: (
        orgId: string,
        data: Record<string, unknown>,
      ) => Promise<{ success: true; id: string } | { error: string }>
    }
    if (typeof mod.createOfficeEstimateAction !== 'function') {
      return { success: false, error: 'Estimates are not available yet.' }
    }

    const payload: Record<string, unknown> = {
      customerId: input.customerId ?? '',
      newCustomerName: input.newCustomerName ?? '',
      newContactFirstName: input.newContactFirstName ?? '',
      newContactLastName: input.newContactLastName ?? '',
      newContactPhone: input.newContactPhone ?? '',
      newContactEmail: input.newContactEmail ?? '',
      newLocationAddress1: input.newLocationAddress1 ?? '',
      newLocationAddress2: input.newLocationAddress2 ?? '',
      newLocationCity: input.newLocationCity ?? '',
      newLocationState: input.newLocationState ?? '',
      newLocationPostalCode: input.newLocationPostalCode ?? '',
      contactId: input.contactId ?? null,
      serviceLocationId: input.serviceLocationId ?? null,
      categoryId: input.categoryId ?? null,
      description: input.description ?? '',
      poNumber: input.poNumber ?? '',
      opportunityRating: input.opportunityRating ?? null,
      referralSourceId: input.referralSourceId ?? null,
      expiryDate: input.expiryDate ?? null,
      followUpDate: input.followUpDate ?? null,
      onSiteDate: input.onSiteDate ?? null,
      arrivalWindowStart: input.arrivalWindowStart ?? null,
      arrivalWindowEnd: input.arrivalWindowEnd ?? null,
      notesForTechs: input.notesForTechs ?? '',
      notes: input.notes ?? '',
      internalNotes: input.internalNotes ?? '',
      assignedAgentId: input.assignedAgentId ?? null,
      tagIds: input.tagIds ?? [],
      assigneeUserIds: input.assigneeUserIds ?? [],
      lineItems: JSON.stringify(input.lineItems ?? []),
      groups: JSON.stringify(input.groups ?? []),
    }

    const result = await mod.createOfficeEstimateAction(orgId, payload)
    if ('error' in result && result.error) {
      return { success: false, error: result.error }
    }
    if ('id' in result && result.id) {
      return { success: true, id: result.id }
    }
    return { success: false, error: 'Could not create estimate.' }
  } catch (err) {
    const message = extractErrorMessage(err)
    if (isPhase6Missing(err)) {
      return { success: false, error: 'Estimates are not available yet.' }
    }
    logger.error('createEstimateAction', err)
    return { success: false, error: message }
  }
}

/**
 * PWA wrapper for the canonical Phase 6 convertEstimateToJobAction.
 */
export async function convertEstimateToJobAction(
  estimateId: string,
): Promise<{ success: false; error: string } | { success: true; jobId?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { success: false, error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const mod = (await import('@/app/(app)/estimates/actions')) as {
      convertEstimateToJobAction?: (orgId: string, estimateId: string) => Promise<{ jobId?: string }>
    }
    if (typeof mod.convertEstimateToJobAction !== 'function') {
      return { success: false, error: 'Estimates are not available yet.' }
    }
    const result = await mod.convertEstimateToJobAction(orgId, estimateId)
    return { success: true, jobId: result.jobId }
  } catch (err) {
    const message = extractErrorMessage(err)
    if (isPhase6Missing(err)) {
      return { success: false, error: 'Estimates are not available yet.' }
    }
    logger.error('convertEstimateToJobAction', err)
    return { success: false, error: message }
  }
}

/**
 * PWA wrapper for listing estimates. Delegates to Phase 6 when present.
 */
export async function listTechEstimatesAction(
  orgId: string,
  _userId: string,
): Promise<{ rows: CachedEstimate[]; error?: string }> {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    return { rows: [], error: 'Unauthorized' }
  }

  try {
    const mod = (await import('@/app/(app)/estimates/actions')) as {
      listEstimatesAction?: (orgId: string) => Promise<{ rows: CachedEstimate[] }>
    }
    if (typeof mod.listEstimatesAction !== 'function') {
      return { rows: [], error: 'Estimates are not available yet.' }
    }
    return mod.listEstimatesAction(orgId)
  } catch (err) {
    const message = extractErrorMessage(err)
    if (isPhase6Missing(err)) {
      return { rows: [], error: 'Estimates are not available yet.' }
    }
    logger.error('listTechEstimatesAction', err)
    return { rows: [], error: message }
  }
}
