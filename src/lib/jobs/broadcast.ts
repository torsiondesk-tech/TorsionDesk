export async function broadcastJobEvent(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

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
        messages: [{ topic: `dispatch:${orgId}`, event, payload }],
      }),
    })

    if (!res.ok) {
      console.warn('[broadcast] Failed', { event, status: res.status })
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.warn('[broadcast] Error', { event, err })
    }
  } finally {
    clearTimeout(timer)
  }
}
