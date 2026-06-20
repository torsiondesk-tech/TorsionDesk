export async function broadcastJobEvent(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  // The REST broadcast API expects the bare channel name used in client.channel().
  // Supabase prepends 'realtime:' internally — sending 'realtime:dispatch:...' here
  // would double-prefix the topic and silently drop all events.
  const topic = `dispatch:${orgId}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)

  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload, private: false }],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[broadcast] Failed', { event, topic, status: res.status, body })
    } else {
      console.log('[broadcast] OK', { event, topic, status: res.status })
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.warn('[broadcast] Error', { event, topic, err })
    } else {
      console.warn('[broadcast] Timed out (5s)', { event, topic })
    }
  } finally {
    clearTimeout(timer)
  }
}
