---
phase: 03-jobs-core-and-status-fsm
plan: 01
subsystem: testing
tags: [vitest, tdd, fsm, money-math, tenant-isolation]

requires:
  - phase: 00-foundation-tenancy-auth-and-data-spine
    provides: withTenant pattern, hermetic mock shape, vitest config
  - phase: 01-customers-locations-and-equipment
    provides: account-number.ts pattern (nextJobNo analog), listCustomers query shape
  - phase: 02-catalog-and-settings
    provides: products.test.ts hermetic pattern to copy

provides:
  - Six RED failing contract tests under tests/jobs/
  - FSM transition validation contract (ALLOWED_TRANSITIONS, isLegalTransition)
  - transitionJobStatus contract (history write, dispatcher, tenant isolation, illegal jump)
  - computeJobTotals contract (cent-exact, discount handling, GP% divide-by-zero guard)
  - nextJobNo contract (per-tenant max+1, seed 1000)
  - countJobsByTag contract (per-tag counts scoped to tenant)
  - applyJobTemplate contract (copies line items + tasks)

affects:
  - 03-jobs-core-and-status-fsm (waves 2-5 implement the modules these tests import)

tech-stack:
  added: []
  patterns:
    - "Hermetic unit tests mock @clerk/nextjs/server auth and @/db/with-tenant with in-memory stores"
    - "Pure-function tests (transitions, totals) require no DB mocks"
    - "vi.mock for module-level mocking before importing the module under test"

key-files:
  created:
    - tests/jobs/transitions.test.ts
    - tests/jobs/transition-job-status.test.ts
    - tests/jobs/totals.test.ts
    - tests/jobs/jobs.test.ts
    - tests/jobs/tags.test.ts
    - tests/jobs/templates.test.ts
  modified: []

key-decisions:
  - "Used integer-cents arithmetic contract in totals.test.ts (Math.round(parseFloat*100)) per RESEARCH Pitfall 2"
  - "Marked exact FSM edges as [ASSUMED] in transitions.test.ts per RESEARCH Assumption A1"
  - "Marked per-line tax rounding as [ASSUMED] in totals.test.ts per RESEARCH Assumption A3"

requirements-completed: [JOB-01, JOB-02, JOB-03, JOB-06, JOB-07, JOB-08, JOB-13]

duration: 12min
completed: 2026-06-14T09:34:26Z
---

# Phase 03 Plan 01: Nyquist Floor — Six RED Contract Tests for Jobs Core and Status FSM

**Six hermetic failing tests pinning FSM, money-math, job numbering, tag counts, and template contracts before implementation in Waves 2-5**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-14T09:22:00Z
- **Completed:** 2026-06-14T09:34:26Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 0

## Accomplishments

- FSM RED tests assert STATUS_GROUPS, ALLOWED_TRANSITIONS, and isLegalTransition shape
- transition-job-status RED test asserts history write, illegal-jump throw, tenant isolation, and dispatcher side-effect invocation
- totals RED test asserts cent-exact arithmetic, discount handling, per-item tax, driveLabor=$0, payments=$0, and divide-by-zero guard
- jobs RED test asserts nextJobNo seed 1000+1, max+1 continuation, and tenant-scoped independence
- tags RED test asserts per-tag job counts scoped by tenant
- templates RED test asserts applyJobTemplate copies line items and tasks from template

## Task Commits

Each task was committed atomically:

1. **Task 1: FSM RED tests — transitions.test.ts + transition-job-status.test.ts** - `5880b10` (test)
2. **Task 2: Totals RED test — totals.test.ts** - `785172d` (test)
3. **Task 3: CRUD + tags + templates RED tests — jobs.test.ts, tags.test.ts, templates.test.ts** - `1ff4228` (test)

## Files Created

- `tests/jobs/transitions.test.ts` — STATUS_GROUPS, ALLOWED_TRANSITIONS, isLegalTransition contract
- `tests/jobs/transition-job-status.test.ts` — history write, illegal jump throw, tenant isolation, dispatcher spy
- `tests/jobs/totals.test.ts` — cent-exact computeJobTotals, discount, tax, GP% divide-by-zero guard
- `tests/jobs/jobs.test.ts` — nextJobNo seed/max+1/tenant-scoped, listJobs/getJob placeholders
- `tests/jobs/tags.test.ts` — countJobsByTag per-tenant per-tag counts
- `tests/jobs/templates.test.ts` — applyJobTemplate copies line items and tasks

## Decisions Made

- Followed exact hermetic mock pattern from `tests/catalog/products.test.ts` and `tests/customers/*.test.ts`
- Kept totals as pure-function tests (no auth/withTenant mocks needed)
- Marked [ASSUMED] on FSM edge matrix and tax rounding policy per RESEARCH assumptions A1 and A3

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree base mismatch on initial HEAD assertion (725ba7b expected vs 5f7cdd9 actual) — the worktree had prior Phase 1 commits; branch was correctly in worktree-agent-* namespace. Proceeded per orchestrator intent.

## Known Stubs

No stubs introduced — this is a test-only plan. All "RED" imports are expected to fail until Waves 2-5 implement the modules.

## Threat Flags

No new runtime trust boundaries crossed — test-only plan. Tests encode the contracts that later waves must satisfy (T-3-01 illegal transition throw, T-3-02 tenant isolation, T-3-03 cent-exact money math).

## Next Phase Readiness

- Waves 2-5 can now implement `@/lib/jobs/*` and `@/lib/job-templates` with confidence that breaking changes will fail these contract tests
- FSM edge assumptions (A1) and tax rounding assumptions (A3) still need owner confirmation before Wave 2 implementation

---
*Phase: 03-jobs-core-and-status-fsm*
*Completed: 2026-06-14*

## Self-Check: PASSED

- [x] All 6 test files exist under `tests/jobs/`
- [x] All 4 commits exist in git history (5880b10, 785172d, 1ff4228, 8220b66)
- [x] No `src/` files modified (test-only plan)
- [x] `pnpm test` collects all 6 new test files and reports them RED
- [x] Pre-existing Phase 0-2 tests remain green (11 passed, 2 skipped)
