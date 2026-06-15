import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { withTenant } from '@/db/with-tenant'
import { jobPhotos } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

const BUCKET = 'tenant-assets'

/** Map a file's MIME type / name to a safe, known image extension. */
function resolveExtension(file: File): string {
  const byMime: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  if (byMime[file.type]) return byMime[file.type]

  const fromName = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  return 'png'
}

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
 * Create a signed upload URL for direct client → Supabase Storage upload.
 * Returns the signed URL and the storage path so the client can PUT the file,
 * then call confirmJobPhoto() to record it in the DB.
 *
 * Note: we only need filename (for extension) and fileSize (for validation),
 * NOT the actual file bytes. The upload happens via direct fetch().
 */
export async function createJobPhotoSignedUploadUrl(
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

  // Derive extension from filename
  const fromName = filename.split('.').pop()?.toLowerCase() ?? ''
  let ext = 'png'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fromName)) {
    ext = fromName === 'jpeg' ? 'jpg' : fromName
  }

  const photoId = crypto.randomUUID()
  const path = `${orgId}/jobs/${jobId}/${photoId}.${ext}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL creation failed — ${error?.message ?? 'unknown'}`)
  }

  return { signedUrl: data.signedUrl, path }
}

/**
 * Record a photo in the DB after the client has uploaded it directly to Storage.
 */
export async function confirmJobPhoto(
  orgId: string,
  jobId: string,
  path: string,
  userId?: string | null,
): Promise<{ id: string }> {
  const [row] = await withTenant(orgId, async (tx) => {
    return tx
      .insert(jobPhotos)
      .values({
        tenantId: orgId,
        jobId,
        storagePath: path,
        uploadedBy: userId ?? null,
      })
      .returning({ id: jobPhotos.id })
  })
  return { id: row.id }
}

// ── Legacy Server-Action upload (kept for backward compat, not recommended) ─

/**
 * Upload a job photo via service-role client.
 * Prefer createJobPhotoSignedUploadUrl + confirmJobPhoto for large files.
 */
export async function uploadJobPhoto(
  orgId: string,
  jobId: string,
  file: File,
): Promise<{ id: string; path: string }> {
  if (!orgId) throw new Error('uploadJobPhoto: missing orgId')
  if (!file || file.size === 0) throw new Error('uploadJobPhoto: empty file')

  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    throw new Error('uploadJobPhoto: file exceeds 10 MB limit')
  }

  const supabase = getServiceClient()
  const ext = resolveExtension(file)
  const photoId = crypto.randomUUID()
  const path = `${orgId}/jobs/${jobId}/${photoId}.${ext}`

  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || `image/${ext}`,
    upsert: false,
  })
  if (uploadError) {
    throw new Error(`uploadJobPhoto: Storage upload failed — ${uploadError.message}`)
  }

  const [row] = await withTenant(orgId, async (tx) => {
    return tx
      .insert(jobPhotos)
      .values({
        tenantId: orgId,
        jobId,
        storagePath: path,
        uploadedBy: null,
      })
      .returning({ id: jobPhotos.id })
  })

  return { id: row.id, path }
}

/**
 * Generate short-lived signed URLs for all photos on a job.
 * Call from an RSC and pass URLs to the client component.
 */
export async function getJobPhotoSignedUrls(
  orgId: string,
  jobId: string,
): Promise<{ id: string; url: string; uploadedBy: string | null; createdAt: Date | null }[]> {
  const supabase = getServiceClient()

  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(jobPhotos)
      .where(and(eq(jobPhotos.tenantId, orgId), eq(jobPhotos.jobId, jobId)))
      .orderBy(desc(jobPhotos.createdAt))

    const results: { id: string; url: string; uploadedBy: string | null; createdAt: Date | null }[] = []

    for (const row of rows) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storagePath, 3600) // 1 hour
      if (error || !data) continue
      results.push({
        id: row.id,
        url: data.signedUrl,
        uploadedBy: row.uploadedBy,
        createdAt: row.createdAt,
      })
    }

    return results
  })
}

/**
 * Delete a photo from Storage and the DB.
 */
export async function deleteJobPhoto(
  orgId: string,
  jobId: string,
  photoId: string,
): Promise<void> {
  const supabase = getServiceClient()

  await withTenant(orgId, async (tx) => {
    // 1. Find the storage path scoped to tenant + job
    const rows = await tx
      .select({ storagePath: jobPhotos.storagePath })
      .from(jobPhotos)
      .where(
        and(
          eq(jobPhotos.tenantId, orgId),
          eq(jobPhotos.id, photoId),
          eq(jobPhotos.jobId, jobId),
        ),
      )
      .limit(1)

    if (rows.length === 0) {
      throw new Error('Photo not found')
    }

    const { storagePath } = rows[0]

    // 2. Delete from Storage (best-effort; don't block on storage errors)
    await supabase.storage.from(BUCKET).remove([storagePath])

    // 3. Delete DB row
    await tx
      .delete(jobPhotos)
      .where(
        and(
          eq(jobPhotos.tenantId, orgId),
          eq(jobPhotos.id, photoId),
          eq(jobPhotos.jobId, jobId),
        ),
      )
  })
}
