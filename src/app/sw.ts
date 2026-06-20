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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache /tech/* document navigations so offline visits to previously-viewed
    // pages (e.g. job detail) are served from cache rather than hitting ERR_FAILED.
    // Must be listed before defaultCache so it takes precedence for these routes.
    {
      matcher: ({ request, url }) =>
        request.destination === 'document' && url.pathname.startsWith('/tech/'),
      handler: new NetworkFirst({
        cacheName: 'tech-pages-v1',
        networkTimeoutSeconds: 10,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        // /tech/offline is now a real route with force-static so it is in the
        // precache manifest. Previously this pointed at /tech/offline which did
        // not exist, causing ERR_FAILED instead of the offline page.
        url: '/tech/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
})

serwist.addEventListeners()
