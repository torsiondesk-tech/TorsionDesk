import { handleClerkWebhook } from '@/lib/clerk-webhook'

/**
 * Clerk webhook endpoint — `organization.created` → idempotent `tenants` insert
 * (AUTH-01, D-02). The verification + provisioning logic lives in
 * `@/lib/clerk-webhook` (Next App Router route files may ONLY export HTTP-method
 * handlers — any other export fails `next build` type validation); this route
 * delegates to that helper.
 *
 * This route MUST be listed in the middleware public matcher (`/api/webhooks(.*)`)
 * — wired in Plan 03 — or Clerk's POST is rejected with 401 and the org is never
 * provisioned (RESEARCH Pitfall 4).
 */
export async function POST(req: Request): Promise<Response> {
  return handleClerkWebhook(req)
}
