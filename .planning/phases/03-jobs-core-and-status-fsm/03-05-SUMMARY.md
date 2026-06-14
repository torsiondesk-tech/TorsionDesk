---
phase: 03-jobs-core-and-status-fsm
plan: 05
subsystem: ui
tags: [nextjs, tanstack-table, nuqs, supabase-storage, server-only, drizzle]

requires:
  - phase: 03-04
    provides: [job-form, line-items, status-dropdown]

provides:
  - /jobs dashboard with 8-bucket nested sidebar and sortable TanStack Table
  - /jobs/[id] detail page with 6 top tabs (Summary, Custom Fields, Pics, Docs, Equipment, Sign)
  - Equipment tab read-only query of Phase 1 equipment by service_location_id
  - Pics tab with Supabase Storage upload via server-only service-role path
  - uploadJobPhoto helper with MIME/ext allow-list and tenant-scoped path

affects:
  - 04-dispatch-board
  - 05-technician-mobile-pwa

tech-stack:
  added: []
  patterns:
    - "Server-only Supabase Storage upload: import 'server-only' + service-role client for trusted tenant-scoped uploads"
    - "Signed URL generation for private bucket images passed from RSC to client component"

key-files:
  created:
    - src/app/(app)/jobs/page.tsx
    - src/app/(app)/jobs/jobs-table.tsx
    - src/app/(app)/jobs/jobs-sidebar.tsx
    - src/app/(app)/jobs/[id]/page.tsx
    - src/app/(app)/jobs/[id]/tabs/equipment-tab.tsx
    - src/app/(app)/jobs/[id]/tabs/pics-tab.tsx
    - src/lib/jobs/photos.ts
  modified:
    - src/lib/jobs/jobs.ts
    - src/app/(app)/jobs/actions.ts
    - src/lib/customers.ts
    - tests/jobs/jobs.test.ts
    - tests/jobs/tags.test.ts

key-decisions:
  - "Enhanced listJobs with left joins for customerName/city/category and bucket filtering via EXISTS subqueries"
  - "Equipment tab is an async RSC that calls auth() internally and queries by service_location_id only (never customer_id)"
  - "Photo display uses server-generated signed URLs (1-hour expiry) passed as props to the client PicsTab; router.refresh() refreshes them after upload"

requirements-completed: [JOB-11, JOB-12, JOB-13]

duration: 13min
completed: 2026-06-14
---

# Phase 3 Plan 5: Jobs Dashboard and Detail Page Summary

**Jobs dashboard with 8-bucket sidebar and sortable TanStack Table; detail page with six tabs including read-only Equipment and functional Pics upload via server-only Supabase Storage**

## Performance

- **Duration:** 13 min
- **Started:** 2026-06-14T10:41:22Z
- **Completed:** 2026-06-14T10:54:43Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Built `/jobs` dashboard with nested left sidebar (8 buckets + per-tag counts) and a sortable TanStack Table defaulting to All Open Jobs
- Created `/jobs/[id]` detail page with six top tabs: Summary (edit-mode JobForm), Custom Fields/Docs/Sign stubs, Equipment (read-only), and Pics (upload + grid)
- Implemented server-only `uploadJobPhoto` with image MIME/ext allow-list, 10 MB size cap, and tenant-scoped path in `tenant-assets` bucket
- Added `getJobPhotoSignedUrls` for secure display of private-bucket images
- Equipment tab queries Phase 1 `equipment` table exclusively by `service_location_id` (never `customer_id`)

## Task Commits

Each task was committed atomically:

1. **Task 1: /jobs dashboard — RSC page + JobsTable + nested JobsSidebar** — `0635485` (feat)
2. **Task 2: /jobs/[id] detail page with 6 top tabs** — `1c52a09` (feat)
3. **Task 3: Equipment tab + Pics tab + uploadJobPhoto** — `533a9a9` (feat)

**Plan metadata:** `533a9a9` (docs: complete plan)

## Files Created/Modified
- `src/app/(app)/jobs/page.tsx` — RSC dashboard with two-column layout (sidebar + table)
- `src/app/(app)/jobs/jobs-sidebar.tsx` — Client sidebar with 8 buckets and per-tag counts via nuqs
- `src/app/(app)/jobs/jobs-table.tsx` — TanStack Table with manualPagination/manualSorting, sortable headers, status badges
- `src/app/(app)/jobs/[id]/page.tsx` — Detail RSC with 6 tabs, maps getJob result to JobFormData
- `src/app/(app)/jobs/[id]/tabs/equipment-tab.tsx` — Async RSC card grid of equipment by service_location_id
- `src/app/(app)/jobs/[id]/tabs/pics-tab.tsx` — Client upload control + photo grid with signed URLs
- `src/lib/jobs/photos.ts` — Server-only upload and signed URL generation
- `src/lib/jobs/jobs.ts` — Enhanced listJobs (joins + bucket filters), getJob (customerName + photos), countJobsByTag (name/color)
- `src/app/(app)/jobs/actions.ts` — Added uploadJobPhotoAction server action
- `src/lib/customers.ts` — Added getEquipmentByServiceLocation helper
- `tests/jobs/jobs.test.ts` — Added leftJoin to mock tx
- `tests/jobs/tags.test.ts` — Added innerJoin + name/color to mock tx

## Decisions Made
- Used EXISTS subqueries for bucket filters (my_jobs, my_additional_visits, tag) to avoid dynamic join complexity in Drizzle
- Passed signed URLs from RSC to client rather than creating an API route; router.refresh() regenerates fresh URLs after upload
- Equipment tab made async RSC instead of client component to keep data fetching server-side and avoid prop drilling orgId

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Enhanced listJobs and getJob with required joins and bucket support**
- **Found during:** Task 1 (dashboard table implementation)
- **Issue:** The existing `listJobs` returned only id/jobNo/customerId/status/priority/createdAt, but the table needs customerName, city, category, description. The existing `getJob` didn't return customerName or photos, which the detail page header and Pics tab need. `countJobsByTag` didn't return tag names/colors.
- **Fix:** Extended `JobRow` and `ListOpts` interfaces; updated `listJobs` with left joins to customers/serviceLocations/jobCategories and bucket/tag/userId filtering. Enhanced `getJob` to query customerName and photos. Extended `countJobsByTag` to join tags and return name/color.
- **Files modified:** `src/lib/jobs/jobs.ts`
- **Verification:** `pnpm build` passes; `/jobs` and `/jobs/[id]` routes compile
- **Committed in:** `0635485` (Task 1) and `1c52a09` (Task 2)

**2. [Rule 2 - Missing Critical] Added getEquipmentByServiceLocation to customers.ts**
- **Found during:** Task 3 (Equipment tab implementation)
- **Issue:** No standalone server function existed to query equipment by service_location_id; the existing `getCustomerWithLocationsAndEquipment` requires a customerId.
- **Fix:** Added `getEquipmentByServiceLocation(orgId, serviceLocationId)` to `src/lib/customers.ts`.
- **Files modified:** `src/lib/customers.ts`
- **Verification:** Equipment tab renders equipment cards
- **Committed in:** `533a9a9` (Task 3)

**3. [Rule 3 - Blocking] Fixed test mocks for leftJoin/innerJoin**
- **Found during:** Task 3 (verification)
- **Issue:** `jobs.test.ts` and `tags.test.ts` mocks didn't support `leftJoin`/`innerJoin`, causing TypeErrors after the dashboard queries were enhanced with joins.
- **Fix:** Added `leftJoin` to `makeEmptyTx` in `jobs.test.ts` and `innerJoin` + name/color fields to the mock in `tags.test.ts`.
- **Files modified:** `tests/jobs/jobs.test.ts`, `tests/jobs/tags.test.ts`
- **Verification:** Both test files pass individually
- **Committed in:** `533a9a9` (Task 3)

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and testability. No scope creep.

## Issues Encountered
- `jobLineItems` schema fields (`type`, `description`, `qty`, `rate`, `cost`) are nullable in Drizzle `$inferSelect` despite being logically required; mapped with defaults in detail page to satisfy `JobFormLineItem` type.
- `equipment.installDate` field name differs from the assumed `installedDate`; corrected in EquipmentTab after build error.

## Known Stubs

| File | Line | Description | Resolution |
|------|------|-------------|------------|
| `src/app/(app)/jobs/[id]/page.tsx` | ~153 | Custom Fields tab — "Coming in a later release." | Planned: custom fields schema in a later phase |
| `src/app/(app)/jobs/[id]/page.tsx` | ~161 | Docs tab — "Coming in a later release." | Planned: file attachments in a later phase |
| `src/app/(app)/jobs/[id]/page.tsx` | ~173 | Sign tab — "Coming in a later release." | Planned: digital signature in Phase 5 (tech PWA) |
| `src/app/(app)/jobs/jobs-sidebar.tsx` | ~43 | Advanced Search bucket — clickable but no special filter logic | Planned: advanced search filters in a later phase |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info-disclosure | `src/lib/jobs/jobs.ts` | listJobs/getJob now join across customers/serviceLocations/jobCategories tables; all queries remain tenant-scoped via withTenant + explicit eq(tenantId) |
| threat_flag: tampering | `src/lib/jobs/photos.ts` | uploadJobPhoto validates image MIME/ext, enforces 10MB cap, uses fixed tenant-scoped path; service-role key protected by `import 'server-only'` |

## Next Phase Readiness
- Jobs dashboard and detail page surfaces are complete and routable
- Equipment tab proves service_location_id FK pattern for Phase 1 → Phase 3 integration
- Photo upload infrastructure is reusable for other file-attachment features (Docs tab, estimates, etc.)
- No blockers

---
*Phase: 3-jobs-core-and-status-fsm*
*Completed: 2026-06-14*
