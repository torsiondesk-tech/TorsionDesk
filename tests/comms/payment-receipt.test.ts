/**
 * COMM-03 — Stripe webhook fires payment_receipt exactly once on the non-duplicate path.
 *
 * Contract:
 *   1. First webhook delivery fires a payment_receipt communication.
 *   2. Duplicate delivery (same stripe_event_id) does not re-fire.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
})

vi.mock('stripe', () => ({
  default: class MockStripe {
    webhooks = {
      constructEvent: vi.fn((_body: string, sig: string) => {
        if (!sig || sig === 'bad_sig') throw new Error('Invalid signature')
        return {
          id: 'evt_receipt_1',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_receipt_1',
              amount: 10000,
              amount_received: 10000,
              metadata: {
                tenant_id: 'org_receipt',
                customer_id: 'cust_receipt',
                invoice_id: 'inv_receipt',
              },
            },
          },
        }
      }),
    }
  },
}))

vi.mock('@/lib/comms/send', () => ({
  sendCommunication: vi.fn(async () => ({ success: true })),
}))

function makeWhereResult(resolveValue: unknown[]): {
  then: (res: (v: unknown[]) => void, rej?: (e: unknown) => void) => void
  limit: (_n: number) => Promise<unknown[]>
} {
  return {
    then(resolve, _reject) {
      resolve(resolveValue)
    },
    limit: async (_n: number) => resolveValue,
  }
}

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    let selectCallCount = 0
    const tx = {
      select: vi.fn(() => {
        selectCallCount++
        const callNum = selectCallCount
        const resolveValue = callNum === 3 ? [{ m: null }] : []
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => makeWhereResult(resolveValue)),
          })),
        }
      }),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: 'pay_1', paymentNo: 1 }]),
        })),
      })),
    }
    return fn(tx)
  }),
}))

import { handleStripeWebhook } from '@/lib/stripe-webhook'
import { sendCommunication } from '@/lib/comms/send'

describe('payment_receipt from Stripe webhook', () => {
  beforeEach(() => {
    vi.mocked(sendCommunication).mockClear()
  })

  it('fires payment_receipt email on first delivery', async () => {
    const req = new Request('https://example.com/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_receipt_1' }),
      headers: { 'stripe-signature': 'valid_sig' },
    })
    const res = await handleStripeWebhook(req)
    expect(res.status).toBe(200)
    expect(sendCommunication).toHaveBeenCalledTimes(1)
    const call = vi.mocked(sendCommunication).mock.calls[0]
    expect(call[0]).toBe('org_receipt')
    expect(call[1]).toMatchObject({
      triggerType: 'payment_receipt',
      channel: 'email',
      refKind: 'invoice',
    })
  })

  it('does not re-fire on duplicate stripe_event_id', async () => {
    const { withTenant } = await import('@/db/with-tenant')
    vi.mocked(withTenant).mockImplementationOnce(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => [{ id: 'pay_existing' }]),
            limit: vi.fn(() => [{ id: 'pay_existing' }]),
          })),
        })),
      }
      return fn(tx)
    })

    const req = new Request('https://example.com/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_receipt_1' }),
      headers: { 'stripe-signature': 'valid_sig' },
    })
    const res = await handleStripeWebhook(req)
    expect(res.status).toBe(200)
    expect(sendCommunication).not.toHaveBeenCalled()
  })
})
