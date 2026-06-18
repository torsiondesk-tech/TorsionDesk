// Must run before any Dexie imports in tech tests.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// structuredClone polyfill guard for Node < 17 (not needed for Node 18+ but safe).
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v))
}
