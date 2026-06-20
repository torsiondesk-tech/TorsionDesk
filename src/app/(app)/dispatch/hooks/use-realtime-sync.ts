'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'

interface SyncMessage {
  type: 'job-assigned' | 'job-updated'
  jobId: string
  techId?: string
  date?: string
}

const POLL_INTERVAL_MS = 30_000

/**
 * Subscribe to per-tenant Supabase Realtime Broadcast for dispatch changes.
 *
 * When another session (or the server action) broadcasts a job change, this
 * hook fires a custom event that the board catches to call router.refresh().
 *
 * A 30s polling interval runs alongside the WebSocket as a safety net — if
 * the Realtime connection drops (cold start, idle timeout, key issues), the
 * board still converges within 30 seconds. Mirrors the tech PWA sync pattern.
 */
export function useRealtimeSync(
  orgId: string | null | undefined,
  onRefresh: () => void,
) {
  useEffect(() => {
    if (!orgId) return

    const fireRefresh = () => window.dispatchEvent(new CustomEvent('dispatch:refresh'))

    const pollId = setInterval(onRefresh, POLL_INTERVAL_MS)

    const client = createBrowserClient()
    const channel = client.channel(`dispatch:${orgId}`, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'job-assigned' }, (payload) => {
      const msg = payload.payload as SyncMessage
      if (!msg.jobId) return
      fireRefresh()
    })

    channel.on('broadcast', { event: 'job-updated' }, () => fireRefresh())

    channel.on('broadcast', { event: 'job-status-changed' }, () => fireRefresh())

    channel.on('broadcast', { event: 'job-unassigned' }, () => fireRefresh())

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('Realtime dispatch channel error — falling back to polling', {
          orgId,
          error: err,
        })
      } else if (status === 'SUBSCRIBED') {
        console.log('Realtime dispatch channel subscribed', { orgId })
      }
    })

    return () => {
      clearInterval(pollId)
      client.removeChannel(channel)
    }
  }, [orgId, onRefresh])
}
