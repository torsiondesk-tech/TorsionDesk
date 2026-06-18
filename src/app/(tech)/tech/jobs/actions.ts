'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { listJobs } from '@/lib/jobs/jobs'
import { toISODate } from '@/lib/utils'
import { transitionJobStatusAction as _transitionJobStatusAction } from '@/app/(app)/jobs/actions'

export async function transitionJobStatusAction(jobId: string, toStatus: string) {
  return _transitionJobStatusAction(jobId, toStatus)
}

export async function listTechJobsAction(orgId: string, userId: string) {
  const { orgId: sessionOrgId, userId: sessionUserId } = await auth()
  if (!sessionOrgId || !sessionUserId) {
    throw new Error('Not authenticated')
  }
  if (sessionOrgId !== orgId || sessionUserId !== userId) {
    throw new Error('Unauthorized')
  }

  const today = toISODate(new Date())
  const sevenDaysOutDate = new Date()
  sevenDaysOutDate.setDate(sevenDaysOutDate.getDate() + 7)

  return listJobs(orgId, {
    assigneeUserId: userId,
    dateFrom: today,
    dateTo: toISODate(sevenDaysOutDate),
    pageSize: 100,
  })
}

export async function getEquipmentByServiceLocationAction(
  orgId: string,
  serviceLocationId: string,
) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }

  const { getEquipmentByServiceLocation } = await import('@/lib/customers')
  return getEquipmentByServiceLocation(orgId, serviceLocationId)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

// ── Signature upload ───────────────────────────────────────────────────────

export async function getJobSignatureUploadUrlAction(
  jobId: string,
  filename: string,
  fileSize: number,
): Promise<{ error?: string; signedUrl?: string; path?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  if (!filename || fileSize === 0) {
    return { error: 'No signature captured.' }
  }

  try {
    const { createJobSignatureSignedUploadUrl } = await import('@/lib/jobs/signatures')
    const result = await createJobSignatureSignedUploadUrl(orgId, jobId, filename, fileSize)
    return { signedUrl: result.signedUrl, path: result.path }
  } catch (err) {
    const message = extractErrorMessage(err)
    return { error: message }
  }
}

export async function confirmJobSignatureAction(
  jobId: string,
  path: string,
  signedBy: string,
): Promise<{ error?: string; success?: boolean }> {
  const { orgId, userId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  if (!signedBy.trim()) {
    return { error: 'Signed-by name is required.' }
  }

  try {
    const { confirmJobSignature } = await import('@/lib/jobs/signatures')
    await confirmJobSignature(orgId, jobId, path, signedBy, userId ?? '')
    revalidatePath(`/tech/jobs/${jobId}`)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    return { error: message }
  }
}

// ── Completion notes ─────────────────────────────────────────────────────────

export async function saveCompletionNotesAction(
  jobId: string,
  notes: string,
): Promise<{ error?: string; success?: boolean }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  if (notes.length > 10000) {
    return { error: 'Notes must be 10,000 characters or fewer.' }
  }

  try {
    const { withTenant } = await import('@/db/with-tenant')
    const { jobs } = await import('@/db/schema')
    const { eq, and } = await import('drizzle-orm')

    await withTenant(orgId, async (tx) => {
      await tx
        .update(jobs)
        .set({ completionNotes: notes })
        .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
    })

    revalidatePath(`/tech/jobs/${jobId}`)
    revalidatePath(`/jobs/${jobId}`)
    return { success: true }
  } catch (err) {
    const message = extractErrorMessage(err)
    return { error: message }
  }
}
