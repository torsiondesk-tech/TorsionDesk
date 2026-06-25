---
phase: 07-invoicing-and-payments
plan: 04
subsystem: ui
tags: [invoices, payments, receive-payment, payment-methods, base-ui, nextjs]

requires:
  - phase: 07-invoicing-and-payments
    plan: 03
    provides: invoices dashboard, InvoiceRow shape, AR aging, enabled Invoices nav

provides:
  - /invoices/[id] two-panel invoice detail page with line items, meta sidebar, totals, payment history, Stripe payment link, and delete confirmation
  - /payments/new Receive a Payment page with sticky totals panel and real-time over-application guard
  - /payments/[id] payment view page with audit line and invoice allocations
  - /settings/payment-methods admin CRUD list with system-row tooltip, active toggle, and reorder

affects:
  - 07-invoicing-and-payments/07-05-PLAN
  - src/app/(app)/jobs/[id]
  - src/app/(app)/dispatch/popup/dispatch-popup.tsx

tech-stack:
  added: []
  patterns:
    - Base UI DialogTrigger render prop (never asChild)
    - Base UI Select onValueChange handles string | null
    - Server Component fetches jobNo via small withTenant helper to keep actions.ts untouched
    - Client Component imports server actions directly from 'use server' files, never from a Server Component page

key-files:
  created:
    - src/app/(app)/invoices/[id]/page.tsx
    - src/app/(app)/invoices/[id]/invoice-detail-shell.tsx
    - src/app/(app)/payments/new/page.tsx
    - src/app/(app)/payments/new/receive-payment-form.tsx
    - src/app/(app)/payments/[id]/page.tsx
    - src/app/(app)/settings/payment-methods/page.tsx
    - src/app/(app)/settings/payment-methods/payment-methods-list.tsx
  modified:
    - src/app/(app)/payments/actions.ts

key-decisions:
  - "Invoice detail job cross-link uses a small in-page jobNo query instead of modifying getInvoiceAction, keeping the task commit scoped."
  - "Payment allocations include jobNo via a left join to jobs in getPaymentAction so the INV-14 description column can render 'For Job(s): #JOB-N'."
  - "ReceivePaymentForm imports recordPaymentAction from the 'use server' actions file, not from the Server Component page, to avoid the server-only barrier."
  - "Payment method CRUD actions live in payments/actions.ts and are admin-gated via Clerk orgRole === 'admin'."

patterns-established:
  - "Sticky payment-summary panel with four labeled rows matching Service Fusion copy exactly."
  - "Over-application guard recomputes on every keystroke with the UI-SPEC error string."
  - "System payment methods render a disabled control with a Base UI Tooltip explaining they cannot be removed."

requirements-completed:
  - INV-04
  - INV-05
  - INV-06
  - INV-09
  - INV-11
  - INV-12
  - INV-14
  - SET-08

duration: 65min
completed: 2026-06-25
---

# Phase 07-04: Invoicing and Payments — Wave 3 Summary

**Shipped the four screens that close the payment loop: a two-panel invoice detail page with copyable Stripe link and payment history, a Receive a Payment page with a sticky totals panel and real-time over-application guard, a first-class payment view page with audit line and allocations, and the admin Payment Methods settings tab with system-row protections.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-06-25T10:15:00Z
- **Completed:** 2026-06-25T11:20:00Z
- **Tasks:** 2
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments

- Created `src/app/(app)/invoices/[id]/page.tsx` Server Component and `invoice-detail-shell.tsx` Client Component with a two-panel layout: line items on the left, and on the right action buttons, invoice meta sidebar (Invoice#, Invoice Date, Payment Terms, Sent By, Sent On, Email Opened), Stripe Payment Link copy/generate field, totals card, payment history table, and delete confirmation dialog.
- Added `/payments/new` Server Component plus `ReceivePaymentForm` Client Component with method selection, amount input, open-invoices allocation table, sticky Payment Summary panel (Total Outstanding, Amount of Payment, Total to Be Applied, Owed After Payment), and the exact UI-SPEC over-application error.
- Created `/payments/[id]` payment view page with payment#, From Customer, Transaction Details, audit line, and invoice allocation table including job number links.
- Added `/settings/payment-methods` page and list component supporting add/rename/reorder/deactivate, system-row disabled controls with tooltip, and admin-only server actions.
- Extended `recordPaymentAction` to accept `jobId` and `receivedBy` so deposits and office payments both post to the canonical ledger correctly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Invoice detail page + /payments/[id] payment view page** — `3d79ad4` (feat)
2. **Task 2: /payments/new Receive a Payment + /settings/payment-methods SET-08** — `0c48737` (feat)

## Files Created/Modified

- `src/app/(app)/invoices/[id]/page.tsx` — Invoice detail Server Component (fetches invoice, customer, jobNo)
- `src/app/(app)/invoices/[id]/invoice-detail-shell.tsx` — Two-panel invoice detail Client Component
- `src/app/(app)/payments/new/page.tsx` — Receive a Payment Server Component
- `src/app/(app)/payments/new/receive-payment-form.tsx` — ReceivePaymentForm Client Component with sticky totals panel
- `src/app/(app)/payments/[id]/page.tsx` — Payment view page Server Component (INV-14)
- `src/app/(app)/settings/payment-methods/page.tsx` — Settings payment methods Server Component
- `src/app/(app)/settings/payment-methods/payment-methods-list.tsx` — Payment methods CRUD Client Component
- `src/app/(app)/payments/actions.ts` — Added open-invoice query, extended recordPaymentAction, added admin-gated payment-method CRUD/reorder actions, included jobNo in payment allocations

## Decisions Made

- Followed the plan's exact UI-SPEC copy for invoice meta labels, totals labels, over-application error, and delete/remove confirmation dialogs.
- Kept balance as a computed value; the invoice detail totals derive from `invoice.total` and `invoice.balance` returned by `getInvoiceAction`.
- Used Base UI `render` prop for all dialog triggers and tooltips instead of `asChild` per project memory.
- Used a small local `withTenant` helper in invoice/payment page Server Components to fetch `jobNo` rather than modifying the broader `actions.ts` files inside a task commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type] Client Component imported a server action through a Server Component page**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** `receive-payment-form.tsx` imported `recordPaymentAction` from `./page`, which pulled in `server-only` through Clerk auth and broke the build.
- **Fix:** Changed the import to the `'use server'` actions file (`../actions`) and removed the re-exports from `page.tsx`.
- **Files modified:** `src/app/(app)/payments/new/page.tsx`, `src/app/(app)/payments/new/receive-payment-form.tsx`
- **Verification:** `pnpm build` exits 0.
- **Committed in:** `0c48737` (Task 2)

**2. [Rule 1 - Type] Base UI Select onValueChange accepts `string | null`**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** Passing `Dispatch<SetStateAction<string>>` directly to `onValueChange` caused a TypeScript mismatch.
- **Fix:** Wrapped the setter with `(v) => setSelectedMethodId(v ?? '')`.
- **Files modified:** `src/app/(app)/payments/new/receive-payment-form.tsx`
- **Verification:** `pnpm build` exits 0.
- **Committed in:** `0c48737` (Task 2)

**3. [Rule 1 - Type] Aliased balance subquery could not be used with `gt()`**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** `gt(openInvoiceBalanceSubquery, 0)` rejected the `Aliased<string>` type from the scalar subquery.
- **Fix:** Replaced with a raw SQL comparison `sql`${openInvoiceBalanceSubquery} > 0` in the WHERE clause.
- **Files modified:** `src/app/(app)/payments/actions.ts`
- **Verification:** `pnpm build` exits 0; tests pass.
- **Committed in:** `0c48737` (Task 2)

**4. [Rule 1 - Type] Base UI TooltipProvider uses `delay`, not `delayDuration`**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** The component wrapper exposes `delay` as the prop name.
- **Fix:** Changed `delayDuration={0}` to `delay={0}`.
- **Files modified:** `src/app/(app)/settings/payment-methods/payment-methods-list.tsx`
- **Verification:** `pnpm build` exits 0.
- **Committed in:** `0c48737` (Task 2)

**5. [Rule 2 - Base UI Pattern] TooltipTrigger does not support `asChild`**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** System-method tooltip used `<TooltipTrigger asChild>`, which Base UI rejects.
- **Fix:** Switched to the Base UI `render` prop pattern with a non-interactive span trigger and Lock icon child.
- **Files modified:** `src/app/(app)/settings/payment-methods/payment-methods-list.tsx`
- **Verification:** `pnpm build` exits 0.
- **Committed in:** `0c48737` (Task 2)

---

**Total deviations:** 5 auto-fixed (4 type/build, 1 Base UI pattern)
**Impact on plan:** All fixes were required for the build to pass and the components to follow project Base UI conventions. No scope creep.

## Issues Encountered

- None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/invoices/[id]`, `/payments/new`, `/payments/[id]`, and `/settings/payment-methods` are live and build clean.
- Wave 4 (`07-05-PLAN`) can now wire the invoice PDF route, dispatch popup Close & Invoice, and job detail Create Invoice button against the detail/payment surfaces built here.
- The Payment Methods settings tab is active and seeded with default methods.

---
*Phase: 07-invoicing-and-payments*
*Completed: 2026-06-25*
