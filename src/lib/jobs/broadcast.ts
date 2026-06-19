import { createClient } from '@supabase/supabase-js'

export async function broadcastJobEvent(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const channel = supabase.channel(`dispatch:${orgId}`, {
    config: { broadcast: { ack: true } },
  })

  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({ type: 'broadcast', event, payload })
      await channel.unsubscribe()
    }
  })
}
