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
    // jsdom supports both DOM component tests and Node server tests, and is
    // required for fake-indexeddb to polyfill window.indexedDB in Dexie tests.
    environment: 'jsdom',
    // Expose describe/it/expect/vi globally so tests need no per-file imports.
    globals: true,
    // Collect both server contract tests and component tests.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Load jest-dom matchers and fake-indexeddb polyfill for Dexie tests.
    setupFiles: ['./tests/setup.ts', './tests/tech/idb-setup.ts'],
  },
})
