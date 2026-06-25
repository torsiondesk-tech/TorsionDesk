---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 07
last_updated: "2026-06-25T11:20:00.000Z"
progress:
  total_phases: 11
  completed_phases: 6
  total_plans: 46
  completed_plans: 36
  percent: 78
---

# TorsionDesk — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-10)

**Core value:** A tech gets dispatched from the board, completes the job on their phone, creates the invoice and collects payment on site, and the customer has a paid invoice with a receipt in their inbox — without the owner touching anything twice.
**Current focus:** Phase 07 — invoicing and payments

## Current Phase

**Phase 7: Invoicing and Payments**

- Status: Executing
- Goal: Office and field can create invoices from completed jobs, collect payment via Stripe (online) and Square (on-site), maintain a single canonical ledger, and send paid receipts to customers.
- Requirements: INV-01 through INV-14
- Depends on: Phase 3 (completed), Phase 6 (completed)
- Cross-phase note: `createInvoiceFromJobAction`, `sendInvoiceAction`, and Square payment posting must be callable from the PWA and share the same canonical ledger as office flows.
- Progress: 07-04 complete — /invoices/[id] live with payment history and Stripe link, /payments/new live with over-application guard, /payments/[id] payment view live, /settings/payment-methods admin CRUD live (INV-04, INV-05, INV-06, INV-09, INV-11, INV-12, INV-14, SET-08).

## Phase 4 Plans

- [x] 04-01-PLAN.md — Wave 0: Install dnd-kit + shadcn calendar/skeleton/tooltip/sonner + browser Supabase singleton + test stubs
- [x] 04-02-PLAN.md — Wave 1: Server actions (updateJobAssignment, getWeekJobs, countPoolJobs, getJobMinimal, listTechnicians)
- [x] 04-03-PLAN.md — Wave 2: Week grid (board.tsx DndContext, week-grid.tsx, day-cell.tsx, job-block.tsx, week-navigator.tsx)
- [x] 04-04-PLAN.md — Wave 3: Job pool (pool-tabs.tsx, pool-card.tsx, job-pool.tsx, pool→grid drag wiring)
- [x] 04-05-PLAN.md — Wave 4: Dispatch popup (two-column Dialog, map pane, action buttons)
- [x] 04-06-PLAN.md — Wave 5: Realtime sync, nav, role gates, tests

## Phase 6 Plans

- [x] 06-01-PLAN.md — Wave 0: RED tests (7 files) + schema (11 tables) + helpers (nextEstimateNo, computeEstimateTotals, estimateStatusBadgeVariant) + @react-pdf/renderer install + [BLOCKING] pnpm db:push
- [x] 06-02-PLAN.md — Wave 1: Canonical server actions (createEstimateAction, updateEstimateStatusAction, convertEstimateToJobAction, sendEstimateAction stub, task/reminder CRUD, template actions, pdf-data fetcher)
- [x] 06-03-PLAN.md — Wave 2: GroupedLineItems + StarPicker components + job form retrofit (D-07) + enable Estimates nav item
- [x] 06-04-PLAN.md — Wave 3: Estimates dashboard (sidebar with count badges + TanStack table) + two-panel estimate form + detail/edit page + task lists
- [x] 06-05-PLAN.md — Wave 4: PDF API route (@react-pdf/renderer, /api/estimates/[id]/pdf) + estimate PDF component + Settings estimate templates tab

## Progress

```
Phase 0  [██████████] Completed  ← 2026-06-11
Phase 1  [██████████] Completed  ← 2026-06-12
Phase 2  [██████████] Completed  ← 2026-06-14
Phase 3  [██████████] Completed  ← 2026-06-15
Phase 4  [██████████] Completed  ← 2026-06-15
Phase 5  [██████████] Completed  ← 2026-06-21
Phase 6  [██████████] Completed  ← 2026-06-24
Phase 7  [███████   ] Executing    ← current (4/5 plans)
Phase 8  [          ] Not started
Phase 9  [          ] Not started
Phase 10 [          ] Not started
```

6 / 11 phases complete · 81 / 109 requirements delivered

## Completed Phases

### Phase 0: Foundation — Tenancy, Auth, and Data Spine

- Status: Completed
- Completed: 2026-06-11
- Plans executed: 4 / 5 (00-01, 00-02, 00-03, 00-04)
- Notes: 00-05 (integration-test suite against real Supabase) intentionally deferred.
- Requirements delivered: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, TENANT-01, TENANT-02

### Phase 1: Customers, Locations, and Equipment

- Status: Completed
- Completed: 2026-06-12
- Plans executed: 5 / 5 (01-01, 01-02, 01-03, 01-04, 01-05)
- Notes: All 9 CUST requirements delivered. Customer detail page was refactored post-completion from a 7-tab read-only view into a Service Fusion-style single-page inline editable form: all customer info, contacts (with phones/emails), locations (with inline edit/delete), equipment (with inline add per location), and notes are visible and editable in one view with a sticky activity sidebar. No drawers, no separate edit page. The old `/customers/[id]/edit` page still exists but is no longer the primary path. Nyquist floor tests in place.
- Requirements delivered: CUST-01, CUST-02, CUST-03, CUST-04, CUST-05, CUST-06, CUST-07, CUST-08, CUST-09

### Phase 2: Catalog and Settings

- Status: Completed
- Completed: 2026-06-14
- Security: Verified 2026-06-14 (22/22 threats closed, ASVS L2)
- Plans executed: 5 / 6 (02-01 test-scaffold superseded; 02-02 schema, 02-03 products, 02-04 services+modal, 02-05 categories, 02-06 tags/tax/lookups)
- UAT: 11/12 passed, 1 skipped (inline modal — re-verified in Phase 3 job form)
- Notes: Two cross-cutting bugs fixed during UAT: (1) React 19 form auto-reset caused blank optimistic rows — fixed with router.refresh() + prop-sync pattern across tax-items, tags, lookup-lists. (2) Nested button hydration error from bare DialogTrigger+Button (Base UI uses render prop, not asChild) — fixed across 7 components.
- Requirements delivered: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, SET-01, SET-02, SET-06, SET-07

### Phase 3: Jobs Core and Status FSM

- Status: Completed
- Completed: 2026-06-15
- Plans executed: 6 / 6 (03-01 through 03-06)
- UAT: 8/8 passed, 0 issues (browser verified 2026-06-15)
- Verification: 17/17 truths verified, 0 gaps, 7 deferred items documented for later phases
- Notes: |
  Core job record with FSM-enforced status transitions, line items, live totals, two-panel job form, jobs dashboard with 8-bucket sidebar, job detail with 6 tabs, site visits, task checklist + reminders, job templates + apply, repeating job config, customer deep-link, and inline customer/contact/location creation. All RLS-enabled. 12 job tables + 3 enums. 29 RLS policies.
  Key cross-cutting assets introduced this phase: `AddressAutocomplete` (Google Places API v1), `places-actions.ts`, inline entity creation transaction pattern, extended `getCustomerLocations` with state/postalCode/lat/lng.

- Requirements delivered: JOB-01, JOB-02, JOB-03, JOB-04, JOB-05, JOB-06, JOB-07, JOB-08, JOB-09, JOB-10, JOB-11, JOB-12, JOB-13, JOB-14, SET-03

### Phase 4: Dispatch Board

- Status: Completed
- Completed: 2026-06-15
- Plans executed: 6 / 6 (04-01 through 04-06)
- UAT: 16/16 tests passed, 2 todo (browser verified 2026-06-15)
- Verification: Build clean, type-check clean, full test suite 100/100 passed
- Notes: |
  Service Fusion-style week-view dispatch board with technician rows and day columns. Drag-and-drop assignment via dnd-kit with optimistic updates and snap-back on error. Job pool with 6 tabs (Unscheduled, Unassigned, With Open POs, Partially Completed, Paused, Marked For Follow Up). Two-panel dispatch popup modal (details left, map placeholder + actions right) opens on job click. Realtime cross-tab sync via Supabase Broadcast per-tenant topic. Sidebar Dispatch nav enabled. Technician role middleware redirect already covers /dispatch (no extra gate needed). Pool→grid and grid→grid drag both supported. Block colors reflect status precedence: cancelled muted, in-progress blue, closed green, default slate.

- Requirements delivered: DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, DISP-07

### Phase 5: Technician Mobile PWA

- Status: Completed
- Completed: 2026-06-21
- Plans executed: 6 / 6 (05-01, 05-01b, 05-02, 05-03, 05-04, 05-05)
- Device checks: 5/8 PASSED, 3 DEFERRED (iOS install — no Apple device; Square sandbox payment online + offline — credentials not configured)
- Notes: |
  Offline-capable installable PWA for technicians. Serwist SW + Dexie.js outbox with 9 mutation types. Role gate: Technicians auto-redirect to /tech/jobs; Dispatchers/Admins blocked or redirected. 7-day job schedule with Dexie cache, status bottom sheet via server-enforced transitionJobStatusAction. Camera photo upload (canvas compress, presigned URL, offline queue). Touchscreen signature via signature_pad (touch-none, syncs to jobSignatures table). Completion notes and equipment/spring specs from job detail. Estimates surface (list/create/convert to job, offline-capable, stub-safe Phase 6 delegation). Invoices surface (create from completed job, send, stub-safe Phase 7/8). Square Web Payments SDK (Apple/Google Pay online-only; cash/check recorded offline). Full Dexie outbox UI with unsynced count badge.
  Deferred items for future pass: Square sandbox credential testing (TECH-13 device check); iOS Safari install (no Apple hardware). Code is implemented; only sandbox validation is deferred.

- Requirements delivered: TECH-01, TECH-02, TECH-03, TECH-04, TECH-05, TECH-06, TECH-07, TECH-08, TECH-09, TECH-10, TECH-11, TECH-12, TECH-13, TECH-14

### Phase 6: Estimates

- Status: Completed
- Completed: 2026-06-24
- Plans executed: 5 / 5 (06-01 through 06-05)
- Notes: |
  Full estimates pipeline: dashboard with status-folder sidebar (Draft/Sent/Won/Lost/Expired) + tag filters, two-panel estimate form with grouped catalog line items, task/reminder CRUD, StarPicker rating, PDF generation via @react-pdf/renderer (/api/estimates/[id]/pdf), estimate email/SMS send, one-click convert-to-job, Settings estimate templates tab. `createEstimateAction`, `convertEstimateToJobAction`, and `sendEstimateAction` are PWA-callable server actions (offline-queued wrappers already stubbed in Phase 5). Customer name links to customer detail page. Reminder presets derived from scheduled on-site date/time.
- Requirements delivered: EST-01, EST-02, EST-03, EST-04, EST-05, EST-06, EST-07, EST-08, EST-09

## Phase 7 Plans

- [x] 07-01-PLAN.md — Wave 0: RED tests (9 files) + schema (5 new tables) + helpers + pnpm add stripe square + [BLOCKING] schema push to Supabase
- [x] 07-02-PLAN.md — Wave 1: Canonical server actions + Stripe webhook + Settings payment-methods tab + Square CDN URL fix
- [x] 07-03-PLAN.md — Wave 2: Invoices dashboard (AR aging sidebar + TanStack table) + enable Invoices nav
- [x] 07-04-PLAN.md — Wave 3: Invoice detail page + /payments/new + /payments/[id] + /settings/payment-methods CRUD
- [ ] 07-05-PLAN.md — Wave 4: Invoice PDF route + wire dispatch popup Close & Invoice + wire job detail Create Invoice button

## Key Decisions Made

(see .planning/PROJECT.md Key Decisions section)

Decisions locked during Phase 0:

- ORM final call: **Drizzle** (rejected Prisma because it bypasses RLS by default)
- Clerk native Supabase third-party auth wiring (JWT template deprecated April 1, 2025); RLS policies key on `org_id`, not `auth.uid()`
- PgBouncer / connection config for RLS-scoped roles: `withTenant` uses `set_config(..., true)` (transaction-local, pooler-safe)
- Cross-tenant CI test: deferred to 00-05; the RLS code is production-ready

Decisions locked during Phase 3:

- **Inline entity creation pattern:** `createCustomer` and `createJob` both accept optional `newContact*` and `newLocation*` fields and atomically create child records in the same transaction. This pattern must be reused by Phase 6 (`createEstimate`).
- **Google Places API v1** for address autocomplete (not v2 — v2 requires different auth). Component: `src/components/address-autocomplete.tsx`. Server actions: `src/lib/places-actions.ts`.
- **Discount is a sidebar totals field**, not a line item type in the Products & Services table. This matches Service Fusion behavior.
- **Line items are inline editable rows** (not a popup dialog) for Products/Services. Expenses remain dialog-add.
- **Job status transitions are the ONLY write path for status** — `updateJob` explicitly excludes status. Three writers (job form, dispatch popup, tech PWA) must all call `transitionJobStatusAction`.

## Blockers

(none)

## Phase 1 Audit — Completed 2026-06-12

All 25 findings in `AUDIT-FINDINGS.md` resolved (9 P0, 9 P1, 7 P2). Build, type-check, and tests pass.
Database migration applied: composite FKs, new enums, and indexes pushed to Supabase.
`.env.local` created with `DATABASE_URL` for local development.
See `.planning/AUDIT-FINDINGS.md` for full tick-list and `memory/audit-phase-1-fixes.md` for change log.

## Session Audit — 2026-06-14

Full cross-phase conflict analysis in `.planning/SESSION-2026-06-14-AUDIT.md`.
Key takeaways:

- Phase 4 map must handle null lat/lng on pre-existing location records.
- Phase 5 Dexie sync schema must include `latitude`, `longitude`, `state`, `postalCode` on `service_locations`.
- Phase 5 must NEVER call `searchPlacesAction` / `getPlaceDetailsAction` from offline PWA context.
- Phase 6 estimate form must reuse `AddressAutocomplete`, `opt()` helper, and inline-creation transaction pattern.
- Phase 10 migration must map SF address fields → `state`, `postal_code`; lat/lng can be null on import.

## Watch Items

- Phases 4 and 5 are parallelizable once Phase 3 is complete. **Phase 3 is now complete.**
- Base UI `render` prop pattern (not `asChild`) — applies to any new DialogTrigger+Button combos.
- **SHARED ASSETS (pre-built, must reuse):**
  - `src/components/address-autocomplete.tsx` — Google Places API v1 UI. Reuse in Phase 6 estimate form; **never** in Phase 5 PWA (offline-unsafe).
  - `src/lib/places-actions.ts` — Places API server actions + `ParsedAddress` type. **Network-dependent — not for Phase 5.**
  - `src/app/(app)/customers/actions.ts` `opt()` Zod helper — DRY opportunity for Phase 6 actions.
  - Inline contact+location creation transaction pattern (`createCustomer`, `createJob`) — Phase 6 `createEstimate` must mirror this.
- **Phase 4 map data gap:** `service_locations` stores `latitude`/`longitude` for locations created via autocomplete. Pre-existing records have null coordinates. Phase 4 dispatch popup map (DISP-07) must handle null gracefully (fallback or "Location unavailable").
- **Phase 5 offline schema gap:** Dexie.js sync schema for `service_locations` must include `latitude`, `longitude`, `state`, `postalCode`.
- **Phase 5 scope expansion (2026-06-17):** PWA now includes estimates (view/create/convert to job/send), invoices (create from completed job/view/send), and on-site Square payments. Dexie outbox must queue estimate, invoice, payment, and send-record mutations.
- **Phase 5 role boundary:** AUTH-06 updated so technicians can access estimates/invoices/payments tied to their assigned jobs or customers.
- **Phase 6 estimate form:** Must reuse `AddressAutocomplete`, `opt()` Zod helper, and the inline contact+location creation transaction pattern from `createCustomer` / `createJob`. See `SESSION-2026-06-14-AUDIT.md` C-06 / C-07.
- **Phase 6 API reuse by PWA:** `createEstimateAction`, `convertEstimateToJobAction`, and `sendEstimateAction` must be callable from the PWA (offline-queued if needed) and enforce tenant + role scoping.
- **Phase 7 API reuse by PWA:** `createInvoiceFromJobAction`, `sendInvoiceAction`, and Square payment posting must be callable from the PWA and share the same canonical ledger as office flows.
- **Phase 8 API reuse by PWA:** `sendCustomerCommunicationAction` should be shared by office and PWA send buttons, with per-trigger settings applied server-side.
- **Phase 10 migration:** SF export must map `state`/`postal_code` to `service_locations`; lat/lng can be left null on import. See `SESSION-2026-06-14-AUDIT.md` C-08.
- Full conflict analysis: `.planning/SESSION-2026-06-14-AUDIT.md`

## Session Continuity

**Last action:** Phase 07-04 (Invoicing and Payments Wave 3) completed 2026-06-25.
**Next action:** Execute 07-05 to continue Invoicing and Payments Wave 4 (invoice PDF route, dispatch popup Close & Invoice, job detail Create Invoice button, To Be Invoiced bucket fix).
**Resume files:**

- `.planning/ROADMAP.md` — Phase 7 requirements (INV-01–INV-08, PAY-01–PAY-06)
- `.planning/phases/07-invoicing-and-payments/07-03-SUMMARY.md` — Wave 2 dashboard summary

---
*State initialized: 2026-06-10*
*Updated: 2026-06-25 — Phase 07-04 complete, ready for 07-05*
