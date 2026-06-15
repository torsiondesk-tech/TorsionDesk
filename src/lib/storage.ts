import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Tenant-scoped logo upload to Supabase Storage (TENANT-02, D-12; RESEARCH
 * Pattern 8 option (a) + A3).
 *
 * The upload runs server-side with the Supabase SERVICE-ROLE key, which bypasses
 * Storage RLS for a trusted server upload. The key is SERVER-ONLY (threat
 * T-00-04): this module imports `server-only` so it can never be pulled into a
 * client bundle, and the key is read from `SUPABASE_SERVICE_ROLE_KEY` (NOT a
 * `NEXT_PUBLIC_*` var). The upload path is constrained to `{orgId}/logo.<ext>`
 * so one tenant can never overwrite another tenant's folder (T-00-11).
 *
 * The bucket `tenant-assets` is private (created via the Supabase Dashboard,
 * see PLAN user_setup). `uploadLogo` returns the object PATH (`{orgId}/logo.ext`);
 * the caller persists it on `tenants.logo_url`, and later phases resolve a signed
 * URL from that path when rendering invoices / email headers.
 */

const BUCKET = 'tenant-assets'

/** Map a file's MIME type / name to a safe, known image extension. */
function resolveExtension(file: File): string {
  const byMime: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/gif': 'gif',
  }
  if (byMime[file.type]) return byMime[file.type]

  // Fall back to the filename extension, constrained to a known-safe set.
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  // Default to png — never trust an arbitrary client-supplied extension.
  return 'png'
}

/**
 * Upload a tenant's logo to `tenant-assets/{orgId}/logo.<ext>` and return the
 * stored object path. The upload uses `upsert: true` so re-uploading replaces the
 * existing logo rather than erroring.
 *
 * @param orgId  The Clerk organization id (== tenant id) — folder scope.
 * @param file   The uploaded logo file (from a server action's FormData).
 * @returns      The object path (`{orgId}/logo.<ext>`) to persist on the tenant.
 */
export async function uploadLogo(orgId: string, file: File): Promise<string> {
  if (!orgId) throw new Error('uploadLogo: missing orgId')
  if (!file || file.size === 0) throw new Error('uploadLogo: empty file')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'uploadLogo: SUPABASE storage env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)',
    )
  }

  // Service-role client — server-only, bypasses Storage RLS for this trusted
  // upload. No session persistence (this is a one-shot server request).
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const ext = resolveExtension(file)
  const path = `${orgId}/logo.${ext}`

  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || `image/${ext}`,
    upsert: true,
  })
  if (error) {
    throw new Error(`uploadLogo: Storage upload failed — ${error.message}`)
  }

  return path
}

/**
 * Generate a short-lived signed URL for a private tenant-assets object.
 * Returns null if the path is empty or credentials are missing — callers should
 * treat null as "no logo" rather than throw.
 *
 * @param path   Object path as stored in `tenants.logo_url` (e.g. `org_x/logo.png`).
 * @param ttl    Expiry in seconds (default 1 hour — sufficient for a settings page render).
 */
export async function getLogoSignedUrl(
  path: string,
  ttl = 3600,
): Promise<string | null> {
  if (!path) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl)
  if (error || !data) return null
  return data.signedUrl
}
