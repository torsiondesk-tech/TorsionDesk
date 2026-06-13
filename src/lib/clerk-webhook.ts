import { z } from 'zod'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { provisionTenant } from '@/db/provision-tenant'

const WebhookBody = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
  }),
})

/**
 * Verify and handle a Clerk webhook (AUTH-01, D-02, RESEARCH Pattern 6).
 *
 * Extracted from the route module so it can be unit-tested directly: Next.js App
 * Router `route.ts` files may only export HTTP-method handlers, so the testable
 * logic lives here and the route delegates to it.
 *
 * Security:
 *   • Signature verified with `verifyWebhook()` (Svix) BEFORE any DB write — a
 *     forged/unsigned body throws and we return 400, never provisioning a fake
 *     tenant (threat T-00-03 spoofing).
 *   • Provisioning is idempotent (`provisionTenant` → `onConflictDoNothing`), so
 *     Svix retries / replays never duplicate the tenant.
 *
 * Returns 2xx for every verified event (handled or ignored) so Svix stops
 * retrying; 400 on a bad signature.
 */
export async function handleClerkWebhook(req: Request): Promise<Response> {
  let payload: unknown
  try {
    // Clerk types `verifyWebhook` against its `RequestLike` (a NextRequest at
    // runtime); the Web `Request` is accepted at runtime. The cast keeps the
    // handler testable with a plain `Request`.
    payload = await verifyWebhook(req as Parameters<typeof verifyWebhook>[0])
  } catch {
    return new Response('invalid signature', { status: 400 })
  }

  const evt = WebhookBody.safeParse(payload)
  if (!evt.success) {
    return new Response('invalid payload', { status: 400 })
  }

  if (evt.data.type === 'organization.created') {
    await provisionTenant(evt.data.data.id)
  }

  return new Response('ok', { status: 200 })
}
