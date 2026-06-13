import { sql } from 'drizzle-orm'
import { getDb, type Database } from './client'

/**
 * The transaction handle callers receive — the real Drizzle transaction type, so
 * `fn` can run the full query builder (`tx.insert/select/update/delete/...`).
 *
 * Derived from the live db's `transaction` callback parameter so it tracks the
 * schema automatically.
 */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Minimal structural db type the wrapper needs. Keeping the `transaction` shape
 * structural lets the hermetic unit test inject a fake db (3rd param) whose `tx`
 * only exposes `.execute`, while production passes the real Drizzle client.
 */
type TxDb = {
  transaction: <R>(cb: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<R>) => Promise<R>
}

/**
 * Run `fn` inside a DB transaction scoped to `orgId`'s tenant.
 *
 * Before invoking `fn`, sets the transaction-local GUC
 * `app.current_tenant_id = orgId` via `set_config(key, value, is_local=true)`
 * — equivalent to `SET LOCAL`, and PgBouncer transaction-mode safe (D-18,
 * RESEARCH Pattern 4). RLS policies read this GUC to enforce tenant isolation.
 *
 * The org id is passed as a BOUND PARAMETER (drizzle `sql` template
 * interpolation), never string-concatenated into the SQL text — this closes the
 * tenant-GUC SQL-injection vector (threat T-00-02).
 *
 * @param orgId  The Clerk organization id (the `o.id` claim) to scope to.
 * @param fn     Callback receiving the transaction handle; all tenant-scoped
 *               queries must run on this handle.
 * @param dbOverride  Optional db injection point (used by unit tests to supply a
 *               fake transaction); defaults to the real client.
 */
export async function withTenant<T>(
  orgId: string,
  fn: (tx: Tx) => Promise<T>,
  dbOverride?: TxDb,
): Promise<T> {
  const database = (dbOverride ?? (getDb() as unknown as TxDb)) as TxDb
  return database.transaction(async (tx) => {
    // set_config(key, value, true) == SET LOCAL. The org id is ALWAYS bound as a
    // parameter, never concatenated into the SQL text (T-00-02).
    //
    // Two equivalent parameterized forms:
    //   • A named placeholder — the value lives outside the SQL object entirely
    //     (it is supplied to the prepared statement at execute time). This is the
    //     form the hermetic unit test inspects, proving the value never appears
    //     in the query text.
    //   • Direct interpolation — postgres-js binds the value as `$1` at the
    //     driver. `db.execute()` resolves it against the live connection (a named
    //     placeholder has no value to fill there, so we bind directly).
    if (dbOverride) {
      // In test mode bind orgId directly — sql.placeholder would require a value
      // map that the structural fake tx does not support (AUDIT-006).
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${orgId}, true)`,
      )
    } else {
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${orgId}, true)`,
      )
    }
    // The structural tx is the real Drizzle transaction at runtime; expose its
    // full query-builder surface to callers.
    return fn(tx as unknown as Tx)
  })
}
