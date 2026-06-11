---
phase: 00-foundation-tenancy-auth-and-data-spine
plan: 03
subsystem: auth-shell
tags: [clerk, middleware, rbac, shadcn, tailwind-v4, app-shell, defense-in-depth, next15]

# Dependency graph
requires:
  - "00-02 scaffold + tenant spine (ClerkProvider, visibleModules, saveProfile/getProfile, withTenant, webhook)"
provides:
  - "clerkMiddleware security perimeter: public matcher (/sign-in, /sign-up, /api/webhooks), org:technician -> /mobile-coming-soon redirect, /settings org:admin gate"
  - "Custom-route Clerk <SignIn/> and public <SignUp/> pages (workspace-creation front door)"
  - "/onboarding company-name+phone form + completeOnboarding server action -> saveProfile -> /dashboard"
  - "/mobile-coming-soon technician holding page (no nav)"
  - "Protected (app) shell: server layout reads orgRole via auth(), dark role-filtered <Sidebar/>"
  - "Dashboard with four placeholder metric cards (Open Jobs / Unpaid Invoices / Today's Schedule / Recent Activity)"
  - "shadcn/ui configured (components.json) + Button/Card/Input/Label primitives + theme tokens"
affects: [00-04, 00-05, walking-skeleton, every-future-module-route, settings, dispatch, jobs]

# Tech tracking
tech-stack:
  added:
    - "@base-ui/react@1.5.0"
    - class-variance-authority@0.7.1
    - clsx@2.1.1
    - lucide-react@1.17.0
    - shadcn@4.11.0
    - tailwind-merge@3.6.0
    - tw-animate-css@1.4.0
  patterns:
    - "clerkMiddleware default-public: every non-public route opts into auth.protect()"
    - "Role read server-side via auth() (orgRole), passed to client Sidebar; middleware is the enforcement layer, nav hiding is UX-only (D-16)"
    - "Unbuilt nav modules render visible-but-disabled (non-clickable), role-forbidden modules are hidden (D-08/D-16)"
    - "Onboarding via React 19 useActionState + 'use server' action that validates (zod) then saveProfile then redirect"
    - "Placeholder dashboard cards show em-dash + Available-in-Phase-N note, no fake numbers (D-09)"

key-files:
  created:
    - src/middleware.ts
    - src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
    - src/app/onboarding/page.tsx
    - src/app/onboarding/actions.ts
    - src/app/mobile-coming-soon/page.tsx
    - src/app/(app)/layout.tsx
    - src/app/(app)/dashboard/page.tsx
    - src/components/shell/sidebar.tsx
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/lib/utils.ts
    - components.json
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "shadcn style is base-nova (the current shadcn default), not the plan's literal 'new-york' — new-york was deprecated/removed from the modern shadcn CLI; base-nova is its successor and meets D-10 (modern shadcn design language)"
  - "Onboarding action calls saveProfile(input) with no orgId arg — saveProfile already resolves the active org from the verified session internally (Plan 02 contract); the action additionally asserts an active org up front to fail closed"
  - "Entrance animations use tw-animate-css (animate-in / fade-in) — shadcn installed it; avoids adding the motion dependency the plan did not list while still meeting the global UI entrance-animation standard"

patterns-established:
  - "Every future module route group sits under (app) and inherits the role-gated shell + sidebar — phases only flip their nav item's `enabled` flag"
  - "Server-side role enforcement lives in middleware; client nav hiding is declared UX-only (D-16) and never trusted for access control"

requirements-completed: [AUTH-01, AUTH-03, AUTH-04, AUTH-05, AUTH-06]

# Metrics
duration: 28min
completed: 2026-06-11
---

# Phase 0 Plan 03: Auth Perimeter + App Shell Summary

**`clerkMiddleware` security perimeter (public sign-in/sign-up/webhook matcher, technician→/mobile-coming-soon redirect, /settings admin gate), custom-route Clerk `<SignIn/>`/public `<SignUp/>`, the company-name+phone `/onboarding` flow wired to `saveProfile`, the technician holding page, and the protected `(app)` shell with a dark role-filtered sidebar (all nine modules, unbuilt disabled) plus a placeholder-card dashboard — the navigable, role-gated, defense-in-depth front door to the app.**

## Performance

- **Duration:** ~28 min
- **Tasks:** 3
- **Files:** 15 created, 4 modified

## Accomplishments
- Built `src/middleware.ts` (`clerkMiddleware` + `createRouteMatcher`): `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)` are public (D-01/D-03 + Pitfall 4 — webhook reachable so org provisioning never 401s); every other route requires `auth.protect()`; `org:technician` is redirected to `/mobile-coming-soon` (D-14, T-00-07); `/settings(.*)` additionally requires `auth.protect({ role: 'org:admin' })` (D-15, T-00-06 — server-side gate, not nav hiding); `config.matcher` excludes `_next` and static files.
- Initialized shadcn/ui (`components.json`, base-nova style, neutral base color, CSS variables) and added the Button, Card, Input, Label primitives; the full shadcn theme token set (including sidebar tokens) now lives in `globals.css`.
- Created the custom-route Clerk auth pages: public `<SignUp/>` (the workspace-creation front door, D-01/D-03/D-04) and `<SignIn/>` (AUTH-03/04/05 — password reset and session persistence are built into the Clerk components).
- Built `/onboarding`: a fast two-field (company name + phone) shadcn form using React 19 `useActionState`, submitting to a `completeOnboarding` `'use server'` action that asserts an active org, validates with zod, calls `saveProfile`, and redirects to `/dashboard` (D-05/D-11). No 5-step wizard.
- Built `/mobile-coming-soon`: a clean centered technician holding page with NO sidebar/nav (D-14), deliberately outside the `(app)` group so it never inherits the shell.
- Built the protected `(app)` shell: `layout.tsx` reads `orgRole` via `auth()` and renders the client `<Sidebar/>`; the dark sidebar lists all nine modules in SF terminology (Dashboard, Jobs, Dispatch, Customers, Estimates, Catalog, Invoicing, Reports, Settings), renders unbuilt modules visible-but-disabled (D-08), hides role-forbidden modules via `visibleModules(role)` (D-16), and uses a subtle active state (D-10). Dashboard renders four placeholder cards each showing `—` plus an "Available in Phase N" note (D-09).
- `pnpm build` exits 0 (8 routes); `pnpm vitest run tests/roles.test.ts` passes (3/3); full suite: 9 passed, cross-tenant skipped pending `TEST_DATABASE_URL`.

## Task Commits

1. **Task 1: clerkMiddleware (public matcher, technician redirect, settings admin gate)** — `58f7664` (feat)
2. **Task 2: shadcn init + Clerk auth pages, onboarding, mobile-coming-soon** — `cd6711b` (feat)
3. **Task 3: protected (app) shell — dark role-filtered sidebar + dashboard cards** — `5d16352` (feat)

## Files Created/Modified
- `src/middleware.ts` — the security perimeter (public matcher, technician redirect, settings admin gate)
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Clerk `<SignIn/>` on a custom catch-all route
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — public Clerk `<SignUp/>` (workspace creation entry)
- `src/app/onboarding/page.tsx` — two-field onboarding form (useActionState)
- `src/app/onboarding/actions.ts` — `completeOnboarding` server action -> `saveProfile` -> redirect /dashboard
- `src/app/mobile-coming-soon/page.tsx` — technician holding page (no nav)
- `src/app/(app)/layout.tsx` — protected shell; reads `orgRole`, renders `<Sidebar/>`
- `src/app/(app)/dashboard/page.tsx` — four placeholder metric cards
- `src/components/shell/sidebar.tsx` — dark role-filtered sidebar (`visibleModules`)
- `src/components/ui/{button,card,input,label}.tsx`, `src/lib/utils.ts` — shadcn primitives + `cn`
- `components.json` — shadcn config (base-nova, neutral, css-vars)
- `src/app/globals.css` — shadcn theme tokens (light/dark, sidebar tokens)
- `src/app/layout.tsx` — Geist font wiring added by shadcn init (ClerkProvider preserved)
- `package.json` / `pnpm-lock.yaml` — shadcn runtime deps

## Decisions Made
- **shadcn style base-nova vs the plan's "new-york":** the modern shadcn CLI no longer offers the `new-york` style — it was superseded. `init` defaults to the `base-nova` preset (Lucide icons, Geist font, CSS variables), which delivers the same intent (D-10: modern shadcn design language, not a literal SF clone). Functionally equivalent; the literal style string differs.
- **Onboarding action signature:** Plan 02's `saveProfile(input: ProfileInput)` resolves the active org from the verified session internally — it does not accept an `orgId` argument. So `completeOnboarding` validates the two fields and calls `saveProfile(parsed.data)`; it additionally reads `orgId` from `auth()` first purely to fail closed (return an error rather than persist) if there is somehow no active org.
- **Entrance animations via tw-animate-css:** the global UI standard calls for entrance animations; `motion` is not a project dependency and the plan did not add it. shadcn installs `tw-animate-css`, so I used its `animate-in`/`fade-in`/`zoom-in` utilities for the onboarding card and dashboard — meeting the standard without an unplanned dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed dependencies in the fresh worktree**
- **Found during:** Pre-Task-1 baseline
- **Issue:** The worktree had no `node_modules` (not shared from the parent checkout), so `pnpm build` / `pnpm vitest` could not run.
- **Fix:** Ran `pnpm install` (lockfile already present from Plan 02). No lockfile content change (line-ending touch only).
- **Files modified:** none committed for this (lockfile content unchanged; pnpm-lock.yaml later committed with shadcn deps in Task 2).
- **Commit:** n/a (environment setup)

### Adaptations (not deviations from intent)
- shadcn `init` defaulted to `base-nova` rather than the deprecated `new-york`; layout.tsx gained the Geist font wrapper (ClerkProvider untouched). Acceptance criteria (`components.json` exists, shadcn configured, primitives added, `pnpm build` exits 0) all met.

**Total deviations:** 1 auto-fixed (Rule 3 - blocking environment setup). No architectural (Rule 4) changes; no scope creep. The style-string and onboarding-signature adaptations are framework/contract realities, documented above.

## Checkpoints
None in this plan (all three tasks `type="auto"`). The phase-level external-setup checkpoint (Clerk custom roles, Supabase third-party provider, webhook endpoint, env values) remains deferred to the end-of-phase gate per Plan 02 — required before the first real run and before the manual verification items in this plan's `<verification>` (technician login redirect, dispatcher /settings block, signup→onboarding→dashboard, session persistence, password-reset email).

## Issues Encountered
- Git `LF will be replaced by CRLF` warnings on Windows for new text files — cosmetic (autocrlf), no action.
- `next build` prints a `DEP0205 module.register()` deprecation warning — upstream toolchain, non-fatal, out of scope.

## Known Stubs
- The eight unbuilt sidebar modules (Jobs, Dispatch, Customers, Estimates, Catalog, Invoicing, Reports, plus the Settings route page itself in Plan 03 scope) render disabled placeholders by design (D-08) — they are the intentional Phase-0 nav skeleton, not data stubs that block this plan's goal. Each lights up in its owning phase.
- Dashboard metric values are `—` placeholders (D-09) by design — no data source exists yet; the cards carry an explicit "Available in Phase N" note. Intentional, resolved per-phase (Phase 3/4/7).
- The `/settings` route page itself is owned by Plan 04 (Company Profile + Users), not Plan 03 — the middleware admin gate for `/settings(.*)` is in place now; the page lands in the next wave.

## Threat Flags
None. All security-relevant surface introduced (the middleware public matcher, the technician redirect, the `/settings` admin gate, the public sign-up route) is covered by this plan's `<threat_model>` (T-00-06 through T-00-09). No new endpoints, schema, or trust boundaries beyond the plan.

## Next Phase Readiness
- Plan 04 (Settings: Company Profile + Users) can build `/settings/*` route pages directly under the now-existing `(app)` shell — the admin gate already protects them server-side, and the sidebar already renders the Settings nav item for admins only.
- Every future module phase activates its section by adding routes under `(app)` and flipping its `NAV_ITEMS` `enabled` flag in `src/components/shell/sidebar.tsx` — no nav restructuring needed (D-07).
- Before the phase gate / first real run: complete Plan 02 Task 1 external setup (Clerk roles + Supabase provider + webhook + env), run the manual verification items, and flip the `rls-cross-tenant` test to GREEN against the test project.

## Self-Check: PASSED
- Files: all 10 plan artifacts + 4 shadcn primitives + utils + components.json present on disk (verified via existence check).
- Commits: `58f7664`, `cd6711b`, `5d16352` all present in git log (verified).
- Verification: `pnpm build` exit 0 (8 routes); `pnpm vitest run tests/roles.test.ts` 3/3 pass; full suite 9 passed / 2 skipped; `clerkMiddleware`, `visibleModules` import, four `—` cards, and `saveProfile` link all grep-confirmed.

---
*Phase: 00-foundation-tenancy-auth-and-data-spine*
*Completed: 2026-06-11*
