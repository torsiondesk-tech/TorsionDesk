import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { withTenant } from '@/db/with-tenant'
import { jobSignatures } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

const BUCKET = 'tenant-assets'

// ── Service-role Supabase client (server-only) ─────────────────────────────

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE storage env not configured')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ── Signed-URL direct upload (production pattern) ──────────────────────────

/**
 * Create a signed upload URL for a customer signature PNG.
 * The technician PWA uploads the signature blob directly to this URL, then calls
 * confirmJobSignature() to record it under job_signatures.
 */
export async function createJobSignatureSignedUploadUrl(
  orgId: string,
  jobId: string,
  filename: string,
  fileSize: number,
): Promise<{ signedUrl: string; path: string }> {
  if (!orgId) throw new Error('Missing orgId')
  if (!filename || fileSize === 0) throw new Error('Empty file')

  const MAX_SIZE = 10 * 1024 * 1024
  if (fileSize > MAX_SIZE) {
    throw new Error('File exceeds 10 MB limit')
  }

  const supabase = getServiceClient()

  // Derive extension from filename; signatures are PNG by default
  const fromName = filename.split('.').pop()?.toLowerCase() ?? ''
  let ext = 'png'
  if (['png', 'jpg', 'jpeg', 'webp'].includes(fromName)) {
    ext = fromName === 'jpeg' ? 'jpg' : fromName
  }

  const signatureId = crypto.randomUUID()
  const path = `${orgId}/jobs/${jobId}/${signatureId}.${ext}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL creation failed — ${error?.message ?? 'unknown'}`)
  }

  return { signedUrl: data.signedUrl, path }
}

/**
 * Record a signature in the DB after the client has uploaded it directly to Storage.
 */
export async function confirmJobSignature(
  orgId: string,
  jobId: string,
  path: string,
  signedBy: string,
  capturedBy: string,
  signatureType: 'start' | 'complete',
): Promise<{ id: string }> {
  if (!signedBy.trim()) {
    throw new Error('Signed-by name is required')
  }

  const [row] = await withTenant(orgId, async (tx) => {
    return tx
      .insert(jobSignatures)
      .values({
        tenantId: orgId,
        jobId,
        storagePath: path,
        signatureType,
        signedBy: signedBy.trim(),
        capturedBy: capturedBy ?? null,
      })
      .returning({ id: jobSignatures.id })
  })
  return { id: row.id }
}

/**
 * Generate short-lived signed URLs for all signatures on a job.
 * Call from an RSC and pass URLs to the client component.
 */
export async function getJobSignatureSignedUrls(
  orgId: string,
  jobId: string,
): Promise<{ id: string; url: string; signatureType: 'start' | 'complete' | null; signedBy: string | null; capturedBy: string | null; createdAt: Date | null }[]> {
  const supabase = getServiceClient()

  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(jobSignatures)
      .where(and(eq(jobSignatures.tenantId, orgId), eq(jobSignatures.jobId, jobId)))
      .orderBy(desc(jobSignatures.createdAt))

    const results: { id: string; url: string; signatureType: 'start' | 'complete' | null; signedBy: string | null; capturedBy: string | null; createdAt: Date | null }[] = []

    for (const row of rows) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storagePath, 3600) // 1 hour
      if (error || !data) continue
      results.push({
        id: row.id,
        url: data.signedUrl,
        signatureType: row.signatureType ?? null,
        signedBy: row.signedBy,
        capturedBy: row.capturedBy,
        createdAt: row.createdAt,
      })
    }

    return results
  })
}
