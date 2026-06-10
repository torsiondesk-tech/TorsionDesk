# Phase 0: Foundation — Tenancy, Auth, and Data Spine - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 0 bootstraps the entire project and delivers one provable thing: a team member can create a workspace, log in with a role, and is verifiably confined to their own tenant's data by Supabase RLS. No features — just the scaffold every later phase builds on: Next.js 15 app initialized, Clerk wired to Supabase via native third-party auth (not the deprecated JWT template), Drizzle ORM with per-request tenant scoping, the full navigation shell (all modules present, unbuilt ones disabled), and the business profile + user management settings.

**Requirements in scope:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, TENANT-01, TENANT-02 (8 requirements)
**Requirements out of scope:** Everything from Phase 1 onward — no customer data, no jobs, no catalog.

</domain>

<decisions>
## Implementation Decisions

### Workspace Provisioning

- **D-01:** **Public workspace creation** — anyone with the URL can create a new workspace via Clerk's org creation UI. Multi-tenant from day 1; no code changes needed when the product goes SaaS. The owner signs up first and gets Tenant A; future customers get their own isolated tenants automatically.
- **D-02:** **Clerk webhook auto-provisions DB** — a `org.created` Clerk webhook fires when a new organization is created; the app inserts the `tenants` row in the DB at that moment. Zero manual steps; no lazy-provision upsert logic needed.
- **D-03:** **Org creation is part of the sign-up flow** — one continuous flow: email/password → verify email → name your organization → /onboarding. Users cannot end up with an account but no tenant.
- **D-04:** **Custom auth pages with Clerk components** — `/sign-in` and `/sign-up` are built using Clerk's `<SignIn />` and `<SignUp />` React components, styled to match the app's design system. Not Clerk's hosted UI — these pages live on the product's domain.
- **D-05:** **Post-signup → /onboarding first** — after org creation, redirect to `/onboarding` to collect essentials (company name + phone). Takes ~20 seconds; the owner then lands on the dashboard. Full company profile is editable anytime in Settings → Company Profile.
- **D-06:** **Team member invitations via Clerk's built-in system** — admin enters email + role in the app; Clerk sends the invite email and handles the accept flow. No custom invitation token management or Resend-based invite emails in Phase 0.

### App Shell Structure

- **D-07:** **Full sidebar skeleton built in Phase 0** — the permanent left sidebar is established now with all module nav items: Dashboard, Jobs, Dispatch, Customers, Estimates, Catalog, Invoicing, Reports, and Settings. Future phases fill in their sections without touching the nav structure.
- **D-08:** **Unbuilt modules are visible but disabled** — nav items for unbuilt modules are rendered in the sidebar but greyed out and non-clickable. The full shape of the app is visible from day 1. Empty states appear if a user navigates to a route that exists but has no data yet.
- **D-09:** **Dashboard shows placeholder metric cards** — Phase 0 dashboard renders cards for Open Jobs, Unpaid Invoices, Today's Schedule, and Recent Activity, each showing `—` as the value with a "coming in Phase N" note. Feels intentional, not abandoned.
- **D-10:** **Modern but SF-adjacent sidebar style** — same module names and terminology as Service Fusion (Jobs, Dispatch, Customers, Estimates, Invoicing, Reports, Settings), but rendered with shadcn/ui's design language: subtle active state, condensed spacing, dark sidebar. Not a pixel-for-pixel SF clone.

### Business Profile (TENANT-02)

- **D-11:** **Two-step profile collection** — `/onboarding` collects company name + phone (minimum, ~20 seconds). Full company profile (address, email, logo) lives in Settings → Company Profile, editable at any time.
- **D-12:** **Logo upload in Phase 0 Settings** — the logo upload field is built now as part of Settings → Company Profile, stored via Supabase Storage. Later phases (invoices, email headers) just read the stored URL; no revisit of the settings page required.
- **D-13:** **All Settings tabs stubbed from Phase 0** — the Settings page shows all future tab sections from the start (Company Profile, Users, Job Categories, Tags, Templates, Email, SMS, Payment Methods, Tax Items, Lookup Lists). Unbuilt tabs render placeholder content ("Available in Phase N"). Company Profile and Users are the only fully functional tabs in Phase 0.

### Role-Based Access & Technician Handling

- **D-14:** **Technician web login → PWA coming-soon page** — Technician-role users who log in via the web app are redirected to a dedicated page ("Your mobile app is being built — coming soon"). No sidebar, no modules. Phase 5 replaces this redirect with the real PWA.
- **D-15:** **Settings is Admin-only** — the Settings nav item and all routes under `/settings` are restricted to the Admin role. Dispatcher role sees: Dispatch, Jobs, Customers, Estimates, Invoicing, Reports. Technician role sees only the coming-soon redirect.
- **D-16:** **Defense-in-depth role enforcement** — Next.js middleware handles server-side enforcement (unauthorized route → redirect/403). Client-side, the nav hides items the current role cannot access. Both layers are enforced; direct URL access and nav clicks are both guarded.
- **D-17:** **RLS cross-tenant test against real Supabase test project** — the automated cross-tenant test (success criterion #4) runs against a dedicated Supabase test project. It creates two tenants, inserts data as Tenant A, then verifies a Tenant B session cannot read it. Tests actual Supabase RLS behavior — not a simulated version.
- **D-18:** **Drizzle middleware SET LOCAL for tenant scoping** — a Drizzle query middleware calls `SET LOCAL app.current_tenant_id = ?` before each transaction. RLS policies reference `current_setting('app.current_tenant_id')`. This approach is PgBouncer transaction-mode safe and keeps RLS enforcement in the DB layer. Note: Clerk `org_id` is the tenant identifier — `auth.uid()` is NOT used as the tenant key in RLS policies.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Foundation
- `.planning/PROJECT.md` — project context, constraints, key decisions, and all locked stack decisions
- `.planning/REQUIREMENTS.md` — AUTH-01–06 and TENANT-01–02 full requirement specs (Phase 0 scope)
- `.planning/ROADMAP.md` — Phase 0 goal, success criteria, and dependency chain

### Stack Constraints (all locked — do not re-evaluate)
- `CLAUDE.md` (project root) — locked decisions: Drizzle over Prisma, Clerk native Supabase auth, pnpm only, Next.js 15 App Router, Supabase, shadcn/ui + Tailwind v4, Serwist, Vercel

### Critical Architecture Notes (from PROJECT.md)
- Clerk `org_id` (NOT `auth.uid()`) is the tenant identifier in RLS policies — documented in PROJECT.md § Critical Architecture Rules
- Clerk native Supabase third-party auth is required — the JWT template was deprecated April 1, 2025
- Drizzle is required because Prisma connects as a privileged role that bypasses RLS by default (silent multi-tenant data leak)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is the first phase; the project has no source code. Phase 0 creates the foundation.

### Established Patterns
- None yet — patterns established in Phase 0 become the baseline for all subsequent phases.

### Integration Points
- The tenant scoping mechanism established in Phase 0 (Drizzle `SET LOCAL` middleware + RLS policies keyed on `app.current_tenant_id`) is the contract every later phase's DB queries rely on.
- The sidebar skeleton built in Phase 0 is the nav structure every later phase navigates within — no future phase should need to restructure the nav, only activate their section.
- The Clerk `org.created` webhook handler established in Phase 0 can be extended in later phases to seed default data (categories, tags, etc.) for new tenants.

</code_context>

<specifics>
## Specific Ideas

- The `/onboarding` page should feel intentional and fast — two fields (company name + phone), a logo upload option, and a "Get started" button. No wizard with 5 steps.
- The dark sidebar variant is the preferred look — modern, not SF-grey. Active module state should be clear but subtle (not neon).
- The "PWA coming soon" page for Technician web logins should mention the mobile app is being built and give no other navigation — a clean holding page.
- Dashboard metric cards should use real shadcn/ui Card components with a `—` value state and a muted "Available in Phase N" label. No fake/hardcoded numbers.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 0 scope.

</deferred>

---

*Phase: 0 — Foundation — Tenancy, Auth, and Data Spine*
*Context gathered: 2026-06-10*
