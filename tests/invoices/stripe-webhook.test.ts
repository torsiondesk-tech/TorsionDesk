/**
 * INV-06 — handleStripeWebhook deduplicates by stripe_event_id and verifies
 * signatures (RED until src/lib/stripe-webhook.ts exists).
 *
 * Contract:
 *   1. Duplicate stripe_event_id (unique violation code '23505') returns 200.
 *   2. Invalid signature returns 400.
 *   3. Valid event with unknown type returns 200 'Ignored'.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('stripe', () => ({
  default: class MockStripe {
    webhooks = {
      constructEvent: vi.fn((_body: string, sig: string) => {
        if (!sig || sig === 'bad_sig') {
          throw new Error('Webhook signature verification failed')
        }
        return {
          id: 'evt_123',
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_123', amount: 5000 } },
        }
      }),
    }
  },
}))

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => {
            const err: any = new Error('duplicate key value violates unique constraint')
            err.code = '23505'
            throw err
          }),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing export — RED signal.
import { handleStripeWebhook } from '@/lib/stripe-webhook'

describe('handleStripeWebhook', () => {
  it('returns 200 when duplicate stripe_event_id causes unique violation', async () => {
    const req = new Request('https://example.com/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_123' }),
      headers: { 'stripe-signature': 'valid_sig' },
    })
    const res = await handleStripeWebhook(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 on invalid signature', async () => {
    const req = new Request('https://example.com/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_123' }),
      headers: { 'stripe-signature': 'bad_sig' },
    })
    const res = await handleStripeWebhook(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 Ignored for unknown event types', async () => {
    vi.doMock('stripe', () => ({
      default: class MockStripe {
        webhooks = {
          constructEvent: vi.fn(() => ({
            id: 'evt_456',
            type: 'invoice.payment_failed',
          })),
        }
      },
    }))
    const req = new Request('https://example.com/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_456' }),
      headers: { 'stripe-signature': 'valid_sig' },
    })
    const res = await handleStripeWebhook(req)
    expect(res.status).toBe(200)
  })
})
