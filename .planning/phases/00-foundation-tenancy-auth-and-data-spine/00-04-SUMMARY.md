---
phase: 00-foundation-tenancy-auth-and-data-spine
plan: 04
subsystem: settings
tags: [settings, clerk-invitations, supabase-storage, rbac, tenant-profile, shadcn, next15, blocked-task]

# Dependency graph
requires:
  - "00-02 tenant spine (saveProfile/getProfile, withTenant, tenants schema + logo_url, RLS pgPolicy)"
  - "00-03 app shell + middleware /settings admin gate + shadcn primitives (Button/Card/Input/Label)"
provides:
  - "Settings tab shell (layout.tsx + SettingsTabs): ten sections, Company Profile + Users functional, eight stubbed 'Available in Phase N' (D-13)"
  - "/settings index redirect -> /settings/company-profile"
  - "Functional Company Profile tab: full profile form (name/address/phone/email) + tenant-scoped logo upload with preview (TENANT-02, D-11/D-12)"
  - "src/lib/storage.ts uploadLogo(orgId, file): service-role server-only upload to tenant-assets/{orgId}/logo.* (Pattern 8a, T-00-04)"
  - "saveProfile extended with optional logoUrl so tenants.logo_url persists"
  - "Functional Users tab: inviteUser via Clerk org invitations + member/pending-invite lists (AUTH-02, D-06)"
affects: [00-05, every-future-settings-tab, invoicing, communications, dispatch]

# Tech tracking
tech-stack:
  added: []   # @supabase/supabase-js@2.108.1 already in lockfile from Plan 02; no new packages (T-00-SC)
  patterns:
    - "Settings tabs: client SettingsTabs uses usePathname for active state; layout.tsx (server) frames it; access control stays in middleware (D-13/D-15)"
    - "Logo upload: service-role Supabase client created inside the server-only storage module (import 'server-only'); path constrained to {orgId}/ (T-00-04, T-00-11)"
    - "Clerk org invitations via clerkClient().organizations.createOrganizationInvitation — role constrained by zod to org:admin/org:dispatcher/org:technician (T-00-10, A2)"
    - "Members + pending invites read via getOrganizationMembershipList / getOrganizationInvitationList (status: ['pending'])"

key-files:
  created:
    - src/lib/storage.ts
    - src/app/(app)/settings/layout.tsx
    - src/app/(app)/settings/settings-tabs.tsx
    - src/app/(app)/settings/page.tsx
    - src/app/(app)/settings/company-profile/page.tsx
    - src/app/(app)/settings/company-profile/profile-form.tsx
    - src/app/(app)/settings/company-profile/actions.ts
    - src/app/(app)/settings/users/page.tsx
    - src/app/(app)/settings/users/invite-form.tsx
    - src/app/(app)/settings/users/actions.ts
  modified:
    - src/lib/profile.ts

key-decisions:
  - "Extended profileSchema with an optional logoUrl so the plan's 'persist the uploaded logo URL via saveProfile' is satisfiable — saveProfile is the documented key_link from company-profile actions, and tenants.logo_url already existed in the schema"
  - "Split each tab into a server page (data fetch via getProfile/listOrgPeople) + a client form (useActionState) — mirrors the established onboarding pattern and keeps server actions co-located"
  - "Logo preview uses a client object-URL for the freshly chosen file (always renderable) + a 'Logo on file' state for the persisted path, because the tenant-assets bucket is private (signed-URL rendering is deferred to the phase that consumes the logo)"
  - "Added a /settings index redirect to /settings/company-profile so the sidebar Settings link never lands on an empty root"

patterns-established:
  - "Every future settings section adds a route under (app)/settings/<tab> and flips its SettingsTabs entry from a stub to a functional href"
  - "Tenant-scoped Storage writes go through src/lib/storage.ts (server-only, service-role, {orgId}/ path) — the canonical upload gate"

requirements-completed: []   # AUTH-02 + TENANT-02 functionally built; final completion gated on Task 3 schema push (see Blockers)

# Metrics
duration: ~20min
completed: 2026-06-11
---

# Phase 0 Plan 04: Settings — Company Profile + Users (+ schema push) Summary

**The two functional Settings tabs are real: a tab shell showing all ten sections (Company Profile + Users live, eight stubbed "Available in Phase N", D-13), a full Company Profile form with tenant-scoped Supabase-Storage logo upload (TENANT-02), and a Users tab that invites teammates by email with a role through Clerk's built-in organization invitations (AUTH-02). The [BLOCKING] `drizzle-kit push` (Task 3) is blocked on the deferred external-setup checkpoint — no `DATABASE_URL`/Supabase credentials exist in this worktree — and must run at the end-of-phase gate.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 planned — 2 complete (Tasks 1-2), 1 BLOCKED (Task 3, external credential gate)
- **Files:** 10 created, 1 modified

## Accomplishments
- **Settings tab shell (Task 1):** `src/app/(app)/settings/layout.tsx` frames the section; `settings-tabs.tsx` (client, `usePathname`) lists all ten tabs in their permanent order — Company Profile, Users, Job Categories, Tags, Templates, Email, SMS, Payment Methods, Tax Items, Lookup Lists (D-13). Company Profile and Users are real links with an active state; the other eight render visible-but-disabled with a "Phase N" badge. A `/settings` index page redirects to `/settings/company-profile`.
- **Company Profile tab (Task 1, TENANT-02):** `company-profile/page.tsx` (server) pre-fills the form via `getProfile()`; `profile-form.tsx` (client, `useActionState`) renders name / address / phone / email plus a logo file input with a live object-URL preview. `actions.ts` exposes `saveCompanyProfile` (zod-validated full profile → `saveProfile`) and `uploadCompanyLogo` (→ `uploadLogo` → persist path via `saveProfile`). Every action reads `orgId` from `auth()` and fails closed.
- **Tenant-scoped logo upload (Task 1, D-12):** `src/lib/storage.ts` `uploadLogo(orgId, file)` uploads to the private `tenant-assets` bucket at `{orgId}/logo.<ext>` using a service-role Supabase client. The module imports `server-only` so the service-role key can never reach the client bundle (T-00-04); the path is constrained to `{orgId}/` (T-00-11); extension is mapped from a known-safe allowlist, never trusted raw.
- **Users tab (Task 2, AUTH-02):** `users/actions.ts` `inviteUser` calls `clerkClient().organizations.createOrganizationInvitation({ organizationId, emailAddress, role })` — Clerk's built-in invitation system (D-06), no custom token table, no Resend. `role` is zod-constrained to exactly `org:admin` / `org:dispatcher` / `org:technician` (T-00-10, A2). `listOrgPeople` reads members + pending invites via `getOrganizationMembershipList` / `getOrganizationInvitationList({ status: ['pending'] })`. `users/page.tsx` renders the invite form (Admin/Dispatcher/Technician select) and both lists.
- `pnpm build` exits 0 with 11 routes, including `/settings`, `/settings/company-profile`, and `/settings/users`.

## Task Commits

1. **Task 1: Settings shell + functional Company Profile tab (profile + logo upload)** — `32059e7` (feat)
2. **Task 2: Functional Users tab — invite by email + assign role via Clerk** — `3e85d88` (feat)
3. **Task 3: [BLOCKING] Push Drizzle schema to Supabase** — NOT RUN (blocked on external credentials; see Blockers).

## Files Created/Modified
- `src/lib/storage.ts` — `uploadLogo` (service-role, server-only, `{orgId}/logo.*`)
- `src/app/(app)/settings/layout.tsx` — settings shell framing the tabs + content
- `src/app/(app)/settings/settings-tabs.tsx` — ten-tab nav (2 functional, 8 stubbed)
- `src/app/(app)/settings/page.tsx` — `/settings` → `/settings/company-profile` redirect
- `src/app/(app)/settings/company-profile/page.tsx` — server page, pre-fills via `getProfile`
- `src/app/(app)/settings/company-profile/profile-form.tsx` — client form + logo preview
- `src/app/(app)/settings/company-profile/actions.ts` — `saveCompanyProfile` + `uploadCompanyLogo`
- `src/app/(app)/settings/users/page.tsx` — server page, members + pending-invite lists
- `src/app/(app)/settings/users/invite-form.tsx` — client invite form (email + role select)
- `src/app/(app)/settings/users/actions.ts` — `inviteUser` + `listOrgPeople` (Clerk SDK)
- `src/lib/profile.ts` — **modified:** added optional `logoUrl` to `profileSchema` so the uploaded logo persists on `tenants.logo_url`

## Decisions Made
- **Extended `saveProfile` with `logoUrl` (optional):** the plan's key_link requires the Company Profile actions to persist the uploaded logo URL *via `saveProfile`*, but the Plan-02 `profileSchema` had no `logoUrl` field (the `tenants.logo_url` column already existed). I added it as an optional string so onboarding (no logo) and the Settings logo upload both work through one action. Drizzle ignores `undefined` `.set()` values, so the onboarding write is unchanged.
- **Server-page + client-form split per tab:** each tab's `page.tsx` is a server component that fetches data (`getProfile`, `listOrgPeople`); the interactive piece is a client component using React 19 `useActionState`. This mirrors the established onboarding pattern (Plan 03) and co-locates the server actions with their tab.
- **Private-bucket logo preview:** `tenant-assets` is private (per `user_setup`), so a stored object path is not directly renderable without a signed URL. For Phase 0 the preview shows the freshly chosen file via a client object URL (always works) and otherwise a "Logo on file" indicator + the stored path. Signed-URL rendering is deferred to the phase that actually paints the logo onto invoices/email (consistent with D-12: "later phases read the stored URL").
- **`/settings` index redirect:** the sidebar links to `/settings`; rather than leave that root empty, it redirects to the first functional tab.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed dependencies in the fresh worktree**
- **Found during:** Pre-Task-1 baseline
- **Issue:** The worktree had no `node_modules` (not shared from the parent checkout), so `pnpm build` could not run. `@supabase/supabase-js@2.108.1` (needed by `storage.ts`) was already pinned in the existing `pnpm-lock.yaml` from Plan 02 — no new package.
- **Fix:** Ran `pnpm install` against the existing lockfile. A cosmetic peer-descriptor normalization to `pnpm-lock.yaml` (no dependency added/removed) was reverted to keep the worktree clean.
- **Files modified:** none committed.
- **Commit:** n/a (environment setup)

**2. [Rule 2 - Missing functionality] Added optional `logoUrl` to `profileSchema`**
- **Found during:** Task 1 (wiring `uploadCompanyLogo`)
- **Issue:** The plan requires the logo URL to persist via `saveProfile`, but `saveProfile` could not accept it.
- **Fix:** Added `logoUrl: z.string().optional()` to `profileSchema` in `src/lib/profile.ts`. The `tenants.logo_url` column already existed (Plan 02); this only opens the write path.
- **Files modified:** `src/lib/profile.ts`
- **Commit:** `32059e7`

### Adaptations (not deviations from intent)
- `inviteUser` is exported as a 2-arg `useActionState` action `(prevState, formData)` rather than the literal `inviteUser(email, role)`; email and role are read from the form and passed to Clerk's `createOrganizationInvitation`. The contract (Clerk org invitation, no tokens, role-constrained) is met.

**Total deviations:** 2 (1 Rule 3 environment setup, 1 Rule 2 schema field). No architectural (Rule 4) changes. No scope creep.

## Blockers

**Task 3 ([BLOCKING] `pnpm exec drizzle-kit push`) is BLOCKED on the deferred external-setup checkpoint.**

- **What:** `drizzle-kit push` requires a live Supabase `DATABASE_URL`. This worktree has no `.env.local` and `DATABASE_URL` is unset. Running the push fails immediately with: `Error  Either connection "url" or "host", "database" are required for PostgreSQL database connection`.
- **Why this is expected, not a bug:** The plan is `autonomous: false` precisely because Task 3 touches the live database. The Supabase project + connection string is part of the external-setup checkpoint that Plan 02 (Task 1) deferred to the end-of-phase gate, per the project config `human_verify_mode: "end-of-phase"` and `auto_advance: false`. No deviation rule covers fabricating a database credential — and per the package/credential safety rules, a parallel worktree agent must not invent or guess connection strings.
- **Required manual action (at the phase gate, by the human):**
  1. Populate `.env.local` from `.env.local.example` with the real Supabase `DATABASE_URL` (prefer the **direct** connection `:5432` for the push, per RESEARCH Pitfall 3 / T-00-05), `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
  2. Create the private Storage bucket `tenant-assets` (Supabase Dashboard → Storage → Buckets), per this plan's `user_setup`.
  3. Run `pnpm exec drizzle-kit push` (pnpm — never npx) to create the `tenants` table and its `tenant_self_isolation` RLS policy in the database.
  4. Confirm the table + policy exist, then the Plan 05 cross-tenant integration test can run against the real table.
- **Code readiness:** No code change is required for Task 3 — `src/db/schema.ts` (Plan 02) is final and unchanged by this plan; the push is purely an apply step. The schema is ready to push the moment credentials exist.

## Checkpoints
This plan is `autonomous: false`. Task 3 is the BLOCKING gate; it converts to the external-setup human checkpoint described under Blockers. Tasks 1-2 are fully automated (`type="auto"`, `pnpm build` verification) and required no live external services to build and verify.

## Issues Encountered
- Git `LF will be replaced by CRLF` warnings on Windows for new text files — cosmetic (autocrlf), no action.
- `pnpm install` (run for the build) re-normalized a peer-descriptor line in `pnpm-lock.yaml` with no real dependency change; reverted each time to keep the tree clean.

## Known Stubs
- The eight non-functional Settings tabs (Job Categories, Tags, Templates, Email, SMS, Payment Methods, Tax Items, Lookup Lists) render disabled "Phase N" placeholders **by design** (D-13). They are the intentional Settings skeleton, not data stubs that block this plan's goal — each lights up in its owning phase (2/7/8).
- The logo preview shows a "Logo on file" indicator (not the actual stored image) for a previously-persisted logo, because the bucket is private and signed-URL rendering is deferred to the consuming phase (D-12). The fresh-upload object-URL preview is fully functional. This does not block TENANT-02 — the file IS uploaded to tenant-scoped Storage and the path IS persisted.

## Threat Flags
None. All security-relevant surface introduced (the service-role logo upload, the Clerk invitation path, the profile/logo writes) is covered by this plan's `<threat_model>` (T-00-04, T-00-10, T-00-11, T-00-05, T-00-SC). No new endpoints, schema, or trust boundaries beyond the plan: `uploadLogo` is server-only and tenant-folder-scoped; `inviteUser` is role-constrained; profile writes run through `saveProfile`/`withTenant`.

## Next Phase Readiness
- **Before Plan 05 / the phase gate:** complete the external-setup checkpoint (populate `.env.local`, create the `tenant-assets` bucket) and run `pnpm exec drizzle-kit push` (Task 3) so the `tenants` table + RLS policy physically exist. The Plan 05 cross-tenant integration test depends on this.
- AUTH-02 (Clerk invitations) and TENANT-02 (profile + logo) are functionally built and build-green; their requirement completion should be marked once the schema push lands and manual verification (set profile + upload logo persists across reload; invite a teammate → Clerk sends the email) passes at the phase gate.
- Every future Settings section activates by adding `(app)/settings/<tab>` and flipping its `SettingsTabs` stub entry to a functional `href`.

## Self-Check: PASSED
- Files: all 10 created artifacts + the modified `src/lib/profile.ts` present on disk (verified during build; `/settings`, `/settings/company-profile`, `/settings/users` all appear in the `pnpm build` route table).
- Commits: `32059e7` (Task 1) and `3e85d88` (Task 2) present in git log (verified).
- Verification: `pnpm build` exits 0 (11 routes). Task 3 verification deliberately NOT claimed — it is blocked on external credentials and documented as such; no false "schema pushed" claim is made.

---
*Phase: 00-foundation-tenancy-auth-and-data-spine*
*Completed (Tasks 1-2; Task 3 blocked): 2026-06-11*
