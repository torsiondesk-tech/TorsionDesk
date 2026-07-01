'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@clerk/nextjs/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '@/db/with-tenant'
import { communicationTriggers, communicationSettings, triggerType } from '@/db/schema'
import { sendCommunication, type InternalSendInput } from '@/lib/comms/send'
import { mapKindToTrigger } from '@/lib/comms/triggers'
import { logger } from '@/lib/logger'
import type { SendCommunicationInput } from '@/app/(tech)/tech/invoices/actions'

export async function sendCustomerCommunicationAction(
  orgId: string,
  input: SendCommunicationInput,
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    const triggerType = mapKindToTrigger(input.kind)
    const internal: InternalSendInput = {
      triggerType,
      channel: input.channel,
      refKind: input.kind,
      refId: input.refId,
      to: input.to,
      subject: input.subject,
      body: input.body,
    }

    const result = await sendCommunication(orgId, internal)
    return { success: result.success, error: result.error, skipped: result.skipped }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('sendCustomerCommunicationAction', err)
    return { success: false, error: message }
  }
}

export async function sendJobConfirmationAction(
  orgId: string,
  jobId: string,
  customerId: string,
): Promise<{ success: boolean; error?: string }> {
  return sendCommunication(orgId, {
    triggerType: 'job_confirmation',
    channel: 'email',
    refKind: 'job',
    refId: jobId,
    customerId,
  })
}

export async function sendTechNotifyAction(
  orgId: string,
  jobId: string,
  customerId: string,
): Promise<{ success: boolean; error?: string }> {
  return sendCommunication(orgId, {
    triggerType: 'tech_notify',
    channel: 'email',
    refKind: 'job',
    refId: jobId,
    customerId,
  })
}

export async function sendOnTheWaySmsAction(
  orgId: string,
  jobId: string,
  customerId: string,
): Promise<{ success: boolean; error?: string }> {
  return sendCommunication(orgId, {
    triggerType: 'on_the_way',
    channel: 'sms',
    refKind: 'job',
    refId: jobId,
    customerId,
  })
}

export async function sendPaymentReceiptAction(
  orgId: string,
  paymentId: string,
  customerId: string,
): Promise<{ success: boolean; error?: string }> {
  return sendCommunication(orgId, {
    triggerType: 'payment_receipt',
    channel: 'email',
    refKind: 'invoice',
    refId: paymentId,
    customerId,
  })
}

const TRIGGER_DEFAULTS = [
  { triggerType: 'job_confirmation', channel: 'email', enabled: true },
  { triggerType: 'tech_notify', channel: 'email', enabled: true },
  { triggerType: 'estimate_send', channel: 'email', enabled: true },
  { triggerType: 'estimate_send', channel: 'sms', enabled: false },
  { triggerType: 'invoice_send', channel: 'email', enabled: true },
  { triggerType: 'invoice_send', channel: 'sms', enabled: false },
  { triggerType: 'payment_receipt', channel: 'email', enabled: true },
  { triggerType: 'on_the_way', channel: 'sms', enabled: true },
  { triggerType: 'appointment_reminder', channel: 'sms', enabled: false },
] as const

export async function backfillCommunicationDefaultsAction(orgId: string): Promise<{ success: boolean }> {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    return { success: false }
  }

  return withTenant(orgId, async (tx) => {
    await tx
      .insert(communicationTriggers)
      .values(TRIGGER_DEFAULTS.map((d) => ({ tenantId: orgId, ...d })))
      .onConflictDoNothing()

    await tx
      .insert(communicationSettings)
      .values({ tenantId: orgId })
      .onConflictDoNothing()

    return { success: true }
  })
}

export async function listEmailTriggersAction(orgId: string): Promise<{
  triggers: Array<{
    id: string
    triggerType: string
    channel: string
    enabled: boolean
    subject: string | null
    footerText: string | null
  }>
  settings: { emailSenderName: string | null }
}> {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    return { triggers: [], settings: { emailSenderName: null } }
  }

  await backfillCommunicationDefaultsAction(orgId)

  return withTenant(orgId, async (tx) => {
    const triggers = await tx
      .select({
        id: communicationTriggers.id,
        triggerType: communicationTriggers.triggerType,
        channel: communicationTriggers.channel,
        enabled: communicationTriggers.enabled,
        subject: communicationTriggers.subject,
        footerText: communicationTriggers.footerText,
      })
      .from(communicationTriggers)
      .where(and(eq(communicationTriggers.tenantId, orgId), eq(communicationTriggers.channel, 'email')))

    const [settings] = await tx
      .select({ emailSenderName: communicationSettings.emailSenderName })
      .from(communicationSettings)
      .where(eq(communicationSettings.tenantId, orgId))

    return { triggers, settings: { emailSenderName: settings?.emailSenderName ?? null } }
  })
}

export async function listSmsTriggersAction(orgId: string): Promise<{
  triggers: Array<{
    id: string
    triggerType: string
    channel: string
    enabled: boolean
    subject: string | null
    footerText: string | null
  }>
  settings: { smsPhoneNumber: string | null }
}> {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    return { triggers: [], settings: { smsPhoneNumber: null } }
  }

  await backfillCommunicationDefaultsAction(orgId)

  return withTenant(orgId, async (tx) => {
    const triggers = await tx
      .select({
        id: communicationTriggers.id,
        triggerType: communicationTriggers.triggerType,
        channel: communicationTriggers.channel,
        enabled: communicationTriggers.enabled,
        subject: communicationTriggers.subject,
        footerText: communicationTriggers.footerText,
      })
      .from(communicationTriggers)
      .where(and(eq(communicationTriggers.tenantId, orgId), eq(communicationTriggers.channel, 'sms')))

    const [settings] = await tx
      .select({ smsPhoneNumber: communicationSettings.smsPhoneNumber })
      .from(communicationSettings)
      .where(eq(communicationSettings.tenantId, orgId))

    return { triggers, settings: { smsPhoneNumber: settings?.smsPhoneNumber ?? null } }
  })
}

const updateTriggerSchema = z.object({
  triggerType: z.enum(triggerType.enumValues),
  channel: z.enum(['email', 'sms']),
  enabled: z.boolean(),
  subject: z.string().optional(),
  footerText: z.string().optional(),
})

export async function updateTriggerAction(
  orgId: string,
  input: z.infer<typeof updateTriggerSchema>,
): Promise<{ success: boolean; error?: string }> {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = updateTriggerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .update(communicationTriggers)
        .set({
          enabled: parsed.data.enabled,
          subject: parsed.data.subject ?? null,
          footerText: parsed.data.footerText ?? null,
        })
        .where(
          and(
            eq(communicationTriggers.tenantId, orgId),
            eq(communicationTriggers.triggerType, parsed.data.triggerType),
            eq(communicationTriggers.channel, parsed.data.channel),
          ),
        )
    })
    revalidatePath('/settings/email')
    revalidatePath('/settings/sms')
    return { success: true }
  } catch (err) {
    logger.error('updateTriggerAction', err)
    return { success: false, error: 'Failed to update trigger' }
  }
}

const updateSettingsSchema = z.object({
  emailSenderName: z.string().optional(),
  smsPhoneNumber: z.string().optional(),
})

export async function updateCommunicationSettingsAction(
  orgId: string,
  input: z.infer<typeof updateSettingsSchema>,
): Promise<{ success: boolean; error?: string }> {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = updateSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .insert(communicationSettings)
        .values({ tenantId: orgId, ...parsed.data })
        .onConflictDoUpdate({
          target: communicationSettings.tenantId,
          set: parsed.data,
        })
    })
    revalidatePath('/settings/email')
    revalidatePath('/settings/sms')
    return { success: true }
  } catch (err) {
    logger.error('updateCommunicationSettingsAction', err)
    return { success: false, error: 'Failed to update settings' }
  }
}
