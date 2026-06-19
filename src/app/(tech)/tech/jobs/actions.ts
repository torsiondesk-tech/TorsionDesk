'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { listJobs } from '@/lib/jobs/jobs'
import { transitionJobStatusAction as _transitionJobStatusAction } from '@/app/(app)/jobs/actions'

export interface CreateTechJobInput {
  customerId: string
  serviceLocationId: string | null
  description: string
  startDate: string | null
}

export async function createTechJobAction(
  input: CreateTechJobInput,
): Promise<{ success: false; error: string } | { success: true; id: string }> {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    return { success: false, error: 'Not authenticated.' }
  }

  if (!input.customerId) {
    return { success: false, error: 'Customer is required.' }
  }
  if (!input.description?.trim()) {
    return { success: false, error: 'Description is required.' }
  }

  try {
    const { withTenant } = await import('@/db/with-tenant')
    const { jobs, jobAssignees } = await import('@/db/schema')
    const { nextJobNo } = await import('@/lib/jobs/job-number')

    const id = await withTenant(orgId, async (tx) => {
      const jobNo = await nextJobNo(tx, orgId)

      const [row] = await tx
        .insert(jobs)
        .values({
          tenantId: orgId,
          jobNo,
          customerId: input.customerId,
          serviceLocationId: input.serviceLocationId ?? null,
          status: 'unscheduled',
          description: input.description.trim(),
          startDate: input.startDate ? new Date(`${input.startDate}T00:00:00`) : null,
        })
        .returning({ id: jobs.id })

      await tx.insert(jobAssignees).values({
        tenantId: orgId,
        jobId: row.id,
        userId,
        notify: false,
      })

      return row.id
    })

    revalidatePath('/tech/jobs')
    revalidatePath('/jobs')
    return { success: true, id }
  } catch (err) {
    const message = extractErrorMessage(err)
    return { success: false, error: message || 'Could not create job. Please try again.' }
  }
}

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

  return listJobs(orgId, {
    assigneeUserId: userId,
    pageSize: 200,
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
  signatureType: 'start' | 'complete',
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
    await confirmJobSignature(orgId, jobId, path, signedBy, userId ?? '', signatureType)
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
