import { eq, and, sql } from 'drizzle-orm'
import { after } from 'next/server'
import { withTenant } from '@/db/with-tenant'
import { payments, paymentAllocations, invoices, customers, customerEvents } from '@/db/schema'
import { nextPaymentNo } from '@/lib/invoices/invoice-number'
import { logger } from '@/lib/logger'
import { sendCommunication } from '@/lib/comms/send'
import type Stripe from 'stripe'

function getStripeSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? ''
}

async function getStripe() {
  const Stripe = (await import('stripe')).default
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2026-06-24.dahlia',
  })
}

interface PaymentInfo {
  tenantId: string
  invoiceId: string | null
  customerId: string | null
  amountCents: number
  stripePaymentIntentId: string | null
}

function extractPaymentInfo(event: Stripe.Event): PaymentInfo | null {
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const metadata = (pi.metadata ?? {}) as Record<string, string>
    return {
      tenantId: metadata.tenant_id ?? metadata.orgId ?? '',
      invoiceId: metadata.invoice_id ?? metadata.invoiceId ?? null,
      customerId: metadata.customer_id ?? metadata.customerId ?? null,
      amountCents: pi.amount_received,
      stripePaymentIntentId: pi.id,
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const metadata = session.metadata ?? {}
    return {
      tenantId: metadata.tenant_id ?? metadata.orgId ?? '',
      invoiceId: metadata.invoice_id ?? metadata.invoiceId ?? null,
      customerId: metadata.customer_id ?? metadata.customerId ?? null,
      amountCents: session.amount_total ?? 0,
      stripePaymentIntentId: (session.payment_intent as string | null) ?? null,
    }
  }

  return null
}

function toCents(value: string | number | null | undefined): number {
  return Math.round(parseFloat(String(value ?? '0')) * 100)
}

async function recordStripePayment(
  tenantId: string,
  info: PaymentInfo,
  event: Stripe.Event,
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    // Guard 1: dedup by exact stripe event id (handles literal event replays)
    const existing = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.stripeEventId, event.id)))
      
    if (existing.length > 0) {
      return
    }

    // Guard 2: cross-event-type dedup by payment_intent id (CR-02 / T-07-20)
    // payment_intent.succeeded and checkout.session.completed share the same
    // payment_intent id; deduping by stripeEventId alone misses this case.
    if (info.stripePaymentIntentId) {
      const existingByToken = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.transactionToken, info.stripePaymentIntentId),
          ),
        )
        
      if (existingByToken.length > 0) {
        return
      }
    }

    let customerId = info.customerId
    if (!customerId && info.invoiceId) {
      const [invoiceCustomer] = await tx
        .select({ customerId: invoices.customerId })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, info.invoiceId)))
              customerId = invoiceCustomer?.customerId ?? null
    }

    if (!customerId) {
      throw new Error('Stripe webhook: unable to determine customer for payment.')
    }

    const amountDollars = (info.amountCents / 100).toFixed(2)
    const paymentNo = await nextPaymentNo(tx, tenantId)
    const [payment] = await tx
      .insert(payments)
      .values({
        tenantId,
        paymentNo,
        customerId,
        method: 'stripe',
        amount: amountDollars,
        stripeEventId: event.id,
        transactionToken: info.stripePaymentIntentId,
        enteredByUserId: 'stripe_webhook',
      })
      .returning()

    if (info.invoiceId) {
      // Cap allocation at invoice open balance (T-07-19)
      const [invRow] = await tx
        .select({ total: invoices.total })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, info.invoiceId)))
        
      let allocCents = info.amountCents
      if (invRow) {
        const [sumRow] = await tx
          .select({ sum: sql<string>`COALESCE(SUM(${paymentAllocations.amountApplied}), '0')`.as('sum') })
          .from(paymentAllocations)
          .where(and(eq(paymentAllocations.tenantId, tenantId), eq(paymentAllocations.invoiceId, info.invoiceId)))
        const alreadyAppliedCents = toCents(sumRow?.sum ?? '0')
        const openBalanceCents = toCents(invRow.total) - alreadyAppliedCents
        allocCents = Math.min(info.amountCents, Math.max(0, openBalanceCents))
      }

      if (allocCents > 0) {
        await tx.insert(paymentAllocations).values({
          tenantId,
          paymentId: payment.id,
          invoiceId: info.invoiceId,
          amountApplied: (allocCents / 100).toFixed(2),
        })
      }
    }

    await tx.insert(customerEvents).values({
      tenantId,
      customerId,
      kind: 'payment',
      title: `Payment #PAY-${paymentNo} of $${amountDollars} recorded via Stripe`,
      refId: payment.id,
      actor: 'stripe_webhook',
    })

    const firePaymentReceipt = () =>
      sendCommunication(tenantId, {
        triggerType: 'payment_receipt',
        channel: 'email',
        refKind: 'invoice',
        refId: payment.id,
        customerId,
      }).catch((e) => logger.error('payment_receipt send', e))

    try {
      after(firePaymentReceipt)
    } catch {
      // Not running inside a Next.js request scope (e.g. unit tests) — run inline.
      firePaymentReceipt()
    }
  })
}

export async function handleStripeWebhook(req: Request): Promise<Response> {
  const secret = getStripeSecret()
  // Fix: use truthy check so empty string (missing env var) returns 500
  if (!secret) {
    logger.error('handleStripeWebhook', new Error('STRIPE_WEBHOOK_SECRET is not set'))
    return new Response('Webhook secret not configured.', { status: 500 })
  }

  let payload: string
  try {
    payload = await req.text()
  } catch (err) {
    logger.error('handleStripeWebhook read body', err)
    return new Response('Unable to read body.', { status: 400 })
  }

  const signature = req.headers.get('stripe-signature') ?? ''
  if (!signature) {
    return new Response('Missing stripe-signature header.', { status: 400 })
  }

  let event: Stripe.Event
  try {
    const stripe = await getStripe()
    event = stripe.webhooks.constructEvent(payload, signature, secret)
  } catch (err) {
    logger.error('handleStripeWebhook verification', err)
    return new Response('Invalid signature.', { status: 400 })
  }

  const info = extractPaymentInfo(event)
  if (!info || !info.tenantId) {
    return new Response('Event ignored.', { status: 200 })
  }

  try {
    await recordStripePayment(info.tenantId, info, event)
    return new Response('OK', { status: 200 })
  } catch (err) {
    const code = (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code
    if (code === '23505') {
      return new Response('Duplicate event ignored.', { status: 200 })
    }
    logger.error('handleStripeWebhook record payment', err)
    return new Response('Internal error.', { status: 500 })
  }
}
