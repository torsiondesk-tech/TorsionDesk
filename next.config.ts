import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import withSerwistInit from '@serwist/next'

/**
 * Next.js 15 (App Router, React 19) configuration.
 *
 * Pinned to the 15.x major per CLAUDE.md — NOT 16. The registry `latest` tag
 * resolves to 16.x, so the dependency in package.json is constrained to `^15`
 * (RESEARCH Pitfall 5).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/public/sw.js', '**/public/tech/sw.js'],
    }
    return config
  },
  // Next.js 15.5.x DevTools overlay has a bug where it fails to find
  // segment-explorer-node.js#SegmentViewNode in the React Client Manifest,
  // crashing page renders in dev mode. Disable until upstream fix ships.
  devIndicators: false,
  // This app runs inside a git worktree that sits under the repo root, which has
  // its own pnpm-lock.yaml. Pin the tracing root to this project so Next does not
  // infer the parent repo as the workspace root.
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  images: {
    remotePatterns: [
      {
        // Supabase Storage signed URLs for private tenant assets (logo display)
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      // Job photos (before/after shots) routinely exceed the 1 MB default.
      // Set to 12 MB to give FormData overhead headroom; app-level guard is 10 MB.
      bodySizeLimit: '12mb',
      // Allow ngrok tunnels for mobile testing (tech PWA via phone).
      // Next.js 15 CSRF-checks the Origin header; requests from ngrok URLs are
      // blocked by default because they don't match localhost.
      allowedOrigins: ['*.ngrok-free.dev', '*.ngrok.io', '*.ngrok.app'],
    },
  },
}

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/tech/sw.js',
  swUrl: '/tech/sw.js',
  scope: '/tech/',
  register: true,
  cacheOnNavigation: true,
})

export default withSerwist(nextConfig)
