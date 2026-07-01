import * as React from 'react'
import { render } from '@react-email/render'
import { pdf } from '@react-pdf/renderer'
import { withTenant } from '@/db/with-tenant'
import {
  communicationLogs,
  customerEvents,
  communicationSettings,
  tenants,
  payments,
  invoices,
  estimates,
  jobs,
  customers,
  paymentAllocations,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getResend } from './resend'
import { getTwilio } from './twilio'
import { triggerLookup, defaultSubjectFor, type TriggerType, type Channel } from './triggers'
import { resolveEmailRecipient, resolveSmsRecipient, resolveTechEmail } from '@/app/(app)/communications/recipients'
import { JobConfirmationEmail } from '@/lib/emails/job-confirmation'
import { TechNotifyEmail } from '@/lib/emails/tech-notify'
import { EstimateSendEmail } from '@/lib/emails/estimate-send'
import { InvoiceSendEmail } from '@/lib/emails/invoice-send'
import { PaymentReceiptEmail } from '@/lib/emails/payment-receipt'
import { CustomBodyEmail } from '@/lib/emails/custom-body'
import { getInvoiceForPdf } from '@/lib/invoices/pdf-data'
import { getEstimateForPdf } from '@/lib/estimates/pdf-data'
import { InvoicePdfDocument } from '@/components/invoices/invoice-pdf'
import { EstimatePdfDocument } from '@/components/pdf/estimate-pdf'

export interface InternalSendInput {
  triggerType: TriggerType
  channel: Channel
  refKind: 'estimate' | 'invoice' | 'job'
  refId: string
  customerId?: string
  to?: string
  toExtra?: string[]
  bcc?: string
  subject?: string
  body?: string
  bodyHtml?: string
  noAttachment?: boolean
  extraAttachments?: Array<{ filename: string; content: string }>
  actor?: string
}

function senderFrom(emailSenderName: string | null | undefined): string {
  const name = emailSenderName ?? "Infantino's Garage Door Service"
  return `"${name}" <contact@infantinosgaragedoor.com>`
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildHtmlWrapper(companyName: string, bodyHtml: string, footerText?: string | null): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px">
<div style="background-color:#ffffff;border-radius:8px;max-width:600px;margin:0 auto;padding:24px">
  <p style="font-size:20px;font-weight:600;margin:0 0 16px;color:#0f172a">${escHtml(companyName)}</p>
  <div style="font-size:14px;line-height:1.6;color:#1e293b">${bodyHtml}</div>
  ${footerText ? `<p style="margin-top:24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px">${escHtml(footerText)}</p>` : ''}
</div>
</body></html>`
}

async function buildEmailBody(
  triggerType: TriggerType,
  tenantId: string,
  refId: string,
  customerId: string | undefined,
  footerText: string | null | undefined,
  tx: any,
): Promise<{ html: string; subjectVars: Record<string, string | number | null> }> {
  const [company] = await tx
    .select({ companyName: tenants.companyName })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    
  const companyName = company?.companyName ?? "Infantino's Garage Door Service"

  const subjectVars: Record<string, string | number | null> = { companyName }

  switch (triggerType) {
    case 'job_confirmation': {
      const [job] = await tx
        .select({ jobNo: jobs.jobNo, arrivalWindowStart: jobs.arrivalWindowStart, startDate: jobs.startDate })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, refId)))
              const scheduledDate = formatInstant(job?.arrivalWindowStart ?? job?.startDate)
      subjectVars.jobNo = job?.jobNo ?? null
      const customer = customerId ? await getCustomerName(tx, tenantId, customerId) : null
      const address = await getJobAddress(tx, tenantId, refId)
      const html = await render(
        <JobConfirmationEmail
          jobNo={job?.jobNo ?? 0}
          customerName={customer ?? 'Customer'}
          scheduledDate={scheduledDate}
          address={address}
          companyName={companyName}
          footerText={footerText}
        />,
      )
      return { html, subjectVars }
    }

    case 'tech_notify': {
      const [job] = await tx
        .select({ jobNo: jobs.jobNo, customerId: jobs.customerId })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, refId)))
              subjectVars.jobNo = job?.jobNo ?? null
      const customer = job?.customerId ? await getCustomerName(tx, tenantId, job.customerId) : null
      const address = await getJobAddress(tx, tenantId, refId)
      const techEmail = await resolveTechEmail(tx, tenantId, refId)
      const techName = techEmail ?? 'Technician'
      const html = await render(
        <TechNotifyEmail
          jobNo={job?.jobNo ?? 0}
          customerName={customer ?? 'Customer'}
          address={address}
          assignedTechName={techName}
          companyName={companyName}
        />,
      )
      return { html, subjectVars }
    }

    case 'estimate_send': {
      const [estimate] = await tx
        .select({ estimateNo: estimates.estimateNo, customerId: estimates.customerId })
        .from(estimates)
        .where(and(eq(estimates.tenantId, tenantId), eq(estimates.id, refId)))
              subjectVars.estimateNo = estimate?.estimateNo ?? null
      const customer = estimate?.customerId ? await getCustomerName(tx, tenantId, estimate.customerId) : null
      const pdfData = await getEstimateForPdf(tenantId, refId)
      const html = await render(
        <EstimateSendEmail
          estimateNo={estimate?.estimateNo ?? 0}
          customerName={customer ?? 'Customer'}
          total={pdfData?.grandTotal ?? '$0.00'}
          companyName={companyName}
          footerText={footerText}
        />,
      )
      return { html, subjectVars }
    }

    case 'invoice_send': {
      const [invoice] = await tx
        .select({ invoiceNo: invoices.invoiceNo, customerId: invoices.customerId })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, refId)))
              subjectVars.invoiceNo = invoice?.invoiceNo ?? null
      const customer = invoice?.customerId ? await getCustomerName(tx, tenantId, invoice.customerId) : null
      const pdfData = await getInvoiceForPdf(tenantId, refId)
      const html = await render(
        <InvoiceSendEmail
          invoiceNo={invoice?.invoiceNo ?? 0}
          customerName={customer ?? 'Customer'}
          total={pdfData?.total ?? '$0.00'}
          balance={pdfData?.balance ?? '$0.00'}
          companyName={companyName}
          footerText={footerText}
        />,
      )
      return { html, subjectVars }
    }

    case 'payment_receipt': {
      // refId for payment_receipt is the payment id.
      const [payment] = await tx
        .select({ paymentNo: payments.paymentNo, amount: payments.amount })
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.id, refId)))
              let invoiceNo = 0
      const [allocation] = await tx
        .select({ invoiceId: paymentAllocations.invoiceId })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.tenantId, tenantId), eq(paymentAllocations.paymentId, refId)))
        .orderBy(desc(paymentAllocations.amountApplied))
              if (allocation?.invoiceId) {
        const [inv] = await tx
          .select({ invoiceNo: invoices.invoiceNo })
          .from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, allocation.invoiceId)))
                  if (inv) invoiceNo = inv.invoiceNo
      }
      subjectVars.paymentNo = payment?.paymentNo ?? null
      const html = await render(
        <PaymentReceiptEmail
          paymentNo={payment?.paymentNo ?? 0}
          invoiceNo={invoiceNo}
          amountPaid={String(payment?.amount ?? '0.00')}
          companyName={companyName}
        />,
      )
      return { html, subjectVars }
    }

    default: {
      const html = await render(
        <JobConfirmationEmail
          jobNo={0}
          customerName="Customer"
          scheduledDate=""
          address=""
          companyName={companyName}
          footerText={footerText}
        />,
      )
      return { html, subjectVars }
    }
  }
}

async function buildSmsBody(
  triggerType: TriggerType,
  tenantId: string,
  refId: string,
  tx: any,
): Promise<string> {
  const [company] = await tx
    .select({ companyName: tenants.companyName })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
      const companyName = company?.companyName ?? "Infantino's Garage Door Service"

  if (triggerType === 'on_the_way') {
    const [job] = await tx
      .select({ arrivalWindowStart: jobs.arrivalWindowStart, arrivalWindowEnd: jobs.arrivalWindowEnd })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, refId)))
          const window = formatWindow(job?.arrivalWindowStart, job?.arrivalWindowEnd)
    return `Your tech is on the way! Estimated arrival: ${window}. — ${companyName}`
  }

  if (triggerType === 'appointment_reminder') {
    const [job] = await tx
      .select({ arrivalWindowStart: jobs.arrivalWindowStart, startDate: jobs.startDate })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, refId)))
          const when = formatInstant(job?.arrivalWindowStart ?? job?.startDate)
    return `Reminder: your garage door service is scheduled for ${when}. — ${companyName}`
  }

  return `Message from ${companyName}`
}

async function renderPdfAttachment(
  triggerType: TriggerType,
  tenantId: string,
  refId: string,
): Promise<{ filename: string; content: string } | null> {
  if (triggerType === 'estimate_send') {
    const data = await getEstimateForPdf(tenantId, refId)
    if (!data) return null
    const element = React.createElement(EstimatePdfDocument, { data })
    const blob = await pdf(element as any).toBlob()
    const buffer = Buffer.from(await blob.arrayBuffer())
    return { filename: `estimate-${data.estimateNo}.pdf`, content: buffer.toString('base64') }
  }

  if (triggerType === 'invoice_send') {
    const data = await getInvoiceForPdf(tenantId, refId)
    if (!data) return null
    const element = React.createElement(InvoicePdfDocument, { data })
    const blob = await pdf(element as any).toBlob()
    const buffer = Buffer.from(await blob.arrayBuffer())
    return { filename: `invoice-${data.invoiceNo}.pdf`, content: buffer.toString('base64') }
  }

  return null
}

export async function sendCommunication(
  tenantId: string,
  input: InternalSendInput,
): Promise<{ skipped?: boolean; success: boolean; error?: string; providerMessageId?: string }> {
  return withTenant(tenantId, async (tx) => {
    const trigger = await triggerLookup(tx, tenantId, input.triggerType, input.channel)
    if (!trigger || trigger.enabled === false) {
      return { skipped: true, success: true }
    }

    const [settings] = await tx
      .select({ emailSenderName: communicationSettings.emailSenderName, smsPhoneNumber: communicationSettings.smsPhoneNumber })
      .from(communicationSettings)
      .where(eq(communicationSettings.tenantId, tenantId))
      
    let recipient: { email: string; contactId?: string } | { phone: string; contactId: string } | null = null
    if (input.channel === 'email') {
      if (input.triggerType === 'tech_notify') {
        const techEmail = await resolveTechEmail(tx, tenantId, input.refId)
        recipient = techEmail ? { email: techEmail } : null
      } else {
        recipient = await resolveEmailRecipient(tx, tenantId, input.refKind, input.refId, input.to)
      }
    } else {
      recipient = await resolveSmsRecipient(tx, tenantId, input.refKind, input.refId)
    }

    if (input.channel === 'sms' && !recipient) {
      await tx.insert(communicationLogs).values({
        tenantId,
        customerId: input.customerId,
        refKind: input.refKind,
        refId: input.refId,
        triggerType: input.triggerType,
        channel: input.channel,
        status: 'failed',
        errorMessage: 'no consented recipient',
      })
      return { success: false, error: 'no consented recipient' }
    }

    if (input.channel === 'email' && !recipient) {
      await tx.insert(communicationLogs).values({
        tenantId,
        customerId: input.customerId,
        refKind: input.refKind,
        refId: input.refId,
        triggerType: input.triggerType,
        channel: input.channel,
        status: 'failed',
        errorMessage: 'no email recipient',
      })
      return { success: false, error: 'no email recipient' }
    }

    const toAddress =
      input.channel === 'email'
        ? (recipient as Extract<typeof recipient, { email: string }>).email
        : (recipient as Extract<typeof recipient, { phone: string }>).phone

    try {
      let providerMessageId: string | undefined

      if (input.channel === 'email') {
        let html: string
        let subjectVars: Record<string, string | number | null> = {}

        if (input.bodyHtml) {
          const [company] = await tx
            .select({ companyName: tenants.companyName })
            .from(tenants)
            .where(eq(tenants.id, tenantId))
          const companyName = company?.companyName ?? "Infantino's Garage Door Service"
          html = buildHtmlWrapper(companyName, input.bodyHtml, trigger?.footerText)
          subjectVars = { companyName }
        } else if (input.body) {
          const [company] = await tx
            .select({ companyName: tenants.companyName })
            .from(tenants)
            .where(eq(tenants.id, tenantId))
          const companyName = company?.companyName ?? "Infantino's Garage Door Service"
          html = await render(
            <CustomBodyEmail
              companyName={companyName}
              body={input.body}
              footerText={trigger.footerText}
            />,
          )
          subjectVars = { companyName }
        } else {
          const result = await buildEmailBody(
            input.triggerType,
            tenantId,
            input.refId,
            input.customerId,
            trigger.footerText,
            tx,
          )
          html = result.html
          subjectVars = result.subjectVars
        }

        const subject = input.subject ?? trigger.subject ?? defaultSubjectFor(input.triggerType, subjectVars)
        const pdfAttachment = input.noAttachment ? null : await renderPdfAttachment(input.triggerType, tenantId, input.refId)
        const allAttachments = [
          ...(pdfAttachment ? [pdfAttachment] : []),
          ...(input.extraAttachments ?? []),
        ]
        const toAddresses: string | string[] = input.toExtra?.length
          ? [toAddress, ...input.toExtra]
          : toAddress
        const resend = await getResend()
        const result = await resend.emails.send({
          from: senderFrom(settings?.emailSenderName),
          to: toAddresses,
          ...(input.bcc ? { bcc: input.bcc } : {}),
          subject,
          html,
          attachments: allAttachments.length ? allAttachments : undefined,
        })
        if (result.error) {
          throw new Error(result.error.message)
        }
        providerMessageId = result.data?.id
      } else {
        const body = input.body ?? (await buildSmsBody(input.triggerType, tenantId, input.refId, tx))
        const twilio = await getTwilio()
        const result = await twilio.messages.create({
          body,
          from: settings?.smsPhoneNumber ?? '',
          to: toAddress,
        })
        providerMessageId = result.sid
      }

      await tx.insert(communicationLogs).values({
        tenantId,
        customerId: input.customerId,
        refKind: input.refKind,
        refId: input.refId,
        triggerType: input.triggerType,
        channel: input.channel,
        toAddress,
        status: 'sent',
        providerMessageId,
      })

      if (input.customerId) {
        await tx.insert(customerEvents).values({
          tenantId,
          customerId: input.customerId,
          kind: 'email',
          title: eventTitle(input.triggerType, input.channel),
          refId: input.refId,
          actor: input.actor ?? 'System',
        })
      }

      return { success: true, providerMessageId }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('sendCommunication', err)
      await tx.insert(communicationLogs).values({
        tenantId,
        customerId: input.customerId,
        refKind: input.refKind,
        refId: input.refId,
        triggerType: input.triggerType,
        channel: input.channel,
        toAddress,
        status: 'failed',
        errorMessage: message,
      })
      return { success: false, error: message }
    }
  })
}

async function getCustomerName(tx: any, tenantId: string, customerId: string): Promise<string | null> {
  const [row] = await tx
    .select({ name: customers.name })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
      return row?.name ?? null
}

async function getJobAddress(tx: any, tenantId: string, jobId: string): Promise<string> {
  const [job] = await tx
    .select({ serviceLocationId: jobs.serviceLocationId })
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)))
      if (!job?.serviceLocationId) return ''
  const { serviceLocations } = await import('@/db/schema')
  const [loc] = await tx
    .select({
      addressLine1: serviceLocations.addressLine1,
      addressLine2: serviceLocations.addressLine2,
      city: serviceLocations.city,
      state: serviceLocations.state,
      postalCode: serviceLocations.postalCode,
    })
    .from(serviceLocations)
    .where(and(eq(serviceLocations.tenantId, tenantId), eq(serviceLocations.id, job.serviceLocationId)))
      if (!loc) return ''
  return [loc.addressLine1, loc.addressLine2, loc.city, loc.state, loc.postalCode]
    .filter(Boolean)
    .join(', ')
}

function formatInstant(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatWindow(start: Date | string | null | undefined, end: Date | string | null | undefined): string {
  if (!start) return ''
  const s = typeof start === 'string' ? new Date(start) : start
  const text = s.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  if (!end) return text
  const e = typeof end === 'string' ? new Date(end) : end
  return `${text} - ${e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function eventTitle(triggerType: TriggerType, channel: string): string {
  const label = triggerType.replace(/_/g, ' ')
  return `${channel === 'email' ? 'Email' : 'SMS'} sent: ${label.charAt(0).toUpperCase() + label.slice(1)}`
}
