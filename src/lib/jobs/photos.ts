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

/**
 * Upload a job photo to `tenant-assets/{orgId}/jobs/{jobId}/{photoId}.{ext}`.
 * Server-only: service-role key never reaches the client.
 */
export async function uploadJobPhoto(
  orgId: string,
  jobId: string,
  file: File,
): Promise<{ id: string; path: string }> {
  if (!orgId) throw new Error('uploadJobPhoto: missing orgId')
  if (!file || file.size === 0) throw new Error('uploadJobPhoto: empty file')

  // Enforce size cap (10 MB)
  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    throw new Error('uploadJobPhoto: file exceeds 10 MB limit')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'uploadJobPhoto: SUPABASE storage env not configured',
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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

  // Insert job_photos row under tenant scope
  const [row] = await withTenant(orgId, async (tx) => {
    return tx
      .insert(jobPhotos)
      .values({
        tenantId: orgId,
        jobId,
        storagePath: path,
        uploadedBy: null, // caller can pass userId if needed
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('getJobPhotoSignedUrls: SUPABASE storage env not configured')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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
