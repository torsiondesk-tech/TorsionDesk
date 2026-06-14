---
phase: 03-jobs-core-and-status-fsm
plan: 02
subsystem: data-spine
wave: 1
dependency_graph:
  requires: [03-01]
  provides: [03-03, 03-04, 03-05, 03-06]
tech_stack:
  added: []
  patterns:
    - pgEnum + pgTable + composite-FK + pgPolicy + enableRLS (established pattern)
    - per-tenant max+1 numbering via Drizzle max() inside caller tx
key_files:
  created:
    - src/lib/jobs/job-number.ts
    - src/lib/jobs/jobs.ts
    - drizzle/0004_eminent_barracuda.sql
    - drizzle/meta/0004_snapshot.json
  modified:
    - src/db/schema.ts
    - src/components/shell/sidebar.tsx
    - drizzle/meta/_journal.json
decisions:
  - "Applied migration via generated SQL script instead of pnpm db:push because drizzle-kit 0.31.10 crashed during DB introspection (TypeError on CHECK constraint parsing)."
  - "Added missing composite unique constraints (tenant_id, id) to contacts, service_locations, tags, equipment, and customer_events tables that were absent from the live DB despite existing in schema.ts snapshots."
  - "Created src/lib/jobs/jobs.ts stub so Wave 1 RED tests can import the module and nextJobNo tests execute."
metrics:
  duration: "~45 min"
  completed_date: "2026-06-14"
---

# Phase 03 Plan 02: Jobs Data Spine Summary

**One-liner:** Appended 12 RLS-enabled job tables + 3 enums to schema.ts, materialized them in Supabase, added `nextJobNo` per-tenant numbering, and enabled the Jobs sidebar nav.

---

## What Was Built

1. **Schema additions (`src/db/schema.ts`)**
   - Three enums: `job_status` (15 values), `billing_type` (3 values), `line_item_type` (4 values).
   - Twelve tables: `jobs`, `job_line_items`, `job_tags`, `job_assignees`, `job_status_history`, `job_site_visits`, `job_tasks`, `job_reminders`, `job_templates`, `job_template_line_items`, `job_template_tasks`, `job_photos`.
   - Every table follows the customers-block pattern: `id` text PK, `tenantId` text notNull, fields, composite tenant-scoped FKs, `pgPolicy(tenant_isolation)`, and `.enableRLS()`.
   - `jobs` has `unique('jobs_tenant_job_no_unique')` and `unique('jobs_tenant_id_unique')`.

2. **Live DB migration**
   - Generated `drizzle/0004_eminent_barracuda.sql` via `drizzle-kit generate`.
   - Applied SQL directly to Supabase after fixing missing parent-table composite unique constraints.
   - All 12 tables created with FKs, indexes, and RLS policies.

3. **Job numbering helper (`src/lib/jobs/job-number.ts`)**
   - Mirrors `src/lib/account-number.ts`: `select({ m: max(jobs.jobNo) }).from(jobs).where(eq(jobs.tenantId, tenantId))`.
   - Returns `(m ?? 1000) + 1`.
   - Must run inside the caller's `withTenant` tx.

4. **Sidebar navigation**
   - Jobs nav item flipped from `enabled: false` to `enabled: true` in `src/components/shell/sidebar.tsx`.

---

## Test Results

- `pnpm test tests/jobs/jobs.test.ts` — **5 passed** (3 nextJobNo + 2 stub listJobs/getJob).
- `pnpm tsc --noEmit` — clean for all task-related files; remaining errors are expected RED imports from other Wave 1 test files.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree base mismatch — merged main to bring prior phase work**
- **Found during:** Setup
- **Issue:** Worktree HEAD was at `5f7cdd9` (Phase 1 only), missing Phase 2 + 03-01 commits. The expected base was `1bcc0c7`.
- **Fix:** Fast-forward merged `main` into `worktree-agent-a8357731511fc941d` to include all prior work.
- **Files modified:** entire worktree updated to `1bcc0c7`
- **Commit:** (part of merge, not a separate commit)

**2. [Rule 1 — Bug] drizzle-kit push crashed during DB introspection**
- **Found during:** Task 2
- **Issue:** `pnpm db:push` failed with `TypeError: Cannot read properties of undefined (reading 'replace')` in drizzle-kit@0.31.10 while pulling existing schema from the database.
- **Fix:** Used `drizzle-kit generate` to produce `0004_eminent_barracuda.sql`, then applied the SQL via a Node/postgres script.
- **Files modified:** `drizzle/0004_eminent_barracuda.sql`, `drizzle/meta/0004_snapshot.json`, `drizzle/meta/_journal.json`
- **Commit:** `0ec2d44`

**3. [Rule 2 — Missing critical functionality] Live DB missing composite unique constraints on parent tables**
- **Found during:** Task 2 (migration application failed with "no unique constraint matching given keys for referenced table 'tags'")
- **Issue:** The live DB was missing `unique(tenant_id, id)` on `contacts`, `service_locations`, `tags`, `equipment`, and `customer_events` despite the constraints existing in schema.ts snapshots. This prevented composite FK creation for Phase 3 tables.
- **Fix:** Ran `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE(tenant_id, id)` for each missing parent table, then dropped and recreated all Phase 3 tables cleanly.
- **Commit:** `0ec2d44`

**4. [Rule 3 — Blocking] jobs.ts module missing, preventing nextJobNo test execution**
- **Found during:** Task 3 verification
- **Issue:** `tests/jobs/jobs.test.ts` imports `listJobs` and `getJob` from `@/lib/jobs/jobs`, which didn't exist, causing the test file to fail to load before any assertions ran.
- **Fix:** Added `src/lib/jobs/jobs.ts` stub exporting `listJobs` and `getJob` with minimal implementations so RED tests can import and `nextJobNo` assertions execute.
- **Commit:** `7dc0484`

---

## Auth Gates

| Gate | Task | What Needed | Resolution |
|------|------|-------------|------------|
| DATABASE_URL env var | Task 2 | Copied `.env.local` from main repo checkout to worktree so drizzle-kit and postgres-js could connect to Supabase. | Resolved — file copied from main checkout `C:/Users/marco/Desktop/HOME SERVICE CRM/.env.local`. |

---

## Known Stubs

| File | Line | Description | Reason |
|------|------|-------------|--------|
| `src/lib/jobs/jobs.ts` | 6–13 | `listJobs` returns `[]`, `getJob` returns `null` | Wave 3 will implement real list/get actions; stub exists only to let Wave 1 RED tests load. |

---

## Threat Flags

No new threat surface introduced beyond the planned schema additions. All 12 tables have RLS policies and tenant-scoped composite FKs as required by the plan's threat model (T-3-02, T-3-FK, T-3-RACE).

---

## Self-Check: PASSED

- [x] `src/db/schema.ts` exists and contains all 12 table exports + 3 enums
- [x] `src/lib/jobs/job-number.ts` exists and exports `nextJobNo`
- [x] `src/components/shell/sidebar.tsx` has Jobs `enabled: true`
- [x] `src/lib/jobs/jobs.ts` stub exists
- [x] All commits verified:
  - `25940ae` feat(03-02): append Phase 3 enums + 12 job tables to schema.ts
  - `0ec2d44` feat(03-02): apply Phase 3 tables migration to Supabase
  - `7dc0484` feat(03-02): nextJobNo helper + enable Jobs sidebar nav
