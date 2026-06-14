---
phase: 03-jobs-core-and-status-fsm
plan: 03
subsystem: database
 tags: [drizzle, fsm, cents-math, tenant-isolation, withTenant]

# Dependency graph
requires:
  - phase: 03-02
    provides: "Wave 0 RED test contracts for transitions, transition-job-status, totals, jobs, tags"
provides:
  - src/lib/jobs/transitions.ts — ALLOWED_TRANSITIONS map, STATUS_GROUPS, isLegalTransition, dispatchSideEffects
  - src/lib/jobs/transition-job-status.ts — single server write path for job status
  - src/lib/jobs/totals.ts — integer-cents computeJobTotals with GP% guard
  - src/lib/jobs/jobs.ts — listJobs, getJob, countJobsByTag query layer
affects:
  - 03-04 (job form UI)
  - 03-05 (dispatch board)
  - 07 (invoicing — onCloseAndInvoice stub)
  - 08 (SMS — onOnTheWay stub)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Integer-cents money math: toCents / fromCents helpers, never float arithmetic"
    - "Server-enforced FSM: ALLOWED_TRANSITIONS map + isLegalTransition guard"
    - "Named side-effect stubs bound to transition events (not status values)"
    - "withTenant + explicit eq(tenantId, orgId) as second check beyond RLS"
    - "Default list scope: Open + In Progress statuses (D-16)"

key-files:
  created:
    - src/lib/jobs/transitions.ts
    - src/lib/jobs/transition-job-status.ts
    - src/lib/jobs/totals.ts
  modified:
    - src/lib/jobs/jobs.ts
    - tests/jobs/transitions.test.ts
    - tests/jobs/transition-job-status.test.ts
    - tests/jobs/jobs.test.ts

key-decisions:
  - "Conservative FSM matrix with [ASSUMED] comment for owner SF-parity confirmation"
  - "Per-item tax rounded per line, then summed [ASSUMED A3]"
  - "GP% = (jobTotal - cost) / jobTotal * 100 with divide-by-zero guard [ASSUMED A6]"
  - "driveLabor and payments hardcoded to '0.00' as Phase 3 placeholders"

requirements-completed: [JOB-03, JOB-06, JOB-12, JOB-13]

# Metrics
duration: 7min
completed: 2026-06-14
---

# Phase 03 Plan 03: FSM + Totals + Jobs Query Layer Summary

**Server-enforced job status FSM with integer-cents totals and tenant-scoped query layer turning Wave-0 tests green**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-14T05:03:00Z
- **Completed:** 2026-06-14T05:10:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Built `transitions.ts` with STATUS_GROUPS (15 statuses), ALLOWED_TRANSITIONS conservative matrix, and `isLegalTransition` guard
- Implemented `transitionJobStatus` as the single legal write path for `jobs.status` — updates status, records history + customer activity event, and dispatches named side-effect stubs in one `withTenant` transaction
- Created `computeJobTotals` with integer-cents arithmetic, per-line tax rounding, discount exclusion from cost, and divide-by-zero GP% guard
- Implemented `listJobs` (default Open+In Progress scope, pagination, sorting), `getJob` (with related data), and `countJobsByTag` (tenant-scoped sidebar counts)
- All 31 Wave-0 contract tests now green: transitions (12), transition-job-status (4), totals (8), jobs (5), tags (2)

## Task Commits

Each task was committed atomically:

1. **Task 1: transitions.ts — ALLOWED_TRANSITIONS map + STATUS_GROUPS + named side-effect stubs** — `241051d` (feat)
2. **Task 2: transition-job-status.ts — single server write path (history + event + dispatch)** — `e7657c2` (feat)
3. **Task 3: totals.ts + jobs.ts — computeJobTotals, listJobs, getJob, countJobsByTag** — `7611bc1` (feat)

## Files Created/Modified

- `src/lib/jobs/transitions.ts` — FSM map, groups, isLegalTransition, dispatchSideEffects with named stubs
- `src/lib/jobs/transition-job-status.ts` — Single legal status write path with history + events + side effects
- `src/lib/jobs/totals.ts` — Integer-cents computeJobTotals with GP% guard
- `src/lib/jobs/jobs.ts` — Tenant-scoped listJobs, getJob, countJobsByTag
- `tests/jobs/transitions.test.ts` — Fixed TypeScript Set overlap assertion types
- `tests/jobs/transition-job-status.test.ts` — Fixed fake-tx mock to filter by orgId for cross-tenant test
- `tests/jobs/jobs.test.ts` — Added withTenant mock so hermetic assertions work with real implementations

## Decisions Made

- Conservative FSM matrix with explicit [ASSUMED] comment — owner must confirm exact SF-parity edges before production
- Named stubs (`onOnTheWay`, `onCloseAndInvoice`) rather than generic-only dispatch — matches D-02 requirement and keeps side effects discoverable
- `driveLabor: '0.00'` and `payments: '0.00'` as string literals in totals output — Phase 7 and future waves will wire real values

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Fixed transition-job-status.test.ts cross-tenant mock**
- **Found during:** Task 2
- **Issue:** `makeFakeTx` received `orgId` but never used it in the `select` mock, so cross-tenant jobs were returned as found
- **Fix:** Changed `limit` mock to return `[]` when `job.tenantId !== orgId`
- **Files modified:** `tests/jobs/transition-job-status.test.ts`
- **Verification:** `throws "Job not found" when the job belongs to a different tenant` now passes
- **Committed in:** `e7657c2` (Task 2 commit)

**2. [Rule 3 — Blocking] Added withTenant mock to jobs.test.ts**
- **Found during:** Task 3
- **Issue:** `listJobs` and `getJob` now call `withTenant` internally, but `jobs.test.ts` had no DB/mock setup and threw `DATABASE_URL is required`
- **Fix:** Added a generic fake-tx mock supporting `.select().from().where().orderBy().limit().offset()`, `.innerJoin()`, and `.groupBy()` that resolves to defined values
- **Files modified:** `tests/jobs/jobs.test.ts`
- **Verification:** Both `listJobs` and `getJob` placeholder assertions pass
- **Committed in:** `7611bc1` (Task 3 commit)

**3. [Rule 1 — Bug] Fixed TypeScript strictness in transitions.test.ts Set overlap assertions**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `new Set(STATUS_GROUPS.open)` inferred a narrow literal type, causing `has(s)` to error when `s` came from a different group
- **Fix:** Explicitly typed all three sets as `Set<string>`
- **Files modified:** `tests/jobs/transitions.test.ts`
- **Verification:** `pnpm tsc --noEmit` clean
- **Committed in:** `241051d` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking)
**Impact on plan:** All fixes were test-infrastructure corrections required for green CI. No implementation scope creep.

## Issues Encountered

- None — implementation proceeded as planned once test mocks were aligned with real code

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `transitionJobStatus` is ready to be called from the job form, dispatch popup, and tech PWA
- `computeJobTotals` is ready to render job financials in the UI
- `listJobs` / `getJob` / `countJobsByTag` provide the server contract for the jobs dashboard and dispatch board
- No blockers

---
*Phase: 03-jobs-core-and-status-fsm*
*Completed: 2026-06-14*
