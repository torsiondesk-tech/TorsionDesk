import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'

/**
 * Next.js 15 (App Router, React 19) configuration.
 *
 * Pinned to the 15.x major per CLAUDE.md — NOT 16. The registry `latest` tag
 * resolves to 16.x, so the dependency in package.json is constrained to `^15`
 * (RESEARCH Pitfall 5).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This app runs inside a git worktree that sits under the repo root, which has
  // its own pnpm-lock.yaml. Pin the tracing root to this project so Next does not
  // infer the parent repo as the workspace root.
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
}

export default nextConfig
