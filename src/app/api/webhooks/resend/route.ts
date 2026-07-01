import { handleResendWebhook } from '@/lib/comms/resend-webhook'

export async function POST(req: Request): Promise<Response> {
  return handleResendWebhook(req)
}
