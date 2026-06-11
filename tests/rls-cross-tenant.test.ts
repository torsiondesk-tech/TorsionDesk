/**
 * TENANT-01 — cross-tenant RLS integration test (success criterion #4, D-17).
 *
 * This is the PERMANENT CI guard against RLS regressions (STATE.md key decision).
 * It runs against a REAL dedicated Supabase TEST project via TEST_DATABASE_URL,
 * which MUST be a non-service-role (`authenticated`) connection so RLS is actually
 * enforced (service-role bypasses RLS → false pass; threat T-00-01).
 *
 * Behavior pinned (RESEARCH Pattern 7):
 *   1. Insert a `tenants` row inside withTenant(org A).
 *   2. From withTenant(org B), attempt to read org A's row → assert 0 rows (cross-tenant denied).
 *   3. Run a raw query with NO tenant GUC set → assert 0 rows (fail-closed, Pattern 3 `current_setting(...,true)`).
 *
 * RED state: imports `@/db/with-tenant`, `@/db/schema`, `@/db/client` which do
 * not exist yet. The suite is skipped when TEST_DATABASE_URL is unset so CI does
 * not crash before Wave 1, but it MUST run (not skip) once the env var is set and
 * the modules exist.
 */
import { describe, it, expect, afterAll } from 'vitest'

// Not-yet-existing modules — resolution failure is the Wave 0 RED signal.
import { withTenant } from '@/db/with-tenant'
import { tenants } from '@/db/schema'
import { db } from '@/db/client'
import { sql, eq } from 'drizzle-orm'

const TEST_DB_URL = process.env.TEST_DATABASE_URL

// Skip-if-unset guard: does not crash CI when the test DB is absent, but the
// suite MUST execute once Wave 1 provides the modules and the env var is set.
const describeIfDb = TEST_DB_URL ? describe : describe.skip

// Two distinct, deterministic tenant ids (Clerk org-id shaped) for A and B.
const ORG_A = '00000000-0000-4000-8000-0000000000aa'
const ORG_B = '00000000-0000-4000-8000-0000000000bb'

describeIfDb('RLS cross-tenant isolation (TENANT-01)', () => {
  afterAll(async () => {
    // Best-effort cleanup of the row we inserted, scoped to its own tenant.
    try {
      await withTenant(ORG_A, async (tx) => {
        await tx.delete(tenants).where(eq(tenants.id, ORG_A))
      })
    } catch {
      // ignore cleanup failures
    }
  })

  it('denies a cross-tenant read: Tenant B cannot see Tenant A row', async () => {
    // 1. Insert org A's tenant row under org A's GUC.
    await withTenant(ORG_A, async (tx) => {
      await tx
        .insert(tenants)
        .values({ id: ORG_A, companyName: 'Tenant A Co' })
        .onConflictDoNothing()
    })

    // Sanity: org A CAN read its own row.
    const ownRead = await withTenant(ORG_A, async (tx) =>
      tx.select().from(tenants).where(eq(tenants.id, ORG_A)),
    )
    expect(ownRead.length).toBe(1)

    // 2. From org B's context, the same row must be invisible.
    const crossRead = await withTenant(ORG_B, async (tx) =>
      tx.select().from(tenants).where(eq(tenants.id, ORG_A)),
    )
    expect(crossRead.length).toBe(0)
  })

  it('fails closed: a query with NO tenant GUC set returns 0 rows', async () => {
    // No withTenant wrapper → app.current_tenant_id is unset → current_setting(...,true)
    // is NULL → RLS USING clause matches nothing.
    const unscoped = await db.execute(
      sql`select * from tenants where id = ${ORG_A}`,
    )
    const rows = Array.isArray(unscoped) ? unscoped : (unscoped as { rows?: unknown[] }).rows ?? []
    expect(rows.length).toBe(0)
  })
})
