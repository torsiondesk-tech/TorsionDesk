import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve the absolute path to ./src so test imports like `@/db/with-tenant`
// resolve to `src/db/with-tenant` once Waves 1-4 create those modules.
const srcDir = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDir,
    },
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
