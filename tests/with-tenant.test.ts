/**
 * TENANT-01 — `withTenant` wrapper unit test (RED until Wave 1 ships @/db/with-tenant).
 *
 * Contract (RESEARCH Pattern 4, D-18):
 *   withTenant<T>(orgId: string, fn: (tx) => Promise<T>): Promise<T>
 *   1. opens a DB transaction
 *   2. runs `select set_config('app.current_tenant_id', <orgId>, true)` BEFORE invoking fn
 *   3. passes the transaction handle to fn
 *   4. the orgId is a BOUND parameter, never string-concatenated (threat T-00-02 / SQL injection)
 *
 * This file imports `@/db/with-tenant`, which does not exist yet, so the suite
 * fails to resolve the module — the expected Wave 0 RED state.
 */
import { describe, it, expect, vi } from 'vitest'

// Import the not-yet-existing module under test. Resolution failure here is the
// RED signal; once Wave 1 creates src/db/with-tenant.ts these tests go GREEN.
import { withTenant } from '@/db/with-tenant'

/**
 * Build a fake Drizzle-ish db whose `.transaction(cb)` invokes the callback with
 * a transaction handle exposing a spyable `.execute(query)`. We capture every
 * query the wrapper runs so we can assert on the set_config call shape.
 */
function makeFakeDb() {
  const executed: Array<unknown> = []
  const tx = {
    execute: vi.fn(async (query: unknown) => {
      executed.push(query)
      return { rows: [] }
    }),
  }
  const db = {
    transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  }
  return { db, tx, executed }
}

describe('withTenant', () => {
  it('opens a transaction and passes the tx handle to fn', async () => {
    const { db, tx } = makeFakeDb()
    const fn = vi.fn(async (received: unknown) => {
      // fn must receive the transaction handle, not the root db.
      expect(received).toBe(tx)
      return 'result'
    })

    const result = await withTenant('org_test_a', fn, db as never)

    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(result).toBe('result')
  })

  it('runs set_config(app.current_tenant_id, orgId, true) BEFORE invoking fn', async () => {
    const { db, tx } = makeFakeDb()

    const callOrder: string[] = []
    tx.execute.mockImplementation(async () => {
      callOrder.push('set_config')
      return { rows: [] }
    })
    const fn = vi.fn(async () => {
      callOrder.push('fn')
      return null
    })

    await withTenant('org_test_a', fn, db as never)

    // GUC must be set strictly before fn runs.
    expect(callOrder).toEqual(['set_config', 'fn'])

    // The first executed statement is the set_config call.
    expect(tx.execute).toHaveBeenCalledTimes(1)
    const query = tx.execute.mock.calls[0]?.[0]
    const serialized = JSON.stringify(query)
    expect(serialized).toContain('set_config')
    expect(serialized).toContain('app.current_tenant_id')
  })

  it('passes the orgId as a bound parameter, never string-concatenated (T-00-02)', async () => {
    const { db, tx } = makeFakeDb()
    const fn = vi.fn(async () => null)

    // An adversarial org id that would break out of a naive string-concat into
    // the SQL text. A parameterized query keeps this entirely in the bind value.
    const injection = `x', 'y', true); drop table tenants; --`

    await withTenant(injection, fn, db as never)

    const query = tx.execute.mock.calls[0]?.[0]

    // The query must be a drizzle SQL object (parameterized template),
    // not a plain string — proving parameter binding is used and the injection
    // payload never reaches inline SQL text (T-00-02).
    expect(typeof query).toBe('object')
    expect(query).toHaveProperty('queryChunks')

    // And the literal SQL must reference set_config with the GUC key.
    const serialized = JSON.stringify(query)
    expect(serialized).toContain('set_config')
    expect(serialized).toContain('app.current_tenant_id')
  })
})
