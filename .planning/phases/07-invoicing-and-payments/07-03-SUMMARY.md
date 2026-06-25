---
phase: 07-invoicing-and-payments
plan: 03
subsystem: ui
tags: [invoices, dashboard, tanstack-table, ar-aging, base-ui, nextjs]

requires:
  - phase: 07-invoicing-and-payments
    plan: 02
    provides: canonical invoice/payment server actions, InvoiceRow helpers, Stripe webhook

provides:
  - /invoices dashboard with AR aging sidebar and status-folder navigation
  - TanStack Table invoice list with search, sort, pagination, and balance-derived status badges
  - Invoices nav item enabled in the app shell

affects:
  - 07-invoicing-and-payments/07-04-PLAN
  - 07-invoicing-and-payments/07-05-PLAN
  - src/app/(app)/invoices/actions.ts
  - src/app/(tech)/tech/invoices/actions.ts

tech-stack:
  added: []
  patterns:
    - Base UI Popover for row action menus
    - Base UI Dialog with render prop for delete confirmation
    - InvoiceRow shape aligned across office dashboard and PWA wrapper
    - Scalar subquery for jobNo to keep mocks lightweight

key-files:
  created:
    - src/app/(app)/invoices/invoices-sidebar.tsx
    - src/app/(app)/invoices/invoices-table.tsx
    - src/app/(app)/invoices/page.tsx
  modified:
    - src/app/(app)/invoices/actions.ts
    - src/components/shell/nav-config.ts
    - src/app/(tech)/tech/invoices/actions.ts

key-decisions:
  - "InvoiceRow carries total/balance as formatted dollar strings and a computed status label so both office table and PWA wrapper consume the same shape."
  - "Job number fetched via scalar subquery rather than leftJoin so lightweight mocks in invoice tests continue to pass without mocking join chains."
  - "Base UI Button does not support asChild; action menu links are plain Next.js Link elements styled like menu rows, avoiding nested/hydration issues."

patterns-established:
  - "Invoices sidebar mirrors Estimates sidebar structure but adds AR aging panel above status folders."
  - "Status badge derived from balance + total + dueDate at display time, never stored (D-05)."

requirements-completed:
  - INV-02
  - INV-03

duration: 35min
completed: 2026-06-25
---

# Phase 07 Plan 03: Invoices Dashboard Summary

**Shipped the /invoices dashboard with the Service Fusion-style AR aging sidebar, a TanStack invoice table with search/sort/pagination, and enabled the Invoices nav item.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-25T09:40:00Z
- **Completed:** 2026-06-25T10:15:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `src/app/(app)/invoices/invoices-sidebar.tsx` with the AR aging panel (Grand Total Unpaid, Grand Total Past Due, four color-coded buckets) and status-folder navigation (All / Unpaid / Partially Paid / Paid in Full / Past Due).
- Created `src/app/(app)/invoices/invoices-table.tsx` as a TanStack Table with columns Invoice #, Customer, Job #, Invoice Date, Due Date, Total, Balance, Status, and a Base UI Popover action menu (View, Receive Payment, Download PDF, Copy Payment Link, Delete).
- Created `src/app/(app)/invoices/page.tsx` Server Component that fetches status counts + AR aging in parallel and renders the sidebar + table inside Suspense.
- Enabled the Invoices nav item in `src/components/shell/nav-config.ts` by setting `enabled: true` and pointing `href` to `/invoices`.
- Aligned `InvoiceRow` shape across `src/app/(app)/invoices/actions.ts` and `src/app/(tech)/tech/invoices/actions.ts` so the PWA wrapper correctly parses the new string totals/balances.

## Task Commits

Each task was committed atomically:

1. **Task 1: InvoicesSidebar — AR aging panel + status folder nav** — `105a419` (feat)
2. **Task 2: InvoicesTable + InvoicesPage + enable Invoices nav** — `c584de1` (feat)

**Plan metadata:** pending (to be committed after this file)

## Files Created/Modified

- `src/app/(app)/invoices/invoices-sidebar.tsx` — AR aging panel + status-folder nav (Client Component)
- `src/app/(app)/invoices/invoices-table.tsx` — TanStack Table invoice list with search/sort/pagination and row action menu
- `src/app/(app)/invoices/page.tsx` — Invoices dashboard Server Component
- `src/app/(app)/invoices/actions.ts` — Aligned `InvoiceRow` shape (string money, `jobNo`, computed `status`)
- `src/components/shell/nav-config.ts` — Enabled Invoices nav item with `/invoices` href
- `src/app/(tech)/tech/invoices/actions.ts` — Updated PWA wrapper to parse new `InvoiceRow` string fields

## Decisions Made

- Followed the plan's exact AR aging color scale (yellow/orange/red-orange/red) and copywriting for bucket labels and grand totals.
- Kept invoice status derived from balance/total/dueDate rather than stored; the table recomputes the badge from the row values.
- Used a scalar subquery for `jobNo` instead of a SQL join so the existing lightweight transaction mocks in `tests/invoices/list-invoices.test.ts` remain valid.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock transaction in list-invoices test does not support `.leftJoin()`**
- **Found during:** Task 2 (building `InvoicesTable` with Job # column)
- **Issue:** Adding `jobNo` via a Drizzle `.leftJoin()` caused `TypeError: tx.select(...).from(...).leftJoin is not a function` in `tests/invoices/list-invoices.test.ts`.
- **Fix:** Replaced the join with a scalar subquery in the SELECT list; mocks return fixture rows directly and ignore the subquery expression.
- **Files modified:** `src/app/(app)/invoices/actions.ts`
- **Verification:** `pnpm vitest run tests/invoices/` passes 27/27.
- **Committed in:** `c584de1` (Task 2)

**2. [Rule 2 - Blocking] Base UI `Button` does not support `asChild`**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** Action menu items used `<Button asChild><Link>...</Link></Button>`, which TypeScript rejected because the project's Base UI Button wrapper does not implement `asChild`.
- **Fix:** Replaced those items with plain Next.js `<Link>` elements styled with the same hover/alignment classes as a ghost button row.
- **Files modified:** `src/app/(app)/invoices/invoices-table.tsx`
- **Verification:** `pnpm build` exits 0.
- **Committed in:** `c584de1` (Task 2)

**3. [Rule 1 - Bug] `InvoiceRow` shape mismatch between actions and table components**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** `invoices-table.tsx` declared `jobNo` in its local `InvoiceRow` interface, but `actions.ts` exported a different shape without `jobNo`, causing a type error when passing rows from the Server Component.
- **Fix:** Added `jobNo: number | null` to the canonical `InvoiceRow` interface in `actions.ts` and ensured the query/select mapping populates it.
- **Files modified:** `src/app/(app)/invoices/actions.ts`
- **Verification:** `pnpm build` exits 0 and `/invoices` route is generated.
- **Committed in:** `c584de1` (Task 2)

---

**Total deviations:** 3 auto-fixed (1 mock compatibility, 1 Base UI pattern, 1 type alignment)
**Impact on plan:** All fixes were required for the dashboard to build and tests to pass. No scope creep.

## Issues Encountered

- None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/invoices` dashboard is live and the nav item is enabled.
- `InvoiceRow` shape is stable for `/payments/new` and invoice detail pages in Wave 3 (`07-04-PLAN`).
- Row action links already point to `/payments/new?invoiceId=...` and `/api/invoices/[id]/pdf`, so Wave 4 (`07-05-PLAN`) PDF wiring and payment pages can consume them.

---
*Phase: 07-invoicing-and-payments*
*Completed: 2026-06-25*
