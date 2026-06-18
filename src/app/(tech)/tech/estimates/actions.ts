'use server'

import { auth } from '@clerk/nextjs/server'
import { logger } from '@/lib/logger'
import type { CachedEstimate } from '@/app/(tech)/lib/dexie'

export interface CreateEstimateInput {
  customerId: string
  serviceLocationId: string | null
  contactName: string | null
  contactPhone: string | null
  description: string
  lineItems: Array<{ name: string; qty: string; unitPrice: string }>
  followUpDate: string | null
  expiryDate: string | null
  notes: string | null
  internalNotes: string | null
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
 * PWA wrapper for the canonical Phase 6 createEstimateAction.
 *
 * This delegates to `src/app/(app)/estimates/actions` when Phase 6 ships. Until
 * then the module does not exist, so we return a safe "not available" error for
 * online attempts; offline attempts are still queued in the Dexie outbox and will
 * flush automatically once the backend action is present.
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
      createEstimateAction?: (orgId: string, input: CreateEstimateInput) => Promise<{ id: string }>
    }
    if (typeof mod.createEstimateAction !== 'function') {
      return { success: false, error: 'Estimates are not available yet.' }
    }
    const result = await mod.createEstimateAction(orgId, input)
    return { success: true, id: result.id }
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
