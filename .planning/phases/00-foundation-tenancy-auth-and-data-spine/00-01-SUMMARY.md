---
phase: 00-foundation-tenancy-auth-and-data-spine
plan: 01
subsystem: testing
tags: [vitest, rls, multi-tenancy, drizzle, clerk, tdd, nyquist]

# Dependency graph
requires: []
provides:
  - "Vitest 4.x test harness with @/ -> src/ alias and node environment"
  - "Five RED contract tests pinning TENANT-01 (x2), AUTH-06, AUTH-01, TENANT-02 behaviors"
  - "Permanent CI guard against RLS regressions (cross-tenant + fail-closed assertions)"
  - ".env.test.example documenting the non-service-role TEST_DATABASE_URL contract"
  - "Contract surface (module import paths) that Waves 1-4 implement against"
affects: [00-02, 00-03, 00-04, 00-05, walking-skeleton, rls, withTenant, roles, webhook, profile]

# Tech tracking
tech-stack:
  added: [vitest@4.1.8]
  patterns:
    - "Nyquist RED-first contract tests authored before implementation"
    - "@/ path alias resolves to src/ in both tests and (future) app code"
    - "Integration tests skip-if-unset on TEST_DATABASE_URL to avoid CI crash pre-Wave-1"

key-files:
  created:
    - package.json
    - pnpm-lock.yaml
    - vitest.config.ts
    - .env.test.example
    - .gitignore
    - tests/with-tenant.test.ts
    - tests/rls-cross-tenant.test.ts
    - tests/roles.test.ts
    - tests/webhook.test.ts
    - tests/profile.test.ts
  modified: []

key-decisions:
  - "withTenant unit test injects a fake db via an optional 3rd param to stay hermetic while pinning the canonical 2-arg server-action call shape"
  - "Created a minimal .gitignore now (Rule 3) so node_modules is never staged; Wave 1 create-next-app will extend it"
  - "Used exact Clerk role keys org:admin / org:dispatcher / org:technician per RESEARCH A2"

patterns-established:
  - "Pattern: RED contract tests import not-yet-existing @/db/* and @/lib/* modules; resolution failure IS the Wave 0 signal"
  - "Pattern: cross-tenant test asserts BOTH cross-tenant-denied AND unset-GUC fail-closed (current_setting(...,true))"
  - "Pattern: GUC org id asserted as a bound parameter, never string-concatenated (T-00-02)"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-06-10
---

# Phase 0 Plan 01: Wave 0 Test Infrastructure Summary

**Vitest 4.x harness plus five RED contract tests pinning the TENANT-01 RLS isolation, withTenant wrapper, AUTH-06 role map, AUTH-01 org-provisioning webhook, and TENANT-02 profile round-trip that Waves 1-4 must satisfy.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-10T21:04Z
- **Completed:** 2026-06-10T21:12Z
- **Tasks:** 3
- **Files modified:** 10 created

## Accomplishments
- Installed Vitest 4.1.8 via pnpm (pnpm-lock.yaml only — no npm/yarn lockfile) and wired `vitest.config.ts` with the `@` -> `src` alias, node environment, globals, and a `tests/**/*.test.ts` include glob.
- Authored the two TENANT-01 tests: a `withTenant` unit test asserting `set_config('app.current_tenant_id', orgId, true)` runs inside a transaction before `fn` with the org id as a **bound parameter** (T-00-02), and the permanent cross-tenant integration guard asserting both a cross-tenant read returns 0 rows AND an unset-GUC query returns 0 rows (fail-closed, D-17).
- Authored the AUTH-06 role map test (dispatcher excludes `settings`, technician yields no shell modules), the AUTH-01/D-02 webhook idempotency test (one `tenants` insert per `organization.created`, replay does not duplicate), and the TENANT-02 profile round-trip test — using the exact `org:*` role keys.
- Documented the non-service-role `TEST_DATABASE_URL` contract in `.env.test.example` (T-00-01).
- Confirmed the full suite discovers exactly five test files, all RED (`5 failed (5)`, exit 1) — the expected Wave 0 state.

## Task Commits

1. **Task 1: Install vitest + vitest.config.ts + env template** - `7f28499` (chore)
2. **Task 2: TENANT-01 RLS tests (cross-tenant + withTenant unit)** - `b644463` (test)
3. **Task 3: AUTH-06 roles, AUTH-01 webhook, TENANT-02 profile tests** - `b3de874` (test)

_Note: tasks were single-commit each; the test files are intentionally RED (no GREEN in this plan — implementation lands in Waves 1-4)._

## Files Created/Modified
- `package.json` - minimal project manifest (`torsiondesk`) with `test: vitest run`; Wave 1 scaffold extends it
- `pnpm-lock.yaml` - pnpm lockfile (vitest dev dep)
- `vitest.config.ts` - node env, globals, `@` -> `src` alias, `tests/**/*.test.ts` include
- `.env.test.example` - documents non-service-role `TEST_DATABASE_URL` for the RLS test
- `.gitignore` - ignores `node_modules`, env files, Next.js build output
- `tests/with-tenant.test.ts` - TENANT-01 withTenant wrapper unit test (bound-param / order-before-fn)
- `tests/rls-cross-tenant.test.ts` - TENANT-01 cross-tenant + fail-closed integration guard (skip-if-unset)
- `tests/roles.test.ts` - AUTH-06 visibleModules per-role map
- `tests/webhook.test.ts` - AUTH-01/D-02 organization.created idempotent provisioning
- `tests/profile.test.ts` - TENANT-02 profile save/read round-trip under a single tenant

## Decisions Made
- **withTenant test injection:** RESEARCH Pattern 4 defines `withTenant(orgId, fn)` with `db` as a module-level import. To keep the unit test hermetic (inject a fake transaction) while still pinning the canonical 2-arg call used by server actions, the test calls an optional 3rd `db` param. The cross-tenant integration test uses the real 2-arg form, so the implementation in Wave 1 may keep `db` module-scoped with an optional override — within Claude's discretion per RESEARCH ("naming of internal helpers").
- **Exact role keys:** used `org:admin` / `org:dispatcher` / `org:technician` verbatim (RESEARCH A2) — diverging strings would silently break middleware later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a minimal `.gitignore`**
- **Found during:** Task 1 (vitest install)
- **Issue:** No `.gitignore` existed in the greenfield worktree; `pnpm add` created `node_modules/`, which would be staged/committed without an ignore rule. The plan's `files_modified` list did not include `.gitignore`.
- **Fix:** Created a minimal `.gitignore` covering `node_modules`, env files (`.env`, `.env.local`, `.env.test`), and Next.js build output. The Wave 1 `create-next-app` scaffold will extend it.
- **Files modified:** `.gitignore`
- **Verification:** `git diff --cached --name-only | grep node_modules` returned nothing on every commit; only intended files were staged.
- **Committed in:** `7f28499` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary hygiene to keep `node_modules` out of git. No scope creep — the `.env.test.example`, config, and five test files match the plan exactly.

## Issues Encountered
- Git emitted `LF will be replaced by CRLF` warnings on Windows for the new text files. Cosmetic (autocrlf); no action needed.

## Known Stubs
None. All five files are intentionally-RED tests, not data stubs — they import not-yet-existing `@/db/*`, `@/lib/*`, and `@/app/api/webhooks/clerk/route` modules by design, and go GREEN as Waves 1-4 deliver those modules. This is the planned Nyquist RED state, not an incomplete stub.

## User Setup Required
None in this plan. Note for later waves: the cross-tenant integration test requires a dedicated Supabase TEST project and a **non-service-role** `TEST_DATABASE_URL` (documented in `.env.test.example`) before it can run GREEN — that setup belongs to the wave that provisions the DB.

## Next Phase Readiness
- The contract surface is locked: Waves 1-4 implement `src/db/with-tenant.ts`, `src/db/schema.ts`, `src/db/client.ts`, `src/lib/roles.ts`, `src/lib/profile.ts` (or settings action), and `src/app/api/webhooks/clerk/route.ts` (exporting a testable `handleClerkWebhook` and a `@/db/provision-tenant` `provisionTenant` helper) against these tests.
- Full suite currently RED by design (`5 failed (5)`); each test goes GREEN as its target module ships. The cross-tenant test is the permanent RLS regression guard for the phase gate.

## Self-Check: PASSED
- Files: all 9 plan artifacts + `.gitignore` present on disk (verified).
- Commits: `7f28499`, `b644463`, `b3de874` all present in `git log` (verified).

---
*Phase: 00-foundation-tenancy-auth-and-data-spine*
*Completed: 2026-06-10*
