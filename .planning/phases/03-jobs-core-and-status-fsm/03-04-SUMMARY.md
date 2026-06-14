---
phase: 03-jobs-core-and-status-fsm
plan: 04
subsystem: ui

tags: [nextjs, react, server-actions, drizzle, zod, base-ui, fsm]

requires:
  - phase: 03-jobs-core-and-status-fsm
    provides: "jobs table schema, transitions.ts FSM, transition-job-status.ts, job-number.ts, totals.ts"
  - phase: 02-catalog-and-settings
    provides: "catalog items, tax items, job categories, tags, CreateCatalogItemModal"
  - phase: 01-customers-locations-and-equipment
    provides: "customers, contacts, service locations, CustomerSearch, TagSelect"

provides:
  - "Job Server Actions with createJob (#JOB-{N}), updateJob (no status), transition wrapper, line-item CRUD"
  - "Two-panel JobForm at /jobs/new and /jobs/[id] with reference-data prefetch"
  - "FSM-filtered StatusDropdown showing only legal next states grouped by Open/In Progress/Closed"
  - "Line-items section with Products & Services + Expenses tabs, Add dialog with inline catalog create, live totals panel"

affects:
  - "Phase 4 Dispatch Board (reads job status, transitions)"
  - "Phase 5 Technician Mobile PWA (reads job details, status)"
  - "Phase 6 Estimates (reuses line-item + totals patterns)"
  - "Phase 7 Invoicing (Close & Invoice transition hook)"

tech-stack:
  added: []
  patterns:
    - "RPC-style actions for catalog search and dependent selects"
    - "Base UI Select with grouped non-selectable headers for FSM status options"
    - "Base UI Dialog + Tabs for Add Line Item dialog with Product | Service | Discount tabs"
    - "Base UI Checkbox + hidden '1'/'0' input for boolean form fields"
    - "Client-side line-items state + JSON hidden input for create mode; server actions + router.refresh() for edit mode"
    - "computeJobTotals called on every line-item change for live totals panel"

key-files:
  created:
    - src/app/(app)/jobs/actions.ts
    - src/app/(app)/jobs/new/page.tsx
    - src/app/(app)/jobs/[id]/job-form.tsx
    - src/app/(app)/jobs/[id]/status-dropdown.tsx
    - src/app/(app)/jobs/[id]/line-items.tsx
  modified: []

key-decisions:
  - "Line items on create mode are client-side only (serialized to hidden JSON input); edit mode persists via server actions + router.refresh() + prop sync"
  - "Discount tab in Add dialog submits a negative rate line item (separate row, not a % modifier) per SF export analysis"
  - "Drive & Labor Times tab is completely omitted (not rendered) per D-11; labor is bundled into product/service pricing"
  - "Status dropdown groups legal next states under non-selectable Open/In Progress/Closed headers; illegal statuses are absent, not disabled"

patterns-established:
  - "Cross-tenant guard helper pattern: async function guardX(tx, orgId, id) { if (!id) return; select where tenantId=orgId; throw on empty }"
  - "Add-dialog with catalog search combobox + inline CreateCatalogItemModal on empty results"
  - "Live totals panel updated via computeJobTotals on every line-item prop change"

requirements-completed:
  - JOB-01
  - JOB-02
  - JOB-03
  - JOB-04
  - JOB-05
  - JOB-06
  - JOB-13
  - JOB-14

# Metrics
duration: ~75min
completed: 2026-06-14
---

# Phase 3 Plan 04: Job Write Path + Two-Panel Form Summary

**Job creation/edit Server Actions with #JOB-{N} numbering, two-panel JobForm (Details left / Job Info right), FSM-filtered status dropdown, and line-items section with Add dialog + live totals panel**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-06-14T05:15:00Z
- **Completed:** 2026-06-14T10:28:58Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `createJob` assigns per-tenant `#JOB-{N}`, guards every cross-tenant FK, writes a `customer_events` 'created' row, and retries on 23505 race
- `updateJob` never writes `status`; all status changes flow through `transitionJobStatusAction` → `transitionJobStatus` with FSM validation
- `/jobs/new` RSC prefetches reference data and reads `customerId/contactId/locationId` URL params for D-07 prefill
- Two-panel `JobForm` mirrors customer-form pattern: Details panel (customer search, dependent contact/location selects, hierarchical category picker, tags) and Job Info panel (status, dates, priority, assigned techs, billing type, repeating config)
- `StatusDropdown` shows only legal next states from `ALLOWED_TRANSITIONS[currentStatus]`, grouped under non-selectable `Open` / `In Progress` / `Closed` headers, with UI-SPEC badge variant mapping
- `LineItems` renders Products & Services and Expenses tabs (flat list, no groups per D-10), Add dialog with catalog search + inline `CreateCatalogItemModal`, per-item tax dropdown, and live totals panel with exact SF labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Job Server Actions** — `47a5662` (feat)
2. **Task 2: /jobs/new RSC + two-panel JobForm + status-dropdown** — `56ce464` (feat)
3. **Task 3: Line items section with Add dialog and live totals** — `46b75b6` (feat)

## Files Created/Modified
- `src/app/(app)/jobs/actions.ts` — createJob, updateJob, transitionJobStatusAction, line-item CRUD, catalog search RPC, reference-data helpers, customer contact/location RPC
- `src/app/(app)/jobs/new/page.tsx` — RSC create form with reference-data fetch + D-07 URL prefill
- `src/app/(app)/jobs/[id]/job-form.tsx` — two-panel client form (Details left, Job Info right) with Base UI Checkbox + hidden inputs, CustomerSearch, TagSelect, dependent selects, repeating config, LineItems embed
- `src/app/(app)/jobs/[id]/status-dropdown.tsx` — FSM-filtered, group-sectioned status select with UI-SPEC badge variants
- `src/app/(app)/jobs/[id]/line-items.tsx` — line-items section + Add Line Item tabbed dialog + live totals panel with exact SF labels

## Decisions Made
- Followed the plan's D-11 decision to completely omit Drive & Labor Times tab (labor bundled into pricing per SF export analysis)
- Line items on create mode are client-side only (JSON hidden input) because there is no `jobId` yet for server-side persistence; edit mode uses `addJobLineItem`/`updateJobLineItem`/`deleteJobLineItem` + `router.refresh()` + prop sync
- Discount tab creates a negative-rate line item (separate row) matching SF export pattern, not a per-line percentage modifier
- Repeating job UI saves frequency and end date to the job record but does not implement a recurrence engine (deferred to Phase 8)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 type import name changed**
- **Found during:** Task 1 (build verification)
- **Issue:** `z.SafeParseSuccess` does not exist in Zod v4; the exported type is `z.ZodSafeParseSuccess`
- **Fix:** Replaced `z.SafeParseSuccess` with `z.ZodSafeParseSuccess` in the line-item JSON parse filter inside `createJob` and `updateJob`
- **Files modified:** `src/app/(app)/jobs/actions.ts`
- **Verification:** `pnpm build` passes
- **Committed in:** `47a5662` (Task 1 commit)

**2. [Rule 1 - Bug] Missing `sql` import in actions.ts**
- **Found during:** Task 1 (build verification)
- **Issue:** `addJobLineItem` uses `sql<number>` for `COALESCE(MAX(sortOrder), -1)` but `sql` was not imported from `drizzle-orm`
- **Fix:** Added `sql` to the drizzle-orm import
- **Files modified:** `src/app/(app)/jobs/actions.ts`
- **Verification:** `pnpm build` passes
- **Committed in:** `47a5662` (Task 1 commit)

**3. [Rule 1 - Bug] Base UI Select `onValueChange` signature mismatch**
- **Found during:** Task 2 (build verification)
- **Issue:** `StatusDropdown` passed `(nextStatus: string) => void` to Base UI `Select` `onValueChange`, but the handler signature is `(value: string | null, eventDetails) => void`
- **Fix:** Widened handler parameter to `string | null` and added an early return for null values
- **Files modified:** `src/app/(app)/jobs/[id]/status-dropdown.tsx`
- **Verification:** `pnpm build` passes
- **Committed in:** `56ce464` (Task 2 commit)

**4. [Rule 1 - Bug] Cross-tenant guard function parameter types too narrow**
- **Found during:** Task 1 (build verification)
- **Issue:** `guardContact`, `guardServiceLocation`, `guardCategory`, `guardJobSource`, and `guardTaxItem` accepted `string | null` but parsed Zod values can be `string | null | undefined`
- **Fix:** Widened all guard function parameters to `string | null | undefined`
- **Files modified:** `src/app/(app)/jobs/actions.ts`
- **Verification:** `pnpm build` passes
- **Committed in:** `47a5662` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 — type/build errors)
**Impact on plan:** All fixes were TypeScript/build correctness issues. No scope creep or behavioral changes.

## Issues Encountered
- `pnpm-lock.yaml` was broken in the worktree; `pnpm install` regenerated it automatically during the first build. No functional impact.
- Pre-existing test failures in `tests/jobs/templates.test.ts` (RED test for future plan — `@/lib/job-templates` does not exist yet) and `tests/settings/categories.test.ts` (unrelated to this plan). Jobs-specific tests (31 tests) all pass.

## User Setup Required
None - no external service configuration required.

## Known Stubs
| File | Line | Stub | Reason / Resolution |
|------|------|------|---------------------|
| `src/lib/jobs/transitions.ts` | 54-55 | `onOnTheWay` stub | Phase 8 will implement SMS "On The Way" |
| `src/lib/jobs/transitions.ts` | 59-60 | `onCloseAndInvoice` stub | Phase 7 will implement invoice creation on Close & Invoice transition |
| `src/app/(app)/jobs/[id]/line-items.tsx` | totals panel | Drive & Labor = $0.00, Payments = $0.00 | Phase 4/5 will add time tracking; Phase 7 will wire payments |

## Threat Flags
| Flag | File | Description |
|------|------|-------------|
| threat_flag: tampering | `src/app/(app)/jobs/actions.ts` | `updateJob` explicitly excludes `status` from `.set()`; status changes only via `transitionJobStatusAction` → `transitionJobStatus` FSM validation |
| threat_flag: info_disclosure | `src/app/(app)/jobs/actions.ts` | Every client-supplied FK (customerId, contactId, serviceLocationId, categoryId, jobSourceId, taxItemId) is guarded with a `select where tenantId=orgId` check before insert/update |
| threat_flag: tampering | `src/app/(app)/jobs/actions.ts` | `computeJobTotals` is the server-authoritative totals source; client totals panel is display-only. Line-item money is validated server-side. |

## Next Phase Readiness
- Job creation/edit UI is fully functional and ready for Dispatch Board (Phase 4) and Technician Mobile PWA (Phase 5) to consume
- `transitionJobStatus` is the single server write path for status; side-effect stubs (`onOnTheWay`, `onCloseAndInvoice`) are ready for Phase 7/8 implementation without modifying Phase 3 code
- Line-item patterns (flat list, Add dialog, live totals) will be reused in Phase 6 Estimates

---
*Phase: 3-jobs-core-and-status-fsm*
*Plan: 04*
*Completed: 2026-06-14*
