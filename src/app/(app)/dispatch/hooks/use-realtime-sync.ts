'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { WeekJob } from '../actions'

interface SyncMessage {
  type: 'job-assigned' | 'job-updated'
  jobId: string
  techId?: string
  date?: string
}

/**
 * Subscribe to per-tenant Supabase Realtime Broadcast for dispatch changes.
 *
 * When another session (or the server action) broadcasts a job change, this
 * hook fetches the latest job state and patches it into the local arrays.
 *
 * Phase 4 uses Broadcast (not postgres_changes) to avoid the single-threaded
 * listener limit and to decouple dispatch events from the general DB stream.
 */
export function useRealtimeSync(
  orgId: string | null | undefined,
  setLocalJobs: React.Dispatch<React.SetStateAction<WeekJob[]>>,
  setLocalPoolJobs: React.Dispatch<React.SetStateAction<WeekJob[]>>,
  weekStart: Date,
  weekEnd: Date,
) {
  useEffect(() => {
    if (!orgId) return

    const client = createBrowserClient()
    const channel = client.channel(`dispatch:${orgId}`, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'job-assigned' }, (payload) => {
      const msg = payload.payload as SyncMessage
      if (!msg.jobId) return

      // We need the server data to know where the job now belongs.
      // For v1 we simply refresh the page data via router.refresh() in the
      // action's revalidatePath, but realtime gives us cross-tab sync.
      // A lightweight approach: trigger a full page reload of dispatch data
      // by emitting a custom event that the board can catch.
      window.dispatchEvent(new CustomEvent('dispatch:refresh', { detail: msg }))
    })

    channel.on('broadcast', { event: 'job-updated' }, (payload) => {
      const msg = payload.payload as SyncMessage
      window.dispatchEvent(new CustomEvent('dispatch:refresh', { detail: msg }))
    })

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('Realtime dispatch channel error — cross-tab sync unavailable', {
          orgId,
          error: err,
        })
      } else if (status === 'CLOSED') {
        console.warn('Realtime dispatch channel closed', { orgId })
      } else if (status === 'SUBSCRIBED') {
        console.log('Realtime dispatch channel subscribed', { orgId })
      }
    })

    return () => {
      client.removeChannel(channel)
    }
  }, [orgId, setLocalJobs, setLocalPoolJobs, weekStart, weekEnd])
}
