import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve the absolute path to ./src so test imports like `@/db/with-tenant`
// resolve to `src/db/with-tenant` once Waves 1-4 create those modules.
const srcDir = fileURLToPath(new URL('./src', import.meta.url))
const webhookHelper = fileURLToPath(
  new URL('./src/lib/clerk-webhook.ts', import.meta.url),
)

export default defineConfig({
  resolve: {
    // Array form so the specific webhook-route mapping is matched BEFORE the
    // general `@/` prefix.
    alias: [
      // Next.js App Router route files may only export HTTP-method handlers, so
      // the testable `handleClerkWebhook` lives in @/lib/clerk-webhook. The
      // Wave-0 contract test imports it from the route module path; redirect that
      // exact import to the helper so the test runs against the real logic while
      // `next build` keeps the route export-clean.
      {
        find: /^@\/app\/api\/webhooks\/clerk\/route$/,
        replacement: webhookHelper,
      },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
  test: {
    // Node environment: these are server/DB-layer contracts, not DOM components.
    environment: 'node',
    // Expose describe/it/expect/vi globally so tests need no per-file imports.
    globals: true,
    // Only collect the contract tests under tests/.
    include: ['tests/**/*.test.ts'],
  },
})
