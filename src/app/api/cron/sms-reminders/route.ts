import { db } from '@/db/client'
import { scheduledSms, communicationSettings } from '@/db/schema'
import { withTenant } from '@/db/with-tenant'
import { getTwilio } from '@/lib/comms/twilio'
import { logger } from '@/lib/logger'
import { eq, and, isNull, lte, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function getCronSecret(): string {
  return process.env.CRON_SECRET ?? ''
}

export async function GET(req: Request): Promise<Response> {
  const secret = getCronSecret()
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()
  let processed = 0

  try {
    const tenantRows = await db
      .select({ tenantId: scheduledSms.tenantId })
      .from(scheduledSms)
      .where(and(lte(scheduledSms.fireAt, now), isNull(scheduledSms.sentAt), isNull(scheduledSms.cancelledAt)))
      .groupBy(scheduledSms.tenantId)

    for (const { tenantId } of tenantRows) {
      try {
        processed += await withTenant(tenantId, async (tx) => {
          const [settings] = await tx
            .select({ smsPhoneNumber: communicationSettings.smsPhoneNumber })
            .from(communicationSettings)
            .where(eq(communicationSettings.tenantId, tenantId))

          const dueRows = await tx
            .select({
              id: scheduledSms.id,
              phone: scheduledSms.phone,
              messageBody: scheduledSms.messageBody,
            })
            .from(scheduledSms)
            .where(
              and(
                eq(scheduledSms.tenantId, tenantId),
                lte(scheduledSms.fireAt, now),
                isNull(scheduledSms.sentAt),
                isNull(scheduledSms.cancelledAt),
              ),
            )

          let tenantProcessed = 0
          const twilio = await getTwilio()

          for (const row of dueRows) {
            try {
              await twilio.messages.create({
                body: row.messageBody,
                from: settings?.smsPhoneNumber ?? '',
                to: row.phone,
              })

              await tx
                .update(scheduledSms)
                .set({ sentAt: new Date(), errorMessage: null })
                .where(and(eq(scheduledSms.tenantId, tenantId), eq(scheduledSms.id, row.id)))

              tenantProcessed++
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              logger.error('sms-reminders cron dispatch', err)
              await tx
                .update(scheduledSms)
                .set({ errorMessage: message })
                .where(and(eq(scheduledSms.tenantId, tenantId), eq(scheduledSms.id, row.id)))
            }
          }

          return tenantProcessed
        })
      } catch (err) {
        logger.error('sms-reminders cron tenant processing', err)
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    logger.error('sms-reminders cron', err)
    return new Response('Internal error', { status: 500 })
  }
}
