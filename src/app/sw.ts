/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkFirst } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Shared cache name for /tech/* page navigations.
const TECH_PAGES_CACHE = 'tech-pages-v1'

// Generic cache key written whenever any job detail page is fetched online.
// Because the job detail page is now auth-only (jobId read client-side via
// useParams), all job detail URLs produce identical HTML. Caching under one
// key means any unvisited job detail can be served offline once any job has
// been opened while online.
const JOB_DETAIL_SHELL = '/tech/jobs/__shell__'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Job detail pages — shared-shell caching strategy.
    // On success: cache under both the exact URL and the generic shell key.
    // On failure: try exact URL → generic shell → /tech/offline precache.
    {
      matcher: ({ request, url }: { request: Request; url: URL }) =>
        request.destination === 'document' &&
        /^\/tech\/jobs\/[^/]+$/.test(url.pathname),
      handler: async ({ request }: { request: Request }) => {
        const cache = await caches.open(TECH_PAGES_CACHE)
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 10_000)
          const response = await fetch(request, { signal: controller.signal })
          clearTimeout(timer)
          await Promise.all([
            cache.put(request, response.clone()),
            cache.put(JOB_DETAIL_SHELL, response.clone()),
          ])
          return response
        } catch {
          return (
            (await cache.match(request)) ??
            (await cache.match(JOB_DETAIL_SHELL)) ??
            (await caches.match('/tech/offline')) ??
            new Response('Offline', { status: 503 })
          )
        }
      },
    },
    // All other /tech/* document navigations — standard NetworkFirst.
    {
      matcher: ({ request, url }: { request: Request; url: URL }) =>
        request.destination === 'document' && url.pathname.startsWith('/tech/'),
      handler: new NetworkFirst({
        cacheName: TECH_PAGES_CACHE,
        networkTimeoutSeconds: 10,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/tech/offline',
        matcher: ({ request }: { request: Request }) => request.destination === 'document',
      },
    ],
  },
})

serwist.addEventListeners()
