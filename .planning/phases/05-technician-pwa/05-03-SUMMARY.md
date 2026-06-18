---
phase: 05-technician-pwa
plan: 03
type: summary
wave: 3
requirements: [TECH-04, TECH-05, TECH-06, TECH-07]
---

# 05-03 Summary — On-Site Capture: Photos, Signatures, Notes, Equipment Specs

## Objective
Complete the on-site job runtime so a technician can capture before/after photos, collect a customer signature, write completion notes, and reference equipment/spring specs — all offline-queued and auto-synced.

## What was built

### Photos
- `src/app/(tech)/components/photo-uploader.tsx` — camera file input, thumbnail grid, pending/failed badges, retry, and delete-queued-photo dialog.
- `src/app/(tech)/lib/sync.ts` — `syncPhoto` flush handler: get presigned URL via `getJobPhotoUploadUrlAction`, `fetch(PUT)` blob directly to Supabase Storage, confirm via `confirmJobPhotoAction`.
- Wired into the Photos tab of `src/app/(tech)/tech/jobs/[id]/page.tsx`.

### Signatures
- `src/app/(tech)/components/tech-signature-pad.tsx` — `signature_pad` touch canvas with `touch-none`, Clear/Save buttons, customer-name input, and `job_signature` outbox enqueue.
- `src/lib/jobs/signatures.ts` — server-only module mirroring `src/lib/jobs/photos.ts`:
  - `createJobSignatureSignedUploadUrl`
  - `confirmJobSignature`
  - `getJobSignatureSignedUrls`
  - Uses Supabase Storage bucket `tenant-assets`, 10 MB cap, PNG/JPG/WEBP whitelist, path `${orgId}/jobs/${jobId}/${uuid}.${ext}`.
- `src/app/(tech)/tech/jobs/actions.ts` — added `getJobSignatureUploadUrlAction`, `confirmJobSignatureAction`.
- `src/app/(tech)/lib/sync.ts` — `syncSignature` flush handler.
- Wired into the Sign tab.

### Completion notes
- `src/app/(tech)/components/completion-notes.tsx` — textarea with Save, offline queue, and a discard-changes dialog.
- `src/app/(tech)/tech/jobs/actions.ts` — `saveCompletionNotesAction(jobId, notes)` updates `jobs.completionNotes` under `withTenant`.
- `src/app/(tech)/lib/sync.ts` — `syncNote` flush handler for `job_note` outbox items.
- Wired into the Notes tab.

### Equipment / spring specs
- `src/app/(tech)/components/equipment-section.tsx` — read-only collapsible cards for door/opener/spring equipment at the service location.
- `src/app/(tech)/tech/jobs/actions.ts` — `getEquipmentByServiceLocationAction` wrapper.
- `src/app/(tech)/lib/sync.ts` — `hydrateTechData` now caches equipment rows into Dexie for offline viewing.
- Wired into the Summary tab.

### Shared updates
- `src/lib/jobs/jobs.ts` — `JobRow`/`listJobs` now selects `contactId`, `serviceLocationId`, `notesForTechs`, `completionNotes`.
- `src/components/ui/collapsible.tsx` — new Base UI collapsible primitive used by the equipment section.
- `package.json` / `pnpm-lock.yaml` — added `@testing-library/user-event` for component tests.

## Tests
- `tests/tech/photo-sync.test.ts` — presigned URL flow, direct upload, confirm, failure.
- `tests/tech/signature-pad.test.tsx` — signature pad render, save, clear, offline queue.
- `tests/tech/notes-sync.test.tsx` — note save + offline queue.
- `tests/tech/equipment.test.tsx` — equipment section render from cached Dexie data.

## Verification results
- `pnpm test --run tests/tech/photo-sync.test.ts tests/tech/signature-pad.test.tsx tests/tech/notes-sync.test.tsx tests/tech/equipment.test.tsx` — 8/8 passing
- `pnpm test --run` — 134 passed, 2 skipped, 2 todo
- `pnpm exec tsc --noEmit` — clean
- `pnpm build` — succeeded (32 routes, `/tech/jobs/[id]` at 17.3 kB)

## Key deviations
- PWA routes use `src/app/(tech)/tech/jobs/...` due to the route-collision fix.
- `notes-sync.test.tsx` is `.test.tsx` rather than `.test.ts` because it renders JSX; Vitest covers it in both targeted and full runs.
- The subagent's worktree originally contained stubs for unrelated in-progress files (dispatch board, global search, status-colors, etc.). Those were excluded from the merge to avoid overwriting main's existing work; only the required `collapsible.tsx` primitive was brought over.

## Threats closed
- T-05-03: Status/photo/signature/note writes all route through authenticated server actions with `withTenant` RLS enforcement.
- T-05-09: Outbox replay requires an active Clerk session; server actions reject missing orgId.
- T-05-11: Failed illegal transitions mark outbox items `failed` instead of infinitely retrying.

## Next
Wave 4 / 05-04: estimates surface — view/create estimates, line items, convert estimate to job, offline queue for estimate actions.
