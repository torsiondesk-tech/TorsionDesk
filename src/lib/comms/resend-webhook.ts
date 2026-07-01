import { Webhook } from 'svix'
import { db } from '@/db/client'
import { communicationLogs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import { logger } from '@/lib/logger'

function getResendWebhookSecret(): string {
  return process.env.RESEND_WEBHOOK_SECRET ?? ''
}

export async function handleResendWebhook(req: Request): Promise<Response> {
  const secret = getResendWebhookSecret()
  if (!secret) {
    logger.error('handleResendWebhook', new Error('RESEND_WEBHOOK_SECRET is not set'))
    return new Response('Webhook secret not configured.', { status: 500 })
  }

  let payload: string
  try {
    payload = await req.text()
  } catch (err) {
    logger.error('handleResendWebhook read body', err)
    return new Response('Unable to read body.', { status: 400 })
  }

  const id = req.headers.get('svix-id') ?? ''
  const timestamp = req.headers.get('svix-timestamp') ?? ''
  const signature = req.headers.get('svix-signature') ?? ''

  if (!id || !timestamp || !signature) {
    return new Response('Missing svix headers.', { status: 400 })
  }

  let event: { type: string; data: { email_id: string } }
  try {
    const wh = new Webhook(secret)
    event = wh.verify(payload, {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    }) as { type: string; data: { email_id: string } }
  } catch (err) {
    logger.error('handleResendWebhook verification', err)
    return new Response('Invalid signature.', { status: 400 })
  }

  const messageId = event.data?.email_id
  if (!messageId) {
    return new Response('Event ignored.', { status: 200 })
  }

  if (event.type !== 'email.delivered' && event.type !== 'email.opened') {
    return new Response('Event ignored.', { status: 200 })
  }

  try {
    const [row] = await db
      .select({ tenantId: communicationLogs.tenantId })
      .from(communicationLogs)
      .where(eq(communicationLogs.providerMessageId, messageId))
      .limit(1)

    if (!row?.tenantId) {
      return new Response('Event ignored.', { status: 200 })
    }

    const now = new Date()
    await withTenant(row.tenantId, async (tx) => {
      if (event.type === 'email.delivered') {
        await tx
          .update(communicationLogs)
          .set({ deliveredAt: now })
          .where(eq(communicationLogs.providerMessageId, messageId))
      } else {
        await tx
          .update(communicationLogs)
          .set({ openedAt: now })
          .where(eq(communicationLogs.providerMessageId, messageId))
      }
    })

    return new Response('OK', { status: 200 })
  } catch (err) {
    logger.error('handleResendWebhook update', err)
    return new Response('Internal error.', { status: 500 })
  }
}
