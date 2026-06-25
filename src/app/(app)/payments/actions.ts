'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and, sql, desc } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import type { Tx } from '@/db/with-tenant'
import {
  payments,
  paymentAllocations,
  invoices,
  jobs,
  customers,
  customerEvents,
  paymentMethods,
} from '@/db/schema'
import { nextPaymentNo } from '@/lib/invoices/invoice-number'
import { logger } from '@/lib/logger'
import { toISODate } from '@/lib/utils'
import { SquareClient, SquareEnvironment } from 'square'

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

const recordPaymentSchema = z.object({
  customerId: z.string().min(1),
  methodId: z.string().min(1),
  amount: z.string().min(1),
  receivedOn: z.string().optional(),
  checkRefNo: z.string().optional(),
  memo: z.string().optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().min(1),
        amountApplied: z.string().min(1),
      }),
    )
    .default([]),
})

function toDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export async function recordPaymentAction(
  orgId: string,
  data: unknown,
): Promise<{ paymentId?: string; paymentNo?: number; error?: string }> {
  const { userId } = await auth()
  if (!userId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = recordPaymentSchema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue?.message ?? 'Invalid input.' }
  }

  const totalApplied = parsed.data.allocations.reduce(
    (sum, a) => sum + parseFloat(a.amountApplied),
    0,
  )
  if (totalApplied > parseFloat(parsed.data.amount) + 0.001) {
    return { error: "Total to Be Applied can't exceed the Amount of Payment." }
  }

  try {
    const result = await withTenant(orgId, async (tx) => {
      const paymentNo = await nextPaymentNo(tx, orgId)
      const [payment] = await tx
        .insert(payments)
        .values({
          tenantId: orgId,
          paymentNo,
          customerId: parsed.data.customerId,
          method: parsed.data.methodId,
          amount: parsed.data.amount,
          checkRefNo: parsed.data.checkRefNo ?? null,
          receivedOn: parsed.data.receivedOn ? toISODate(parsed.data.receivedOn) : null,
          memo: parsed.data.memo ?? null,
          enteredByUserId: userId,
        })
        .returning()

      if (parsed.data.allocations.length > 0) {
        await tx.insert(paymentAllocations).values(
          parsed.data.allocations.map((a) => ({
            tenantId: orgId,
            paymentId: payment.id,
            invoiceId: a.invoiceId,
            amountApplied: a.amountApplied,
          })),
        ).returning()
      }

      await tx.insert(customerEvents).values({
        tenantId: orgId,
        customerId: parsed.data.customerId,
        kind: 'payment',
        title: `Payment #PAY-${paymentNo} of $${parsed.data.amount} recorded`,
        refId: payment.id,
        actor: userId,
      }).returning()

      return { paymentId: payment.id, paymentNo }
    })

    revalidatePath('/payments')
    revalidatePath('/invoices')
    return result
  } catch (err) {
    logger.error('recordPaymentAction', err)
    return { error: extractErrorMessage(err) || 'Could not record payment.' }
  }
}

const squarePaymentInputSchema = z.object({
  invoiceId: z.string().min(1),
  sourceId: z.string().min(1),
  amount: z.number().positive(),
})

function squareClient() {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) throw new Error('Square is not configured.')
  return new SquareClient({
    token,
    environment:
      process.env.NODE_ENV === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  })
}

export async function processSquarePaymentAction(
  orgId: string,
  input: { invoiceId: string; sourceId: string; amount: number },
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = squarePaymentInputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { success: false, error: issue?.message ?? 'Invalid input.' }
  }

  try {
    const client = squareClient()
    const response = await client.payments.create({
      sourceId: parsed.data.sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(parsed.data.amount),
        currency: 'USD',
      },
      note: `Invoice ${parsed.data.invoiceId}`,
    })

    const squarePayment = response.payment
    if (!squarePayment) {
      return { success: false, error: 'Square did not return a payment.' }
    }

    await withTenant(orgId, async (tx) => {
      const [invoice] = await tx
        .select({ customerId: invoices.customerId })
        .from(invoices)
        .where(and(eq(invoices.tenantId, orgId), eq(invoices.id, parsed.data.invoiceId)))
        .limit(1)

      const customerId = invoice?.customerId ?? 'unknown'
      const paymentNo = await nextPaymentNo(tx, orgId)
      const [payment] = await tx
        .insert(payments)
        .values({
          tenantId: orgId,
          paymentNo,
          customerId,
          method: 'on_site_card_square',
          amount: (parsed.data.amount / 100).toFixed(2),
          transactionToken: squarePayment.id,
          squarePaymentId: squarePayment.id,
          enteredByUserId: userId,
        })
        .returning()

      await tx.insert(paymentAllocations).values({
        tenantId: orgId,
        paymentId: payment.id,
        invoiceId: parsed.data.invoiceId,
        amountApplied: (parsed.data.amount / 100).toFixed(2),
      })
    })

    revalidatePath('/invoices')
    revalidatePath(`/invoices/${parsed.data.invoiceId}`)
    return { success: true }
  } catch (err) {
    logger.error('processSquarePaymentAction', err)
    return { success: false, error: extractErrorMessage(err) || 'Payment failed.' }
  }
}

export async function voidPaymentAction(
  orgId: string,
  paymentId: string,
): Promise<{ error?: string }> {
  const { userId } = await auth()
  if (!userId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .delete(paymentAllocations)
        .where(and(eq(paymentAllocations.tenantId, orgId), eq(paymentAllocations.paymentId, paymentId)))
      await tx.delete(payments).where(and(eq(payments.tenantId, orgId), eq(payments.id, paymentId)))
    })

    revalidatePath('/payments')
    revalidatePath('/invoices')
    return {}
  } catch (err) {
    logger.error('voidPaymentAction', err)
    return { error: extractErrorMessage(err) || 'Could not void payment.' }
  }
}

export interface PaymentDetail {
  id: string
  tenantId: string
  paymentNo: number
  customerId: string
  customerName: string | null
  method: string
  amount: string
  checkRefNo: string | null
  receivedOn: string | null
  memo: string | null
  enteredAt: Date | null
  enteredByUserId: string | null
  transactionToken: string | null
  squarePaymentId: string | null
  allocations: Array<{
    id: string
    invoiceId: string
    invoiceNo: number
    jobId: string
    jobNo: number | null
    amountApplied: string
  }>
}

export async function getPaymentAction(
  orgId: string,
  id: string,
): Promise<PaymentDetail | null> {
  return withTenant(orgId, async (tx) => {
    const [payment] = await tx
      .select({
        id: payments.id,
        tenantId: payments.tenantId,
        paymentNo: payments.paymentNo,
        customerId: payments.customerId,
        customerName: customers.name,
        method: payments.method,
        amount: payments.amount,
        checkRefNo: payments.checkRefNo,
        receivedOn: payments.receivedOn,
        memo: payments.memo,
        enteredAt: payments.enteredAt,
        enteredByUserId: payments.enteredByUserId,
        transactionToken: payments.transactionToken,
        squarePaymentId: payments.squarePaymentId,
      })
      .from(payments)
      .leftJoin(customers, and(eq(customers.tenantId, payments.tenantId), eq(customers.id, payments.customerId)))
      .where(and(eq(payments.tenantId, orgId), eq(payments.id, id)))
      .limit(1)

    if (!payment) return null

    const allocations = await tx
      .select({
        id: paymentAllocations.id,
        invoiceId: paymentAllocations.invoiceId,
        invoiceNo: invoices.invoiceNo,
        jobId: invoices.jobId,
        jobNo: jobs.jobNo,
        amountApplied: paymentAllocations.amountApplied,
      })
      .from(paymentAllocations)
      .innerJoin(
        invoices,
        and(eq(invoices.tenantId, paymentAllocations.tenantId), eq(invoices.id, paymentAllocations.invoiceId)),
      )
      .leftJoin(jobs, and(eq(jobs.tenantId, invoices.tenantId), eq(jobs.id, invoices.jobId)))
      .where(and(eq(paymentAllocations.tenantId, orgId), eq(paymentAllocations.paymentId, id)))

    return {
      id: payment.id,
      tenantId: payment.tenantId,
      paymentNo: payment.paymentNo,
      customerId: payment.customerId,
      customerName: payment.customerName ?? null,
      method: payment.method,
      amount: String(payment.amount),
      checkRefNo: payment.checkRefNo ?? null,
      receivedOn: toDateString(payment.receivedOn),
      memo: payment.memo ?? null,
      enteredAt: payment.enteredAt,
      enteredByUserId: payment.enteredByUserId ?? null,
      transactionToken: payment.transactionToken ?? null,
      squarePaymentId: payment.squarePaymentId ?? null,
      allocations: allocations.map((a) => ({
        id: a.id,
        invoiceId: a.invoiceId,
        invoiceNo: a.invoiceNo,
        jobId: a.jobId,
        jobNo: a.jobNo ?? null,
        amountApplied: String(a.amountApplied),
      })),
    }
  })
}

export async function listPaymentMethodsAction(
  orgId: string,
): Promise<{ methods: Array<{ id: string; name: string; isSystem: boolean; isActive: boolean; sortOrder: number }> }> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: paymentMethods.id,
        name: paymentMethods.name,
        isSystem: paymentMethods.isSystem,
        isActive: paymentMethods.isActive,
        sortOrder: paymentMethods.sortOrder,
      })
      .from(paymentMethods)
      .where(eq(paymentMethods.tenantId, orgId))
      .orderBy(paymentMethods.sortOrder, paymentMethods.name)

    return {
      methods: rows.map((r) => ({
        id: r.id,
        name: r.name,
        isSystem: r.isSystem ?? false,
        isActive: r.isActive ?? true,
        sortOrder: r.sortOrder ?? 0,
      })),
    }
  })
}

export async function seedDefaultPaymentMethodsAction(orgId: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  await withTenant(orgId, async (tx) => {
    const existing = await tx
      .select({ count: sql<number>`COUNT(*)`.as('count') })
      .from(paymentMethods)
      .where(eq(paymentMethods.tenantId, orgId))
      .limit(1)

    if ((existing[0]?.count ?? 0) > 0) return

    await tx.insert(paymentMethods).values([
      { tenantId: orgId, name: 'Cash', isSystem: false, isActive: true, sortOrder: 0 },
      { tenantId: orgId, name: 'Check', isSystem: false, isActive: true, sortOrder: 1 },
      { tenantId: orgId, name: 'Zelle', isSystem: false, isActive: true, sortOrder: 2 },
      { tenantId: orgId, name: 'Venmo', isSystem: false, isActive: true, sortOrder: 3 },
      { tenantId: orgId, name: 'Credit Card (Stripe)', isSystem: true, isActive: true, sortOrder: 4 },
      { tenantId: orgId, name: 'On-Site Card (Square)', isSystem: true, isActive: true, sortOrder: 5 },
    ])
  })
}
