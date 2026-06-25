import { handleStripeWebhook } from '@/lib/stripe-webhook'

/**
 * Stripe webhook endpoint — idempotently records invoice payments.
 * Verification and business logic live in `@/lib/stripe-webhook` so the
 * App Router route file only exports HTTP handlers (Next type-build requirement).
 */
export async function POST(req: Request): Promise<Response> {
  return handleStripeWebhook(req)
}
