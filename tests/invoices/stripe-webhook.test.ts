/**
 * INV-06 — handleStripeWebhook deduplicates by stripe_event_id and verifies
 * signatures (RED until src/lib/stripe-webhook.ts exists).
 *
 * Contract:
 *   1. Duplicate stripe_event_id (unique violation code '23505') returns 200.
 *   2. Invalid signature returns 400.
 *   3. Valid event with unknown type returns 200 'Ignored'.
 *   4. Existing transactionToken match → idempotent no-op, no insert, returns 200.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'

// Ensure STRIPE_WEBHOOK_SECRET is truthy so the `if (!secret)` guard doesn't
// short-circuit to 500 before tests can exercise the webhook logic.
beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
})

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
          data: {
            object: {
              id: 'pi_123',
              amount: 5000,
              amount_received: 5000,
              // Include customer_id so recordStripePayment doesn't need an invoice lookup
              metadata: {
                tenant_id: 'org_stripe_test',
                customer_id: 'cust_stripe',
                invoice_id: 'inv_1',
              },
            },
          },
        }
      }),
    }
  },
}))

/**
 * Build a thenable chain: the result of .where() can be both awaited directly
 * (for nextPaymentNo which does `await tx.select().from().where()`) and chained
 * with `.limit()` (for the dedup selects that do `.where().limit(1)`).
 */
function makeWhereResult(resolveValue: unknown[]): {
  then: (res: (v: unknown[]) => void, rej?: (e: unknown) => void) => void
  limit: (_n: number) => Promise<unknown[]>
} {
  return {
    then(resolve, _reject) { resolve(resolveValue) },
    limit: async (_n: number) => resolveValue,
  }
}

// Default withTenant mock:
//   select call 1 → stripeEventId dedup: .where().limit(1) → []
//   select call 2 → transactionToken dedup: .where().limit(1) → []
//   select call 3 → nextPaymentNo max: .where() (no limit) → [{ m: null }]
//   (select calls 4+ → invoice total fetch etc → [])
// insert always throws 23505 so the existing dedup-by-event-id test → 200.
vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    let selectCallCount = 0
    const tx = {
      select: vi.fn((_cols?: unknown) => {
        selectCallCount++
        const callNum = selectCallCount
        // nextPaymentNo is select call 3 (after two dedup selects) → needs [{ m: null }]
        const resolveValue = callNum === 3 ? [{ m: null }] : []
        return {
          from: vi.fn((_table?: unknown) => ({
            where: vi.fn((_cond?: unknown) => makeWhereResult(resolveValue)),
          })),
        }
      }),
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

  it('returns 200 with no insert when transactionToken already exists (cross-event dedup)', async () => {
    const { withTenant } = await import('@/db/with-tenant')
    const insertSpy = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: 'pay_new', paymentNo: 99 }]),
      })),
    }))

    // Override withTenant for this test: transactionToken dedup select returns existing row
    vi.mocked(withTenant).mockImplementationOnce(
      async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
        let selectCallCount = 0
        const tx = {
          select: vi.fn((_cols?: unknown) => {
            selectCallCount++
            const callNum = selectCallCount
            const resolveValue = callNum === 1
              ? [] // stripeEventId dedup → no existing
              : [{ id: 'pay_existing' }] // transactionToken dedup → existing found
            return {
              from: vi.fn((_table?: unknown) => ({
                where: vi.fn((_cond?: unknown) => makeWhereResult(resolveValue)),
              })),
            }
          }),
          insert: insertSpy,
        }
        return fn(tx)
      },
    )

    const req = new Request('https://example.com/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_999' }),
      headers: { 'stripe-signature': 'valid_sig' },
    })
    const res = await handleStripeWebhook(req)
    expect(res.status).toBe(200)
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
