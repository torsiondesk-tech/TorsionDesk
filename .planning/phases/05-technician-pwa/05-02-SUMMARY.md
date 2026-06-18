---
phase: 05-technician-pwa
plan: 02
type: summary
wave: 2
requirements: [TECH-02, TECH-03, TECH-08]
---

# 05-02 Summary — Technician Schedule + Status Transitions + Offline Sync

## Objective
Deliver the first end-to-end technician runtime slice: a date-grouped 7-day schedule, job detail with a status bottom sheet, and an offline-capable Dexie-backed sync loop with pending/offline/failed indicator.

## What was built

### `/tech/jobs` schedule
- `src/app/(tech)/tech/jobs/page.tsx` — server component that auth-guards, calls `listJobs(orgId, { assigneeUserId: userId, dateFrom, dateTo })`, and renders grouped job cards.
- `src/app/(tech)/lib/group-jobs.ts` — pure `groupJobsByDay(rows, todayISO)` helper returning "Today", "Tomorrow", and weekday/date buckets.
- `src/app/(tech)/components/job-list-card.tsx` — full-width card linking to `/tech/jobs/${id}` with customer name, service address, arrival window, and status badge.

### Job detail + status bottom sheet
- `src/app/(tech)/tech/jobs/[id]/page.tsx` — RSC fetching `getJob`; renders persistent status card + Summary/Photos/Sign/Notes tabs (Summary populated, others stubbed).
- `src/app/(tech)/components/status-bottom-sheet.tsx` — bottom Sheet offering only legal next statuses from `ALLOWED_TRANSITIONS[currentStatus]`; one-tap confirm; calls `transitionJobStatusAction(jobId, nextStatus)` positionally; offline path enqueues to Dexie; shows SMS note for `on_the_way`.
- `src/app/(tech)/tech/jobs/actions.ts` — `'use server'` wrapper re-exporting the canonical `transitionJobStatusAction` plus `listTechJobsAction` for hydration.

### Offline sync loop + hooks + badge
- `src/app/(tech)/lib/sync.ts` — `enqueueOutboxItem`, `flushOutbox` (FIFO + same-job status coalescing), `startSyncLoop` (online/focus/visibilitychange + Supabase Broadcast `dispatch:${orgId}`), and `hydrateTechData`.
- `src/app/(tech)/lib/use-online.ts` — reactive `navigator.onLine` hook.
- `src/app/(tech)/lib/use-tech-data.ts` — Dexie live-query hooks for cached jobs and pending outbox count.
- `src/app/(tech)/components/offline-badge.tsx` — top-bar indicator with `aria-live="polite"` showing synced / pending / offline / failed states.
- `src/app/(tech)/components/sync-provider.tsx` — client provider mounting `startSyncLoop` in the tech layout.
- `src/app/(tech)/layout.tsx` — updated to include `TechSyncProvider`, `OfflineBadge`, and `Toaster`.

### Shared updates
- `src/lib/jobs/jobs.ts` — `JobRow` and `listJobs` select `arrivalWindowStart` / `arrivalWindowEnd` so the tech schedule can show arrival windows.
- `src/lib/utils.ts` — added `parseCalendarDate(d)` for re-hydrating server-returned dates into local-midnight calendar dates without `.toISOString().slice`.

## Tests
- `tests/tech/schedule.test.tsx` — 4 tests covering `groupJobsByDay` (Today / Tomorrow / timezone-stable) and `JobListCard` render.
- `tests/tech/sync-loop.test.ts` — 3 tests covering FIFO + coalescing, failure + retry count, and pending count.

## Verification results
- `pnpm test --run tests/tech/schedule.test.tsx` — 4/4 passing
- `pnpm test --run tests/tech/sync-loop.test.ts` — 3/3 passing
- `pnpm test --run` — 98 passed, 2 skipped
- `pnpm exec tsc --noEmit` — clean
- `pnpm build` — succeeded (30 routes including `/tech/jobs` and `/tech/jobs/[id]`)

## Key deviations
- PWA routes live under `src/app/(tech)/tech/jobs/...` due to the prior Next.js route collision fix (route group `(tech)` is hidden from the URL, so pages at `(tech)/tech/jobs/page.tsx` serve `/tech/jobs`).
- `transitionJobStatusAction` is wrapped in an async function because Next.js does not allow bare re-exports in a `'use server'` file.
- The subagent's original worktree commit included stubs for unrelated in-progress files (`jobs-advanced-search`, `user-rows`, `global-search`, etc.). Those were removed from the merge to avoid overwriting main's existing work.

## Threats closed
- T-05-03: Status write path enforced server-side via `transitionJobStatusAction`; bottom sheet only offers legal transitions.
- T-05-09: Outbox flush runs inside authenticated session; server action re-reads Clerk orgId/userId.
- T-05-10: Schedule uses `assigneeUserId: userId` + `withTenant(orgId)`; no cross-tech leakage.
- T-05-11: Illegal transitions mark outbox item `failed` and surface to technician instead of infinite retry.

## Next
Wave 3 / 05-03: on-site capture — camera photos (presigned URL sync), signature_pad + `jobSignatures`, completion notes, and equipment/spring specs lookup.
