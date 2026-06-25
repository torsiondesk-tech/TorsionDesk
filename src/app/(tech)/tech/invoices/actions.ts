'use server'

import { auth } from '@clerk/nextjs/server'
import { logger } from '@/lib/logger'
import type { CachedInvoice } from '@/app/(tech)/lib/dexie'
import type { InvoiceRow } from '@/app/(app)/invoices/actions'

export interface SendCommunicationInput {
  kind: 'estimate' | 'invoice'
  refId: string
  channel: 'email' | 'sms'
  to: string
  subject?: string
  body?: string
}

export interface SquarePaymentInput {
  invoiceId: string
  sourceId: string
  amount: number
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    if (cause instanceof Error) return cause.message
    return err.message
  }
  return String(err)
}

function isPhaseMissing(err: unknown): boolean {
  const message = extractErrorMessage(err)
  return /cannot find module|cannot resolve|no such file or directory|failed to resolve|is not a function|not available yet/i.test(
    message,
  )
}

/**
 * PWA wrapper for the canonical Phase 7 createInvoiceFromJobAction.
 *
 * Delegates to `src/app/(app)/invoices/actions` when Phase 7 ships. Until then
 * the module does not exist, so we return a safe "not available" error for
 * online attempts; offline attempts are still queued in the Dexie outbox and
 * will flush automatically once the backend action is present.
 */
export async function createInvoiceFromJobAction(
  jobId: string,
): Promise<{ success: false; error: string } | { success: true; invoiceId?: string }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { success: false, error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const mod = (await import('@/app/(app)/invoices/actions')) as {
      createInvoiceFromJobAction?: (orgId: string, jobId: string) => Promise<{ invoiceId: string }>
    }
    if (typeof mod.createInvoiceFromJobAction !== 'function') {
      return { success: false, error: 'Invoices are not available yet.' }
    }
    const result = await mod.createInvoiceFromJobAction(orgId, jobId)
    return { success: true, invoiceId: result.invoiceId }
  } catch (err) {
    const message = extractErrorMessage(err)
    if (isPhaseMissing(err)) {
      return { success: false, error: 'Invoices are not available yet.' }
    }
    logger.error('createInvoiceFromJobAction', err)
    return { success: false, error: message }
  }
}

/**
 * PWA wrapper for the canonical Phase 8 sendCustomerCommunicationAction.
 *
 * Shared by office and PWA send buttons; per-trigger settings are applied
 * server-side by the canonical action.
 */
export async function sendCustomerCommunicationAction(
  input: SendCommunicationInput,
): Promise<{ success: false; error: string } | { success: true }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { success: false, error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const mod = (await import('@/app/(app)/communications/actions')) as {
      sendCustomerCommunicationAction?: (orgId: string, input: SendCommunicationInput) => Promise<{ success: boolean }>
    }
    if (typeof mod.sendCustomerCommunicationAction !== 'function') {
      return { success: false, error: 'Sending is not available yet.' }
    }
    const result = await mod.sendCustomerCommunicationAction(orgId, input)
    if (result.success) {
      return { success: true }
    }
    return { success: false, error: 'Send failed.' }
  } catch (err) {
    const message = extractErrorMessage(err)
    if (isPhaseMissing(err)) {
      return { success: false, error: 'Sending is not available yet.' }
    }
    logger.error('sendCustomerCommunicationAction', err)
    return { success: false, error: message }
  }
}

/**
 * PWA wrapper for the canonical Phase 7 Square payment action.
 *
 * The Square Web Payments SDK tokenizes the customer's card in the browser and
 * sends the one-time sourceId to this dedicated audited action. The server
 * (with the server-only SQUARE_ACCESS_TOKEN) authorizes the payment and writes
 * the canonical ledger. The token is never persisted to disk.
 */
export async function squarePaymentAction(
  input: SquarePaymentInput,
): Promise<{ success: false; error: string } | { success: true }> {
  const { orgId } = await auth()
  if (!orgId) {
    return { success: false, error: 'No active organization. Please sign in to your workspace.' }
  }

  try {
    const mod = (await import('@/app/(app)/payments/actions')) as {
      processSquarePaymentAction?: (orgId: string, input: SquarePaymentInput) => Promise<{ success: boolean }>
    }
    if (typeof mod.processSquarePaymentAction !== 'function') {
      return { success: false, error: 'Payments are not available yet.' }
    }
    const result = await mod.processSquarePaymentAction(orgId, input)
    if (result.success) {
      return { success: true }
    }
    return { success: false, error: 'Payment failed.' }
  } catch (err) {
    const message = extractErrorMessage(err)
    if (isPhaseMissing(err)) {
      return { success: false, error: 'Payments are not available yet.' }
    }
    logger.error('squarePaymentAction', err)
    return { success: false, error: message }
  }
}

/**
 * PWA wrapper for listing invoices. Delegates to Phase 7 when present.
 */
export async function listTechInvoicesAction(
  orgId: string,
  _userId: string,
): Promise<{ rows: CachedInvoice[]; error?: string }> {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    return { rows: [], error: 'Unauthorized' }
  }

  try {
    const { listInvoicesAction } = (await import('@/app/(app)/invoices/actions')) as {
      listInvoicesAction: (orgId: string) => Promise<{ rows: InvoiceRow[] }>
    }
    if (typeof listInvoicesAction !== 'function') {
      return { rows: [], error: 'Invoices are not available yet.' }
    }
    const { rows } = await listInvoicesAction(orgId)
    return {
      rows: rows.map(
        (r): CachedInvoice => ({
          id: r.id,
          tenantId: r.tenantId,
          jobId: r.jobId,
          customerId: r.customerId,
          customerName: r.customerName,
          invoiceNo: r.invoiceNo,
          status: r.status,
          total: r.total,
          balance: Math.round(parseFloat(r.balance) * 100),
          issuedAt: r.invoiceDate,
          dueAt: r.dueDate,
          paidAt: r.balance === '0.00' ? new Date().toISOString() : null,
          notes: null,
        }),
      ),
    }
  } catch (err) {
    const message = extractErrorMessage(err)
    if (isPhaseMissing(err)) {
      return { rows: [], error: 'Invoices are not available yet.' }
    }
    logger.error('listTechInvoicesAction', err)
    return { rows: [], error: message }
  }
}
