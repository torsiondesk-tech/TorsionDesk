---
phase: 03-jobs-core-and-status-fsm
plan: 06
subsystem: ui
tags: [react, nextjs, drizzle, templates, site-visits, tasks, reminders]

requires:
  - phase: 03-jobs-core-and-status-fsm
    provides: jobs table, job line items, job form, job detail page

provides:
  - Job templates CRUD library with applyJobTemplate copy helper
  - Settings > Templates management page with line-item and task editors
  - Apply Template control in job form (create mode) pre-fills line items
  - Site visits component with independent status, date/window, add/edit/delete
  - Task checklist with add/complete/delete and preset quick-adds
  - Reminders with preset quick-adds and date/time + note support
  - Customer "New Job" button deep-links to prefilled /jobs/new
  - Customer Jobs tab populated with compact job list linking to /jobs/[id]

affects:
  - 04-dispatch-board
  - 05-technician-mobile-pwa
  - 06-estimates
  - 07-invoicing-and-payments

tech-stack:
  added: []
  patterns:
    - "Tenant-scoped server actions with Zod validation and revalidatePath"
    - "Client components use router.refresh + prop-sync for server-mutated lists"
    - "Repeatable inline editors (line items, tasks) with local state + hidden JSON inputs"

key-files:
  created:
    - src/lib/job-templates.ts
    - src/app/(app)/settings/templates/page.tsx
    - src/app/(app)/settings/templates/template-form.tsx
    - src/app/(app)/settings/templates/actions.ts
    - src/app/(app)/jobs/[id]/site-visits.tsx
    - src/app/(app)/jobs/[id]/job-tasks.tsx
  modified:
    - src/app/(app)/settings/settings-tabs.tsx
    - src/app/(app)/jobs/actions.ts
    - src/app/(app)/jobs/[id]/job-form.tsx
    - src/app/(app)/jobs/[id]/page.tsx
    - src/lib/jobs/jobs.ts
    - src/app/(app)/customers/[id]/action-bar.tsx
    - src/app/(app)/customers/[id]/customer-detail-form.tsx
    - src/app/(app)/customers/[id]/page.tsx
    - tests/jobs/templates.test.ts

key-decisions:
  - "Inlined New Job Link in customer-detail-form.tsx instead of using CustomerActionBar component because the detail form is an inline edit form with its own Save buttons and Deactivate dialog; CustomerActionBar was updated as specified but remains unused in this surface"
  - "Template test mock rewritten to support real Drizzle query chains (select().from().where().orderBy().then()) because the original RED mock only supported select().from().where().limit()"

requirements-completed: [JOB-07, JOB-08, JOB-09, JOB-10, SET-03]

duration: 20min
completed: 2026-06-14
---

# Phase 3 Plan 6: Job Templates, Site Visits, Tasks, and Customer Wiring Summary

**Job templates CRUD with Apply Template pre-fill, site visits with independent status, task checklist + reminders with presets, and customer-to-jobs deep-link wiring**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-14T06:00:00Z
- **Completed:** 2026-06-14T06:20:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Built `src/lib/job-templates.ts` with tenant-scoped CRUD and `applyJobTemplate` copy helper
- Created Settings > Templates surface (page, form, actions) with inline line-item and task editors
- Added Apply Template dropdown to job form in create mode that splices template line items into form state
- Implemented site visits component with independent status (FSM-grouped select), date/window, add/edit/delete
- Implemented task checklist with add/complete/delete, preset quick-adds, and reminders with presets
- Appended 9 new server actions to `jobs/actions.ts` (site visits, tasks, reminders) with Zod validation
- Wired customer New Job button to `/jobs/new?customerId=...&contactId=...&locationId=...`
- Added Jobs tab to customer detail page populated via `listJobs(orgId, { customerId })`
- Verified repeating-job config fields (`isRepeating`, `repeatFrequency`, `repeatEndDate`) already persist via `updateJob`

## Task Commits

Each task was committed atomically:

1. **Task 1: Job templates — job-templates.ts (CRUD + applyJobTemplate) + Settings > Templates page/form/actions** — `66c1681` (feat)
2. **Task 2: Additional site visits + task checklist + reminders (with presets) + their Server Actions** — `99e829c` (feat)
3. **Task 3: Wire customer "New Job" button (D-07) + populate customer Jobs tab + repeating-job config UI** — `a003b56` (feat)

## Files Created/Modified
- `src/lib/job-templates.ts` — Template CRUD + applyJobTemplate copy helper
- `src/app/(app)/settings/templates/page.tsx` — Templates list RSC page
- `src/app/(app)/settings/templates/template-form.tsx` — Create/edit/delete with line-item + task editors
- `src/app/(app)/settings/templates/actions.ts` — Server actions with Zod + revalidatePath
- `src/app/(app)/settings/settings-tabs.tsx` — Enabled Templates nav link
- `src/app/(app)/jobs/actions.ts` — Added applyTemplateAction, listJobTemplatesAction, site-visit/task/reminder actions
- `src/app/(app)/jobs/[id]/job-form.tsx` — Apply Template control for create mode
- `src/app/(app)/jobs/[id]/site-visits.tsx` — Site visits with independent status
- `src/app/(app)/jobs/[id]/job-tasks.tsx` — Task checklist + reminders with presets
- `src/app/(app)/jobs/[id]/page.tsx` — Mount SiteVisits and JobTasks in Summary tab
- `src/lib/jobs/jobs.ts` — Added reminders to JobDetail and getJob query
- `src/app/(app)/customers/[id]/action-bar.tsx` — Updated with Link + props (unused in detail form but kept for future surfaces)
- `src/app/(app)/customers/[id]/customer-detail-form.tsx` — Wired New Job Link + Jobs tab
- `src/app/(app)/customers/[id]/page.tsx` — Fetch customer jobs and pass to detail form
- `tests/jobs/templates.test.ts` — Rewrote mock to support real Drizzle chains; all 3 tests green

## Decisions Made
- Inlined the New Job Link in `customer-detail-form.tsx` rather than importing `CustomerActionBar` because the detail form is an inline edit surface with Save buttons and its own Deactivate dialog; using `CustomerActionBar` would introduce duplicate UI and an irrelevant "Edit Customer" button.
- Rewrote the `templates.test.ts` mock from a simple `select->from->where->limit` chain to a per-call-number mock that supports `orderBy` and `then`, matching the real Drizzle patterns used by `applyJobTemplate`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rewrote templates.test.ts mock to support real Drizzle query chains**
- **Found during:** Task 1 (applyJobTemplate implementation)
- **Issue:** The RED test mock only supported `select().from().where().limit()`, but `applyJobTemplate` uses `select().from().where().orderBy().then()` for line items and tasks. The original mock threw `TypeError: orderBy is not a function`.
- **Fix:** Replaced the flat mock with a call-number-tracked builder (`buildMockTx`) that returns the correct chain shape per query (1st = limit for header, 2nd = orderBy.then for line items, 3rd = orderBy.then for tasks).
- **Files modified:** `tests/jobs/templates.test.ts`
- **Verification:** `pnpm test -- tests/jobs/templates.test.ts` passes all 3 assertions
- **Committed in:** `66c1681` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added `reminders` to `JobDetail` type and `getJob` query**
- **Found during:** Task 2 (mounting JobTasks on job detail page)
- **Issue:** `JobDetail` type and `getJob` function did not include `reminders`, causing a TypeScript error when `page.tsx` tried to pass `job.reminders` to `<JobTasks>`.
- **Fix:** Added `reminders: typeof jobReminders.$inferSelect[]` to `JobDetail`, added `jobReminders` import, and included a `tx.select().from(jobReminders)` query inside `getJob`'s `Promise.all`.
- **Files modified:** `src/lib/jobs/jobs.ts`
- **Verification:** `pnpm build` succeeds
- **Committed in:** `99e829c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness and buildability. No scope creep.

## Issues Encountered
- `tests/settings/categories.test.ts` has 2 pre-existing failures unrelated to this plan (parent category cross-tenant guard and tenant scoping). These were already failing before this plan's execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Templates, site visits, tasks, and reminders are ready for use in dispatch board (Phase 4) and technician PWA (Phase 5)
- Customer-to-jobs deep-link wiring is complete
- Repeating job config fields persist but Phase 8 will need the actual scheduler

---
*Phase: 03-jobs-core-and-status-fsm*
*Completed: 2026-06-14*
