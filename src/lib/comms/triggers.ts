import { eq, and } from 'drizzle-orm'
import { communicationTriggers, triggerType } from '@/db/schema'
import type { Tx } from '@/db/with-tenant'

export type TriggerType = (typeof triggerType.enumValues)[number]
export type Channel = 'email' | 'sms'

export function mapKindToTrigger(kind: 'estimate' | 'invoice'): TriggerType {
  return kind === 'estimate' ? 'estimate_send' : 'invoice_send'
}

interface TriggerVars {
  companyName?: string | null
  jobNo?: number | null
  estimateNo?: number | null
  invoiceNo?: number | null
  paymentNo?: number | null
}

export function defaultSubjectFor(triggerType: TriggerType, vars: TriggerVars): string {
  const company = vars.companyName ?? "Infantino's Garage Door Service"
  switch (triggerType) {
    case 'job_confirmation':
      return `Your appointment is scheduled — Job #${vars.jobNo ?? ''}`
    case 'tech_notify':
      return `New assignment — Job #${vars.jobNo ?? ''}`
    case 'estimate_send':
      return `Estimate #${vars.estimateNo ?? ''} from ${company}`
    case 'invoice_send':
      return `Invoice #${vars.invoiceNo ?? ''} from ${company}`
    case 'payment_receipt':
      return `Payment receipt — ${vars.paymentNo ?? ''}`
    case 'on_the_way':
      return `Your tech is on the way`
    case 'appointment_reminder':
      return `Reminder: your garage door service appointment`
    default:
      return `Message from ${company}`
  }
}

export async function triggerLookup(
  tx: Tx,
  tenantId: string,
  triggerTypeValue: TriggerType,
  channel: Channel,
) {
  const [row] = await tx
    .select({
      enabled: communicationTriggers.enabled,
      subject: communicationTriggers.subject,
      footerText: communicationTriggers.footerText,
    })
    .from(communicationTriggers)
    .where(
      and(
        eq(communicationTriggers.tenantId, tenantId),
        eq(communicationTriggers.triggerType, triggerTypeValue),
        eq(communicationTriggers.channel, channel),
      ),
    )

  if (!row) {
    return null
  }

  return {
    enabled: row.enabled,
    subject: row.subject,
    footerText: row.footerText,
  }
}
