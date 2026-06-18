---
phase: 05-technician-pwa
plan: 04
type: summary
wave: 4
requirements: [TECH-09, TECH-10, TECH-14]
---

# 05-04 Summary — Technician Estimates Surface (List / Create / Convert)

## Objective
Deliver the estimates surface of the PWA: the Estimates tab, an offline-capable create form, and a one-tap convert-to-job action — all routed through the Dexie outbox and delegating stub-safely to Phase 6 canonical actions when they ship.

## What was built

### Estimates list
- `src/app/(tech)/tech/estimates/page.tsx` — auth-guarded RSC with New Estimate button and empty state "No estimates / Create an estimate from a completed job, or pull down to refresh."
- `src/app/(tech)/components/estimate-list.tsx` — Dexie live-query list rendering.
- `src/app/(tech)/components/estimate-card.tsx` — Card showing customer, description, value, and status badge; links to `/tech/estimates/${id}`.
- `src/app/(tech)/components/estimate-detail.tsx` — Detail view with Convert to Job action and pending-state badge.

### Estimate create
- `src/app/(tech)/tech/estimates/new/page.tsx` + `src/app/(tech)/components/estimate-form.tsx` — offline-capable create form collecting customer, service location, contact info, description, line items (name/qty/unit price), follow-up date, expiry date, notes, and internal notes.
- Customer/location dropdowns read from cached Dexie data; no Places API calls from the PWA.
- Online: calls `createEstimateAction(input)`; offline: enqueues `estimate_create` outbox item.

### Sync + data layer
- `src/app/(tech)/lib/dexie.ts` — bumped to version(2) adding `customers` and `estimates` EntityTables; version(1) stores preserved.
- `src/app/(tech)/tech/customers/actions.ts` — `listTechCustomersAction` and `listTechServiceLocationsAction` for hydration.
- `src/app/(tech)/lib/use-tech-data.ts` — added `useTechCustomers`, `useTechLocations`, `useTechEstimates` live-query hooks.
- `src/app/(tech)/lib/sync.ts` — `syncEstimateCreate`, `syncEstimateConversion`, `DeferSyncError` to keep items `pending` when Phase 6 is not yet available, and `hydrateTechData` now pulls customers, locations, estimates, jobs, and equipment.

### Stub-safe Phase 6 delegation
- `src/app/(app)/estimates/actions.ts` — Phase 6 placeholder (exports nothing) so Vite/Vitest resolution succeeds while Phase 6 is unbuilt.
- `src/app/(tech)/tech/estimates/actions.ts` — PWA wrappers:
  - `createEstimateAction`
  - `convertEstimateToJobAction`
  - `listTechEstimatesAction`
  - Dynamic import of `@/app/(app)/estimates/actions`; if the export is missing, returns `{ success: false, error: 'Estimates are not available yet.' }` for online attempts while offline outbox items stay `pending` and auto-flush once Phase 6 lands.

## Tests
- `tests/tech/estimate-create.test.tsx` — form render, offline enqueue of `estimate_create`, flush via mocked `createEstimateAction`.
- `tests/tech/estimate-convert.test.ts` — `estimate_conversion` flush, success marks synced, Phase-6-not-available keeps item pending.

## Verification results
- `pnpm test --run tests/tech/estimate-create.test.tsx tests/tech/estimate-convert.test.ts` — 3/3 passing
- `pnpm test --run` — 137 passed, 2 skipped, 2 todo
- `pnpm exec tsc --noEmit` — clean
- `pnpm build` — succeeded (33 routes including `/tech/estimates`, `/tech/estimates/[id]`, `/tech/estimates/new`)

## Key deviations
- PWA routes use `src/app/(tech)/tech/estimates/...` due to the route-collision fix.
- The Dexie schema upgrade to version(2) adds `customers` and `estimates` tables while keeping version(1) intact.
- A Phase 6 stub module is committed now so the PWA compiles and tests pass; it will be replaced when Phase 6 is implemented.
- The subagent's worktree originally included unrelated in-progress stubs (dispatch board, global search, etc.); those were excluded from the merge to avoid overwriting main's existing work.

## Threats closed
- T-05-03: Estimate create/conversion route through authenticated server actions; Phase 6 will enforce tenant isolation via `withTenant`.
- T-05-09: Outbox flush runs inside authenticated session; unauthorized calls rejected.
- T-05-11: `DeferSyncError` keeps items `pending` instead of failing infinitely when backend is unavailable.
- D-19 honored: no `searchPlacesAction` / `getPlaceDetailsAction` calls from the PWA.

## Next
Wave 5 / 05-05: invoices and payments surface — create invoice from completed job, view/send invoice, and Square on-site payment (no offline Square card queue per D-03).
