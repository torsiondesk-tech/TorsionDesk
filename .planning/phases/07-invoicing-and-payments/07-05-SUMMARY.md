---
phase: 07-invoicing-and-payments
plan: 05
subsystem: api

tags: [invoices, pdf, react-pdf, dispatch, job-detail, close-and-invoice, base-ui, nextjs]

requires:
  - phase: 07-invoicing-and-payments
    plan: 04
    provides: invoice detail page, Receive a Payment page, payment view page, payment methods settings, canonical invoice/payment server actions

provides:
  - /api/invoices/[id]/pdf route (Node.js runtime) returning application/pdf
  - InvoicePdfDocument component with INVOICE label, INV- prefix, line items, totals, payments received table, and optional work order section
  - Dispatch popup "Close & Invoice" wired to createInvoiceFromJobAction with router.refresh()
  - Dispatch popup "Deposits" wired to /payments/new?jobId=X&type=deposit
  - Job detail page "Create Invoice" button for completed jobs (INV-10)
  - Job detail page invoice cross-link in status area when invoiced (INV-11)
  - Jobs "To Be Invoiced" bucket now lists completed jobs with no active invoice

affects:
  - 07-invoicing-and-payments/07-05-PLAN
  - src/app/api/invoices/[id]/pdf/route.ts
  - src/components/invoices/invoice-pdf.tsx
  - src/lib/invoices/pdf-data.ts
  - src/app/(app)/dispatch/popup/dispatch-popup.tsx
  - src/app/(app)/jobs/[id]/page.tsx
  - src/app/(app)/jobs/[id]/job-detail-shell.tsx
  - src/lib/jobs/jobs.ts

tech-stack:
  added: []
  patterns:
    - @react-pdf/renderer PDF generation mirroring estimates PDF route
    - Node.js runtime for PDF route (serverExternalPackages already configured)
    - Client Component calls 'use server' createInvoiceFromJobAction directly
    - router.refresh() after Close & Invoice per dispatch board auto-refresh contract

key-files:
  created:
    - src/app/api/invoices/[id]/pdf/route.ts
    - src/components/invoices/invoice-pdf.tsx
  modified:
    - src/lib/invoices/pdf-data.ts
    - src/app/(app)/dispatch/popup/dispatch-popup.tsx
    - src/app/(app)/jobs/[id]/page.tsx
    - src/app/(app)/jobs/[id]/job-detail-shell.tsx
    - src/lib/jobs/jobs.ts

key-decisions:
  - "Generated a signed Supabase Storage URL in getInvoiceForPdf so the work order signature image renders inside the PDF; storagePath alone is not a renderable URL."
  - "Added the Create Invoice button and invoice cross-link in the existing JobDetailShell client component rather than creating a separate wrapper, keeping the action trigger close to the summary view."
  - "Fixed the 'To Be Invoiced' bucket query in lib/jobs/jobs.ts (not jobs-sidebar.tsx, which is presentation-only) to completed jobs with no non-void invoice."

patterns-established:
  - "Invoice PDF route mirrors estimates PDF route exactly, substituting getInvoiceForPdf / InvoicePdfDocument / invoice-${N}.pdf."
  - "Work order PDF section reuses the invoice line items table, completion notes, and a signed signature image with a placeholder fallback."

requirements-completed:
  - INV-01
  - INV-08
  - INV-10
  - INV-11
  - INV-13

duration: 40min
completed: 2026-06-25
---

# Phase 07 Plan 05: Invoicing and Payments — Wave 4 Summary

**Shipped the invoice PDF generation route, wired the dispatch popup Close & Invoice and Deposits buttons, added a Create Invoice button and invoice cross-link on the job detail page, and fixed the Jobs 'To Be Invoiced' bucket to exclude already-invoiced completed jobs.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-06-25T11:25:00Z
- **Completed:** 2026-06-25T12:05:00Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- Created `src/app/api/invoices/[id]/pdf/route.ts` as a Node.js runtime GET handler that reads the `workOrder` search param, fetches invoice PDF data, and streams a PDF response with `Content-Type: application/pdf`.
- Created `src/components/invoices/invoice-pdf.tsx` exporting `InvoicePdfDocument({ data, workOrder? })`. It renders an INVOICE header with `INV-{invoiceNo}`, Bill To block, line items table, totals (Invoice Total, Amount Paid, highlighted Balance Due), a Payments Received table, and an optional Work Order section with line items, completion notes, and customer signature image.
- Updated `src/lib/invoices/pdf-data.ts` to generate a signed Supabase Storage URL for the completion signature so the PDF Image component can render it.
- Wired `src/app/(app)/dispatch/popup/dispatch-popup.tsx`: Deposits navigates to `/payments/new?jobId={id}&type=deposit`; Close & Invoice calls `createInvoiceFromJobAction`, navigates to `/invoices/{id}`, and calls `router.refresh()` so the dispatch board updates despite `self:false` Realtime config.
- Updated `src/app/(app)/jobs/[id]/page.tsx` to fetch the active invoice for the job and render an invoice cross-link below the header (INV-11).
- Updated `src/app/(app)/jobs/[id]/job-detail-shell.tsx` to show a primary **Create Invoice** button when `job.status === 'completed'` and no active invoice exists (INV-10).
- Fixed `src/lib/jobs/jobs.ts` so the `to_be_invoiced` bucket queries `status = 'completed'` jobs and excludes those that already have a non-void invoice.

## Task Commits

Each task was committed atomically:

1. **Task 1: Invoice PDF route + InvoicePdfDocument component** — `c4334bd` (feat)
2. **Task 2: Wire dispatch popup + job detail page + fix To Be Invoiced bucket** — `ade3f0e` (feat)

**Plan metadata:** pending (to be committed after this file)

## Files Created/Modified

- `src/app/api/invoices/[id]/pdf/route.ts` — PDF API route (Node.js runtime, auth + notFound handling, workOrder query param)
- `src/components/invoices/invoice-pdf.tsx` — `InvoicePdfDocument` React-PDF component
- `src/lib/invoices/pdf-data.ts` — Generates signed signature URL for work order PDF rendering
- `src/app/(app)/dispatch/popup/dispatch-popup.tsx` — Wired Deposits and Close & Invoice action buttons
- `src/app/(app)/jobs/[id]/page.tsx` — Fetches active invoice and renders invoice cross-link
- `src/app/(app)/jobs/[id]/job-detail-shell.tsx` — Create Invoice button for completed jobs
- `src/lib/jobs/jobs.ts` — Fixed `to_be_invoiced` bucket query

## Decisions Made

- Followed the estimates PDF route pattern exactly, substituting invoice-specific symbols and filename.
- Kept the signature image rendering in the work order section by signing the Supabase Storage path on the server before passing it to the PDF component.
- Used `useAuth()` from Clerk in the dispatch popup client component to obtain `orgId` for the server action call.
- Placed the Create Invoice button in `JobDetailShell` (already a client component) so the action call, loading state, and navigation live in one place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type] React-PDF Text style array rejected a boolean value**
- **Found during:** Task 1 (`pnpm build`)
- **Issue:** `style={[styles.itemMoney, item.type === 'discount' && { color: '#cc0000' }]}` produced `false` in the style array, which React-PDF's TypeScript types do not allow.
- **Fix:** Replaced with a spread conditional: `...(item.type === 'discount' ? [{ color: '#cc0000' }] : [])`.
- **Files modified:** `src/components/invoices/invoice-pdf.tsx`
- **Verification:** `pnpm build` exits 0.
- **Committed in:** `c4334bd` (Task 1)

**2. [Rule 1 - Type] Dispatch popup had no `orgId` in client scope**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** `createInvoiceFromJobAction(orgId, localJob.id)` failed because `orgId` was not defined in the client component.
- **Fix:** Imported `useAuth` from `@clerk/nextjs`, destructured `orgId`, and guarded the action call with a toast error if missing.
- **Files modified:** `src/app/(app)/dispatch/popup/dispatch-popup.tsx`
- **Verification:** `pnpm build` exits 0.
- **Committed in:** `ade3f0e` (Task 2)

**3. [Rule 1 - Type] `invoiceDate` inferred as `never` when checking for Date methods**
- **Found during:** Task 2 (`pnpm build`)
- **Issue:** The helper tried `row.invoiceDate?.toISOString()`, but Drizzle's `date` column type narrowed to `never` in that expression.
- **Fix:** Converted the value to string and sliced to `YYYY-MM-DD` regardless of whether it arrives as a string or Date.
- **Files modified:** `src/app/(app)/jobs/[id]/page.tsx`
- **Verification:** `pnpm build` exits 0.
- **Committed in:** `ade3f0e` (Task 2)

**4. [Rule 2 - Data] `signatureUrl` in `InvoicePdfData` was a storage path, not a renderable URL**
- **Found during:** Task 1 implementation review
- **Issue:** `getInvoiceForPdf` returned `signatureRow?.storagePath` directly. React-PDF `Image` requires a URL or buffer; a raw storage path would fail to render.
- **Fix:** Added a server-only Supabase service-client helper to create a signed URL and updated the returned `signatureUrl` to the signed URL.
- **Files modified:** `src/lib/invoices/pdf-data.ts`
- **Verification:** `pnpm build` exits 0; work order section can now render the signature image.
- **Committed in:** `c4334bd` (Task 1)

**5. [Plan Guidance] 'To Be Invoiced' bucket logic lives in `lib/jobs/jobs.ts`, not `jobs-sidebar.tsx`**
- **Found during:** Task 2
- **Issue:** The plan instructed modifying `src/app/(app)/jobs/jobs-sidebar.tsx`, but that file is presentation-only and has no count/query logic. The actual bucket filter is in `src/lib/jobs/jobs.ts`.
- **Fix:** Updated `listJobs` in `src/lib/jobs/jobs.ts` to use `status = 'completed'` plus `NOT EXISTS (SELECT 1 FROM invoices ... status != 'void')`.
- **Files modified:** `src/lib/jobs/jobs.ts`
- **Verification:** `pnpm build` exits 0; TypeScript query compiles.
- **Committed in:** `ade3f0e` (Task 2)

---

**Total deviations:** 5 auto-fixed (3 type/build, 1 data correctness, 1 plan-location adjustment)
**Impact on plan:** All fixes were required for the build to pass and the features to work correctly. No scope creep.

## Issues Encountered

- None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Invoice PDF route and component are ready for Phase 8 email attachments and PWA PDF download.
- `createInvoiceFromJobAction` is now reachable from both the dispatch popup and the job detail page.
- The `to_be_invoiced` bucket correctly surfaces only completed jobs awaiting an invoice.

---
*Phase: 07-invoicing-and-payments*
*Completed: 2026-06-25*
