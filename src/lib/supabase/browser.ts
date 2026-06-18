import { createClient } from '@supabase/supabase-js'

/**
 * Singleton browser Supabase client (DISP-02).
 *
 * Uses the public ANON_KEY — safe to ship to the client. The service-role key
 * must NEVER be referenced here (threat T-04-01).
 *
 * This client is used exclusively for:
 *  • Supabase Realtime Broadcast subscriptions (Phase 4)
 *  • Future client-side Storage reads (Phase 8+)
 *
 * The module-level singleton prevents duplicate client instances per render
 * (Next.js strict-mode double-mount is harmless because we return the same
 * instance on the second call).
 */
let browserClient: ReturnType<typeof createClient> | null = null

export function createBrowserClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase browser client missing env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  }

  if (typeof window !== 'undefined' && !key.startsWith('sb_publishable_')) {
    console.warn(
      '[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a legacy key. ' +
        'Supabase migrated to new API keys; Realtime may fail until you update it ' +
        'to the publishable key from Dashboard → Project Settings → API.',
    )
  }

  browserClient = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })

  return browserClient
}
