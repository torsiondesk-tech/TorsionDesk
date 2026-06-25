import { sql } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'

export interface ArAgingResult {
  grandUnpaid: string
  grandPastDue: string
  bucket30: string // 1–30 days
  bucket60: string // 31–60 days
  bucket90: string // 61–90 days
  bucket91plus: string
}

/**
 * Compute AR aging buckets for the tenant.
 *
 * Uses a single raw SQL aggregate so Postgres does all date math atomically.
 * Balance is recomputed from payment_allocations (D-05).
 */
export async function computeArAging(orgId: string): Promise<ArAgingResult> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT
        COALESCE(SUM(inv_balance) FILTER (WHERE days_overdue BETWEEN 1 AND 30), 0)   AS bucket_30,
        COALESCE(SUM(inv_balance) FILTER (WHERE days_overdue BETWEEN 31 AND 60), 0)  AS bucket_60,
        COALESCE(SUM(inv_balance) FILTER (WHERE days_overdue BETWEEN 61 AND 90), 0)  AS bucket_90,
        COALESCE(SUM(inv_balance) FILTER (WHERE days_overdue > 90), 0)               AS bucket_91plus,
        COALESCE(SUM(inv_balance) FILTER (WHERE inv_balance > 0), 0)                 AS grand_unpaid,
        COALESCE(SUM(inv_balance) FILTER (WHERE days_overdue > 0), 0)                AS grand_past_due
      FROM (
        SELECT
          i.id,
          i.total - COALESCE(SUM(pa.amount_applied), 0) AS inv_balance,
          GREATEST(0, CURRENT_DATE - i.due_date)        AS days_overdue
        FROM invoices i
        LEFT JOIN payment_allocations pa
          ON pa.invoice_id = i.id AND pa.tenant_id = i.tenant_id
        WHERE i.tenant_id = current_setting('app.current_tenant_id', true)
        GROUP BY i.id, i.total, i.due_date
      ) sub
      WHERE inv_balance > 0
    `)
    const r = (rows as unknown as Record<string, string>[])[0] ?? {}
    return {
      grandUnpaid: r.grand_unpaid ?? '0',
      grandPastDue: r.grand_past_due ?? '0',
      bucket30: r.bucket_30 ?? '0',
      bucket60: r.bucket_60 ?? '0',
      bucket90: r.bucket_90 ?? '0',
      bucket91plus: r.bucket_91plus ?? '0',
    }
  })
}
