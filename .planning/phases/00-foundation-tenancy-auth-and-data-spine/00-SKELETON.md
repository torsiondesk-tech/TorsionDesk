# Walking Skeleton — TorsionDesk

**Phase:** 0 (Foundation — Tenancy, Auth, and Data Spine)
**Generated:** 2026-06-10

## Capability Proven End-to-End

A user can sign up, have a workspace (Clerk organization) auto-provisioned into the `tenants` table via webhook, log in with a role, edit their company profile, and is provably confined to their own tenant's data by Postgres Row Level Security — verified by an automated cross-tenant test that confirms a Tenant B session cannot read a Tenant A row.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 App Router (React 19), pinned `next@^15` | Locked by CLAUDE.md; `create-next-app` latest resolves to Next 16 and MUST be downgraded to 15.x |
| Data layer | Supabase Postgres + Drizzle ORM over postgres-js driver (`prepare: false`) | Locked; Drizzle has first-class RLS (`pgPolicy`); Prisma bypasses RLS (silent multi-tenant leak). `prepare:false` REQUIRED for the Supabase transaction pooler (:6543) |
| Auth | Clerk via native Supabase third-party auth (NOT the deprecated JWT template) | Locked; JWT template deprecated April 1, 2025. JWT v2 nests org as `o.id`/`o.rol` |
| Tenant scoping | Drizzle `withTenant(orgId, fn)` wrapper → `set_config('app.current_tenant_id', orgId, true)` inside a transaction; RLS reads `current_setting('app.current_tenant_id', true)::uuid` | D-18. PgBouncer transaction-mode safe (SET LOCAL is transaction-scoped). Fail-closed: unset GUC → NULL → 0 rows. Clerk `org_id` (`o.id`) is the tenant key — NOT `auth.uid()` |
| Tenant PK | `tenants.id` = Clerk org id (`o.id`), uuid PK | A4. 1:1 GUC mapping; no separate UUID column needed |
| Org provisioning | Clerk `organization.created` webhook → insert `tenants` row (idempotent) | D-02. Webhook route `/api/webhooks/clerk` MUST be public in middleware matcher |
| Role model | Clerk custom org roles `org:admin`, `org:dispatcher`, `org:technician` (surface as `o.rol`) | A2. Created in Clerk Dashboard (user setup). Middleware gates `/settings` to admin; technician → `/mobile-coming-soon` |
| Input validation | `zod` on onboarding/profile forms + webhook payload | A1 confirmed. ASVS V5 |
| Logo storage | Supabase Storage bucket `tenant-assets/{org_id}/logo.*`, server-side upload with service-role key | D-12, Pattern 8 option (a). Service-role key server-only |
| Deployment target | Vercel (transaction pooler :6543 for serverless) | Locked. Phase 0 documents a local full-stack run command (`pnpm dev`); Vercel deploy is exercised in later phases |
| Directory layout | `src/app` (route groups `(auth)`, `(app)`), `src/db`, `src/lib`, `src/components/shell`, `tests/`, `drizzle/` | RESEARCH § Recommended Project Structure |

## Stack Touched in Phase 0

- [x] Project scaffold (Next.js 15, TypeScript, Tailwind v4, ESLint, vitest test runner)
- [x] Routing — `(auth)` sign-in/sign-up, `(app)` dashboard/settings, `/onboarding`, `/mobile-coming-soon`, `/api/webhooks/clerk`
- [x] Database — real write (`organization.created` webhook inserts `tenants`; onboarding + profile update) AND real read (company profile load, cross-tenant test)
- [x] UI — interactive company-profile form + users/invite form wired to server actions; dark sidebar shell with role-filtered nav
- [x] Deployment — documented local full-stack run command (`pnpm dev` against Supabase + Clerk dev instances)

## Out of Scope (Deferred to Later Slices)

- Any customer / job / catalog / estimate / invoice / dispatch / PWA data or UI (Phases 1–10)
- Resend-based custom invite emails (D-06: Clerk's built-in invitation system only in Phase 0)
- Functional Settings tabs beyond Company Profile and Users — all other tabs render "Available in Phase N" stubs (D-13)
- Dashboard metric values — cards show `—` with a "coming in Phase N" note (D-09); no real metrics
- Supabase Realtime, Serwist/PWA, Dexie offline outbox (Phases 4–5)
- Vercel production deploy pipeline (Phase 0 proves the stack locally; deploy hardening is later)
- Full E2E (Playwright) role-redirect tests — covered by manual checks + unit role-map test in Phase 0

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions (every new table gets `tenant_id` + the same RLS policy shape; every query goes through `withTenant`; every new module activates its pre-built sidebar nav item):

- Phase 1: Customers, service locations, equipment/spring specs
- Phase 2: Catalog + remaining Settings tabs
- Phase 3: Jobs core + server-enforced status FSM
- Phase 4 / 5: Dispatch board / Technician PWA (parallel)
- Phase 6: Estimates
- Phase 7: Invoicing + payments ledger
- Phase 8: Communications (Resend + Twilio)
- Phase 9: Reports
- Phase 10: Service Fusion data migration
