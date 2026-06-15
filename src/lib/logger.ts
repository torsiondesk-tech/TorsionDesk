/**
 * Lightweight structured logger.
 *
 * Server-side: always writes to stderr (console.error → process.stderr in Node).
 * Client-side in production: silently discards to avoid leaking internals.
 * Client-side in development: passes through so browser devtools show errors.
 */
type MaybePg = { code?: string; detail?: string; hint?: string; message?: string } | null

export const logger = {
  error(context: string, err?: unknown): void {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') return
    const pg = err as MaybePg
    // DrizzleQueryError wraps the real Postgres error in .cause
    const cause = (err as { cause?: unknown } | null)?.cause
    const pgCause = cause as MaybePg
    if (pg?.code) {
      console.error(`[${context}] PG ${pg.code}:`, (err as Error).message, pg.detail ?? '', pg.hint ?? '')
    } else if (pgCause?.code) {
      console.error(`[${context}] PG ${pgCause.code}:`, pgCause.message ?? '', pgCause.detail ?? '', pgCause.hint ?? '')
    } else {
      console.error(`[${context}]`, err ?? '')
    }
  },
}
