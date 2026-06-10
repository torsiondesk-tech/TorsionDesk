# Phase 0: Foundation — Tenancy, Auth, and Data Spine - Research

**Researched:** 2026-06-10
**Domain:** Multi-tenant SaaS foundation — Next.js 15 App Router, Clerk native Supabase third-party auth, Drizzle ORM with PostgreSQL Row Level Security, role-based access control
**Confidence:** HIGH (core auth/RLS/ORM wiring verified against official Supabase, Clerk, and Drizzle docs; one fast-moving gotcha — JWT v2 `o.id` claim — verified)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Workspace Provisioning**
- **D-01:** Public workspace creation — anyone with the URL can create a new workspace via Clerk's org creation UI. Multi-tenant from day 1.
- **D-02:** Clerk webhook auto-provisions DB — an `org.created` Clerk webhook fires when a new organization is created; the app inserts the `tenants` row at that moment. No lazy-provision upsert logic.
- **D-03:** Org creation is part of the sign-up flow — one continuous flow: email/password → verify email → name your organization → /onboarding. Users cannot end up with an account but no tenant.
- **D-04:** Custom auth pages with Clerk components — `/sign-in` and `/sign-up` built using Clerk's `<SignIn />` and `<SignUp />` React components, styled to match the app. Not Clerk's hosted UI.
- **D-05:** Post-signup → /onboarding first — after org creation, redirect to `/onboarding` to collect company name + phone (~20 sec), then land on dashboard.
- **D-06:** Team member invitations via Clerk's built-in system — admin enters email + role; Clerk sends the invite email and handles accept. No custom invitation token management or Resend invite emails in Phase 0.

**App Shell Structure**
- **D-07:** Full sidebar skeleton built in Phase 0 — all module nav items: Dashboard, Jobs, Dispatch, Customers, Estimates, Catalog, Invoicing, Reports, Settings.
- **D-08:** Unbuilt modules visible but disabled — greyed out, non-clickable. Empty states for routes that exist but have no data.
- **D-09:** Dashboard shows placeholder metric cards — Open Jobs, Unpaid Invoices, Today's Schedule, Recent Activity, each showing `—` with a "coming in Phase N" note.
- **D-10:** Modern but SF-adjacent sidebar style — same module names/terminology as Service Fusion, rendered with shadcn/ui design language; subtle active state, condensed spacing, dark sidebar.

**Business Profile (TENANT-02)**
- **D-11:** Two-step profile collection — `/onboarding` collects company name + phone (minimum). Full profile (address, email, logo) in Settings → Company Profile.
- **D-12:** Logo upload in Phase 0 Settings — stored via Supabase Storage. Later phases read the stored URL.
- **D-13:** All Settings tabs stubbed from Phase 0 — Company Profile, Users, Job Categories, Tags, Templates, Email, SMS, Payment Methods, Tax Items, Lookup Lists. Only Company Profile and Users are fully functional in Phase 0.

**Role-Based Access & Technician Handling**
- **D-14:** Technician web login → PWA coming-soon page — Technician-role web logins redirect to a dedicated holding page. No sidebar, no modules. Phase 5 replaces this.
- **D-15:** Settings is Admin-only — `/settings` restricted to Admin. Dispatcher sees: Dispatch, Jobs, Customers, Estimates, Invoicing, Reports. Technician sees only the coming-soon redirect.
- **D-16:** Defense-in-depth role enforcement — Next.js middleware handles server-side enforcement; client-side nav hides unauthorized items. Both layers enforced.
- **D-17:** RLS cross-tenant test against real Supabase test project — creates two tenants, inserts as Tenant A, verifies Tenant B session cannot read it. Tests actual Supabase RLS behavior.
- **D-18:** Drizzle middleware SET LOCAL for tenant scoping — a Drizzle query wrapper calls `SET LOCAL app.current_tenant_id = ?` before each transaction; RLS policies reference `current_setting('app.current_tenant_id')`. PgBouncer transaction-mode safe. Clerk `org_id` is the tenant identifier — `auth.uid()` is NOT the tenant key.

### Claude's Discretion

CONTEXT.md did not include a separate "Claude's Discretion" section. Within the locked decisions above, the planner has discretion over: exact folder structure, naming of internal helpers, choice of test runner config, exact shape of the `tenants` table beyond required columns, and styling specifics of the shell.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 0 scope. Everything from Phase 1 onward (customers, jobs, catalog, etc.) is out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Admin can create a workspace (tenant org) via Clerk during initial setup | Clerk Organizations + `<SignUp />` flow with org creation; `org.created` webhook → `tenants` insert (Standard Stack, Pattern 1, Pattern 6) |
| AUTH-02 | Admin can invite team members by email and assign roles (Admin, Dispatcher, Technician) | Clerk Organization invitations (`<OrganizationProfile />` / invite API) with custom org roles `org:admin`, `org:dispatcher`, `org:technician` (Pattern 2) |
| AUTH-03 | User can log in with email and password via Clerk | Clerk `<SignIn />` component on custom `/sign-in` route (Pattern 1) |
| AUTH-04 | User session persists across browser refresh and tab close | Clerk session cookies — handled automatically by `clerkMiddleware()` + `<ClerkProvider>`; no extra work (Pattern 1) |
| AUTH-05 | User can reset password via email link | Clerk built-in password reset flow in `<SignIn />` component (Pattern 1) |
| AUTH-06 | Role-based access — Admin sees all; Dispatcher sees dispatch/jobs/customers; Technician redirected | `clerkMiddleware()` + `createRouteMatcher()` + `auth.protect({ role })`; org role read from `o.rol` claim; defense-in-depth nav hiding (Pattern 2, Pattern 5) |
| TENANT-01 | All data scoped to tenant via Supabase RLS — no cross-tenant access | Clerk native third-party auth → `o.id` org claim → RLS policies + Drizzle `SET LOCAL` transaction wrapper; cross-tenant test (Pattern 3, Pattern 4, Pattern 7) |
| TENANT-02 | Configurable business profile: name, address, phone, email, logo | `tenants` / `business_profile` table + Supabase Storage tenant-scoped bucket for logo (Pattern 8) |
</phase_requirements>

## Summary

Phase 0 is a greenfield bootstrap. The entire value proposition is one provable property: a user creates a workspace, logs in with a role, and is confined to their tenant's data by Postgres RLS — verified by an automated cross-tenant test. The stack is fully locked by CLAUDE.md, so research is prescriptive, not exploratory: Next.js 15 App Router, Clerk via **native Supabase third-party auth** (the JWT template was deprecated April 1, 2025), Drizzle ORM over the `postgres` (postgres-js) driver, Supabase Postgres + Storage, shadcn/ui + Tailwind v4, pnpm only.

The single highest-risk technical detail — and the one most likely to silently break RLS — is the **Clerk JWT v2 claim shape**. As of the April 14, 2025 token format change, organization data is nested under a compact `o` object: the organization ID is `o.id` and the role is `o.rol` (without the `org:` prefix), accessed in RLS as `auth.jwt()->'o'->>'id'`. Any policy or middleware written against the old flat `org_id` claim will fail to match and either leak or deny everything. This must be locked before any table is created.

The second architectural decision that drives everything downstream is the tenant-scoping mechanism (D-18). Two equally valid Drizzle+RLS patterns exist and they are **mutually exclusive** — you cannot mix them safely. CONTEXT.md D-18 has already chosen the **`SET LOCAL app.current_tenant_id` transaction-wrapper** approach (app derives `org_id` from the verified Clerk session, then sets a transaction-local GUC that RLS reads via `current_setting()`), rather than the alternative of passing the raw Clerk JWT through to Supabase PostgREST. Research confirms D-18 is sound, PgBouncer-transaction-safe, and the right fit for a Drizzle-over-direct-Postgres architecture. This section documents the exact wrapper and the `prepare: false` requirement.

**Primary recommendation:** Build the walking skeleton first (scaffold → Clerk auth → one RLS-protected `tenants` read proving isolation → cross-tenant test green), then layer the shell, onboarding, settings, and role redirects on top. Lock the `o.id` claim path and the `SET LOCAL` wrapper as the two non-negotiable contracts every later phase depends on.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workspace/org creation (AUTH-01) | Clerk (external IdP) | API (webhook handler) | Clerk owns org lifecycle; app mirrors it into `tenants` via webhook |
| Sign-in / sign-up / password reset (AUTH-03, 05) | Clerk components (client) | Frontend Server (middleware) | Clerk hosts the auth state machine; app renders its components on-domain |
| Session persistence (AUTH-04) | Clerk middleware (Frontend Server) | Browser (cookies) | Session cookie set/refreshed by `clerkMiddleware()` |
| Role-based route protection (AUTH-06) | Frontend Server (`clerkMiddleware`) | Browser (nav hiding) | Server enforces; client hides for UX — defense in depth (D-16) |
| Tenant isolation (TENANT-01) | Database (RLS policies) | API (Drizzle `SET LOCAL` wrapper) | RLS is the source of truth; app layer is a second check only |
| Team invitations (AUTH-02) | Clerk (external) | API (assign role) | Clerk sends invite email + handles accept flow |
| Business profile persistence (TENANT-02) | Database (`tenants`/`business_profile`) | API (server action) | Tenant-scoped row, RLS-protected |
| Logo storage (TENANT-02, D-12) | Supabase Storage | API (signed upload via service role or scoped policy) | Object store with tenant-folder RLS |
| App shell / nav / dashboard (D-07–10) | Browser (client components) | Frontend Server (layouts) | Pure presentation; role drives visibility |

## Standard Stack

All entries are LOCKED by CLAUDE.md / PROJECT.md and must not be re-evaluated. Versions verified against the npm registry on 2026-06-10.

### Core
| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| `next` | **15.x** (latest registry tag is 16.2.9 — pin to 15.x per CLAUDE.md) `[VERIFIED: npm registry]` | App Router framework, React 19 | Locked decision; App Router + Server Components is the project baseline |
| `react` / `react-dom` | 19.x `[VERIFIED: npm registry]` | UI runtime | Next 15 ships React 19 |
| `@clerk/nextjs` | **7.5.0** `[VERIFIED: npm registry]` | Auth, organizations, middleware, webhooks | Locked; native Supabase integration + built-in org/role management |
| `drizzle-orm` | **0.45.2** `[VERIFIED: npm registry]` | Type-safe ORM with first-class RLS (`pgPolicy`, `pgRole`) | Locked; Prisma bypasses RLS by default (silent leak) |
| `drizzle-kit` | **0.31.10** `[VERIFIED: npm registry]` | Migrations / schema push | Companion to drizzle-orm |
| `postgres` | **3.4.9** `[VERIFIED: npm registry]` | postgres-js driver (the driver Drizzle's Supabase guide uses) | `[CITED: orm.drizzle.team/docs/connect-supabase]` — supports `prepare: false` for the transaction pooler |
| `@supabase/supabase-js` | **2.108.1** `[VERIFIED: npm registry]` | Supabase client (Storage, optional auth helpers) | Locked; needed for Storage (logo) and any PostgREST access |
| `tailwindcss` | **4.x** `[VERIFIED: npm registry]` | Styling (v4 inline `@theme`, no `tailwind.config.ts` required) | Locked |
| `svix` | **1.95.2** `[VERIFIED: npm registry]` | Webhook signature verification (or use Clerk's `verifyWebhook` wrapper) | Clerk webhooks are signed with Svix |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui (CLI, not a runtime dep) | latest via `pnpm dlx shadcn@latest` | Component primitives (Button, Card, Dialog, Input, Sidebar) | Shell, settings forms, dashboard cards |
| `@supabase/ssr` | 0.12.0 `[VERIFIED: npm registry]` | SSR cookie helpers for Supabase client | Only if accessing Supabase PostgREST/Storage from server with user context; may be optional given Drizzle-direct architecture |
| `vitest` | 4.1.8 `[VERIFIED: npm registry]` `[WARNING: slopcheck flagged as suspicious — typosquat heuristic vs 'vite'; this is a FALSE POSITIVE, vitest is the legitimate test runner from the Vite team]` | Test runner for the cross-tenant RLS test (D-17) | Cross-tenant integration test, unit tests |
| `zod` | latest `[ASSUMED]` | Input validation (onboarding/profile forms, webhook payload) | Security V5 — see Security Domain |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `SET LOCAL` transaction wrapper (D-18) | Pass raw Clerk JWT to Supabase PostgREST + `accessToken()` client | Valid Supabase-native pattern, but ties tenant scoping to PostgREST rather than Drizzle-direct queries. D-18 already chose the wrapper; this alt is documented only to explain the rejected fork. **Do not mix.** |
| `postgres` (postgres-js) | `pg` (node-postgres) | Drizzle's official Supabase guide uses postgres-js; `pg` works but the `prepare:false` guidance and examples are written for postgres-js |
| Clerk `verifyWebhook()` from `@clerk/nextjs/webhooks` | Raw `svix` `Webhook.verify()` | `verifyWebhook` reads `CLERK_WEBHOOK_SIGNING_SECRET` automatically and is simpler; raw svix is the fallback |

**Installation (pnpm only — never npm/npx/yarn):**
```bash
pnpm create next-app@latest .            # Next 15, App Router, TS, Tailwind, ESLint
pnpm add @clerk/nextjs drizzle-orm postgres @supabase/supabase-js svix zod
pnpm add -D drizzle-kit vitest
pnpm dlx shadcn@latest init              # replaces npx; pnpm-native
```

**Version verification performed:** `pnpm view <pkg> version` for every Core package on 2026-06-10. Note: `next` latest registry tag is **16.2.9**; CLAUDE.md locks **Next.js 15**, so the planner MUST pin `next@^15` explicitly and NOT accept the default `create-next-app` latest if it resolves to 16.

## Package Legitimacy Audit

slopcheck 0.6.1 ran successfully against a representative `package.json` (npm ecosystem). Results:

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| next | npm | OK | Approved |
| react | npm | OK | Approved |
| react-dom | npm | OK | Approved |
| @clerk/nextjs | npm | OK | Approved |
| drizzle-orm | npm | OK | Approved |
| drizzle-kit | npm | OK | Approved |
| @supabase/supabase-js | npm | OK | Approved |
| @supabase/ssr | npm | OK | Approved |
| postgres | npm | OK | Approved |
| svix | npm | OK | Approved |
| tailwindcss | npm | OK | Approved |
| vitest | npm | **SUS** (typosquat heuristic: "close to 'vite'") | **Approved — false positive.** vitest is the official Vite-team test runner, 20M+ weekly downloads, repo github.com/vitest-dev/vitest. The heuristic fires because the name is one char from `vite` (its own peer dependency). No checkpoint needed; planner may install. |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `vitest` — documented false positive above; no human checkpoint required.

All packages above are locked-stack dependencies discovered from official documentation (Supabase, Clerk, Drizzle) AND pass slopcheck — they are tagged `[VERIFIED: npm registry]` in the Standard Stack. `zod` is `[ASSUMED]` pending the planner's confirmation of the validation library (it is the de-facto standard but was not pinned in CLAUDE.md).

## Architecture Patterns

### System Architecture Diagram

```
                           BROWSER (Next.js client)
   ┌─────────────────────────────────────────────────────────────────┐
   │  <ClerkProvider>                                                  │
   │   /sign-up  ──<SignUp/>──> verify email ──> create org ──> /onboarding
   │   /sign-in  ──<SignIn/>──> session cookie set                     │
   │   Shell: dark sidebar (role-filtered nav) · dashboard cards (—)   │
   └───────────────┬─────────────────────────────────┬───────────────┘
                   │ request + Clerk session cookie   │
                   ▼                                  │
        FRONTEND SERVER (middleware.ts)               │
   ┌─────────────────────────────────────────┐       │
   │ clerkMiddleware() + createRouteMatcher() │       │
   │  • public:  /sign-in /sign-up /api/webhooks*     │
   │  • protected: everything else (auth.protect)     │
   │  • role gate: /settings → o.rol == admin         │
   │  • Technician → redirect /mobile-coming-soon     │
   └───────────────┬─────────────────────────┘       │
                   │ auth() → { orgId, orgRole }      │
                   ▼                                  ▼
        SERVER ACTIONS / ROUTE HANDLERS      CLERK (external IdP)
   ┌─────────────────────────────────┐   ┌──────────────────────────┐
   │ withTenant(orgId, async (tx)=>{ │   │ Orgs, members, roles,    │
   │   SET LOCAL app.current_tenant  │   │ invitations, sessions    │
   │       _id = orgId;              │   │ JWT v2: { sub, o:{id,rol}}│
   │   ...drizzle queries on tx...   │   └──────────┬───────────────┘
   │ })                              │              │ org.created /
   └───────────────┬─────────────────┘              │ membership.created
                   │ postgres-js (prepare:false)    │ (Svix-signed)
                   │ transaction pooler :6543        ▼
                   ▼                       /api/webhooks/clerk
        ┌──────────────────────────────────────────────────────┐
        │  SUPABASE POSTGRES                                     │
        │   RLS policies: USING (tenant_id =                     │
        │     current_setting('app.current_tenant_id')::uuid)   │
        │   tables: tenants, (memberships mirror optional)       │
        │  SUPABASE STORAGE: bucket 'tenant-assets'/{org_id}/logo│
        └──────────────────────────────────────────────────────┘
```

Trace the primary use case: user hits `/sign-up` → Clerk creates user + org → `org.created` webhook inserts `tenants` row → redirect `/onboarding` → server action runs inside `withTenant(orgId)` which `SET LOCAL`s the GUC → Drizzle writes the profile → RLS confirms the row's `tenant_id` matches the GUC. A Tenant B request sets a different GUC and the same row is invisible.

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx   # <SignIn/> (D-04)
│   │   └── sign-up/[[...sign-up]]/page.tsx   # <SignUp/> (D-04)
│   ├── (app)/                                # protected route group
│   │   ├── layout.tsx                        # shell: sidebar + ClerkProvider context
│   │   ├── dashboard/page.tsx                # placeholder metric cards (D-09)
│   │   ├── settings/                         # Admin-only (D-15)
│   │   │   ├── company-profile/page.tsx      # functional (TENANT-02, D-11/12)
│   │   │   ├── users/page.tsx                # functional (AUTH-02)
│   │   │   └── [stub tabs]/page.tsx          # "Available in Phase N" (D-13)
│   │   └── (stub modules)/                   # jobs, dispatch, etc. — empty states (D-08)
│   ├── onboarding/page.tsx                   # company name + phone (D-05/11)
│   ├── mobile-coming-soon/page.tsx           # Technician holding page (D-14)
│   └── api/webhooks/clerk/route.ts           # org.created handler (D-02)
├── components/
│   ├── ui/                                   # shadcn primitives
│   └── shell/sidebar.tsx                     # role-filtered nav (D-07/10/16)
├── db/
│   ├── schema.ts                             # drizzle tables + pgPolicy
│   ├── client.ts                             # postgres-js, prepare:false
│   └── with-tenant.ts                        # SET LOCAL transaction wrapper (D-18)
├── lib/
│   └── roles.ts                              # role → visible modules map (D-15)
└── middleware.ts                             # clerkMiddleware (D-16)
drizzle/                                      # generated migrations
tests/
└── rls-cross-tenant.test.ts                 # D-17, vitest
```

### Pattern 1: Clerk native third-party auth wiring (AUTH-01/03/04/05, TENANT-01)
**What:** Connect Clerk as a Supabase third-party auth provider (NOT the deprecated JWT template).
**When to use:** Once, at setup.
**Steps** `[CITED: supabase.com/docs/guides/auth/third-party/clerk]` `[CITED: clerk.com/docs/guides/development/integrations/databases/supabase]`:
1. In the **Clerk Dashboard** → activate the Supabase integration (this makes Clerk add `"role": "authenticated"` to every session token).
2. In the **Supabase Dashboard** → Authentication → Sign In / Providers → Add provider → **Clerk** → paste the Clerk domain.
3. Wrap the app in `<ClerkProvider>`; render `<SignIn />` / `<SignUp />` on custom routes (D-04). Session persistence (AUTH-04) and password reset (AUTH-05) are built into these components — no extra work.

```typescript
// Source: clerk.com/docs/guides/development/integrations/databases/supabase
// Supabase client that forwards the Clerk session token (only if using PostgREST/Storage with user context)
import { createClient } from '@supabase/supabase-js'
function createClerkSupabaseClient(session) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { async accessToken() { return session?.getToken() ?? null } },
  )
}
```
> Note: For the **Drizzle-direct + SET LOCAL** architecture (D-18), the above Supabase client is only needed for Storage (logo). Tenant scoping for DB tables happens in the `withTenant` wrapper (Pattern 4), not via this token-forwarding client.

### Pattern 2: clerkMiddleware role-based protection (AUTH-06, D-15/16)
**What:** Server-side route protection with org-role gating; default-deny-then-opt-in.
```typescript
// Source: clerk.com/docs/reference/nextjs/clerk-middleware
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublic   = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/webhooks(.*)'])
const isSettings = createRouteMatcher(['/settings(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return
  const { orgRole } = await auth()                 // orgRole is 'org:admin' | 'org:dispatcher' | 'org:technician'
  await auth.protect()                              // require sign-in for everything else
  if (orgRole === 'org:technician') {              // D-14: techs never see the web shell
    return Response.redirect(new URL('/mobile-coming-soon', req.url))
  }
  if (isSettings(req)) await auth.protect({ role: 'org:admin' })   // D-15
})

export const config = { matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'] }
```
**Note:** `clerkMiddleware()` is **default-public** — every route must opt in to protection. The file MUST be named `middleware.ts` for Next.js ≤15.

### Pattern 3: RLS policy keyed on tenant GUC (TENANT-01, D-18)
**What:** Policies read the transaction-local tenant id set by the app, not the Clerk JWT directly.
```sql
-- tenant_id column on every tenant-scoped table (here: tenants seeds its own id mapping)
alter table tenants enable row level security;

create policy tenant_isolation on some_table
  for all
  to authenticated
  using      ( tenant_id = current_setting('app.current_tenant_id', true)::uuid )
  with check ( tenant_id = current_setting('app.current_tenant_id', true)::uuid );
```
**Critical:** The second arg `true` to `current_setting` makes it return NULL instead of erroring when unset → an unscoped query matches no rows (fail-closed). Mapping: the app derives `app.current_tenant_id` from the verified Clerk `o.id` claim. `auth.uid()` is NOT used (D-18, PROJECT.md).

### Pattern 4: Drizzle SET LOCAL transaction wrapper (D-18)
**What:** Every tenant-scoped query runs inside a transaction that first sets the GUC. PgBouncer-transaction-safe because `SET LOCAL` is transaction-scoped.
```typescript
// Source: pattern per Drizzle RLS docs (orm.drizzle.team/docs/rls) adapted to app-owned GUC
import { sql } from 'drizzle-orm'
import { db } from './client'

export async function withTenant<T>(orgId: string, fn: (tx: typeof db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(key, value, is_local=true) == SET LOCAL, parameterized (no SQL injection)
    await tx.execute(sql`select set_config('app.current_tenant_id', ${orgId}, true)`)
    return fn(tx as typeof db)
  })
}
```
```typescript
// db/client.ts — postgres-js with prepare:false for the transaction pooler
// Source: orm.drizzle.team/docs/connect-supabase
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
const client = postgres(process.env.DATABASE_URL!, { prepare: false })  // REQUIRED for PgBouncer transaction mode (:6543)
export const db = drizzle({ client })
```

### Pattern 5: Defense-in-depth nav (D-16)
**What:** Middleware enforces (Pattern 2); the sidebar additionally hides items the current `orgRole` cannot access. Read role server-side via `auth()`, pass to the client sidebar. Never rely on hiding alone.

### Pattern 6: Clerk org.created webhook → tenants insert (AUTH-01, D-02)
```typescript
// Source: clerk.com/docs/guides/development/webhooks/overview
// app/api/webhooks/clerk/route.ts  — route MUST be in middleware's public matcher
import { verifyWebhook } from '@clerk/nextjs/webhooks'  // reads CLERK_WEBHOOK_SIGNING_SECRET, throws on bad sig
export async function POST(req: Request) {
  const evt = await verifyWebhook(req)
  if (evt.type === 'organization.created') {
    const org = evt.data
    // insert tenants row with tenant_id = org.id (this is the o.id claim later)
    // run as service-role / admin connection (no tenant GUC needed for provisioning)
  }
  return new Response('ok', { status: 200 })   // 2xx or Svix retries
}
```
**Note:** Creating an org fires BOTH `organization.created` and `organizationMembership.created`. Provision the `tenants` row on `organization.created`; optionally mirror membership/role on `organizationMembership.created`. Webhook handlers must be idempotent (Svix retries).

### Pattern 7: Cross-tenant RLS test (D-17, success criterion #4)
**What:** Automated proof that RLS denies cross-tenant reads, run against a real Supabase test project.
**Approach:** (1) Create two tenant ids (org A, org B). (2) Using `withTenant(orgA)`, insert a row. (3) Using `withTenant(orgB)`, attempt to read it → assert 0 rows. (4) Assert that querying with NO tenant GUC set also returns 0 rows (fail-closed). This is a vitest integration test pointed at the test project's connection string. It is the permanent CI guard against RLS regressions (STATE.md key decision).

### Pattern 8: Supabase Storage tenant-scoped logo (TENANT-02, D-12)
**What:** Logo stored at `tenant-assets/{org_id}/logo.*`. Either (a) upload server-side with the service-role key (bypasses RLS, trusted server) and store the resulting path, or (b) add a storage RLS policy on `storage.objects` matching the first path segment to the tenant claim. `[CITED: supabase.com/docs/guides/storage/security/access-control]`

### Anti-Patterns to Avoid
- **Writing RLS/middleware against a flat `org_id` claim** — JWT v2 nests it as `o.id` / `o.rol`. The flat claim does not exist in current tokens.
- **Using the deprecated Clerk JWT template** — removed/deprecated April 1, 2025; native integration only.
- **Querying tenant tables outside a transaction** — `SET LOCAL`/`set_config(...,true)` only lives inside the transaction; queries outside it see an unset GUC → no rows (or, worse, if a default role were over-privileged, a leak). Always go through `withTenant`.
- **Omitting `prepare: false`** — causes "prepared statement already exists" errors in production on the Supabase transaction pooler.
- **Using `npm`/`npx`/`yarn`** — hard project constraint; use `pnpm` / `pnpm dlx`.
- **Letting `create-next-app` install Next 16** — registry latest is 16.x; project is locked to 15.x.
- **Relying on nav hiding for security** — middleware is the enforcement layer; hiding is UX only (D-16).
- **Using Prisma** — connects as a privileged role that bypasses RLS by default → silent multi-tenant leak (PROJECT.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication / sessions / password reset | Custom auth, cookie/session store, reset-token emails | Clerk `<SignIn/>`/`<SignUp/>` + middleware | AUTH-03/04/05 are entirely Clerk-provided; rolling your own is a security liability |
| Organizations, invitations, roles | Custom org table + invite tokens + email | Clerk Organizations + built-in invitations (D-06) | AUTH-02 handled natively; custom invite flow is out of scope for Phase 0 |
| Webhook signature verification | Manual HMAC checking | `verifyWebhook()` / svix | Subtle to get right; timing-safe verification provided |
| Tenant isolation enforcement | App-layer `WHERE tenant_id=` only | Postgres RLS as source of truth | App-layer filters are forgettable; RLS is fail-closed at the DB |
| Setting tenant context safely | String-concatenated `SET` statements | `set_config(key, val, true)` parameterized | Prevents SQL injection in the GUC value |
| UI primitives | Hand-built buttons/dialogs/sidebar | shadcn/ui | Accessible, themeable, matches global CLAUDE.md UI standard |
| Token decoding | Manual base64 JWT parsing | Clerk SDK `auth()` / claims | JWT v2 compact claims (`o.fpm` bitmasks) require SDK support to decode reliably |

**Key insight:** In a multi-tenant RLS app, the database — not the application — must be the security boundary. Every shortcut that moves isolation into app code is a future data-leak. Phase 0's entire job is to make the DB boundary provable (D-17).

## Common Pitfalls

### Pitfall 1: JWT v2 org claim path mismatch
**What goes wrong:** RLS policies / middleware reference `org_id` (flat) but Clerk JWT v2 (April 14, 2025) nests it as `o.id`.
**Why it happens:** Most older tutorials and training data predate the v2 token format.
**How to avoid:** Reference `auth.jwt()->'o'->>'id'` for org id and `auth.jwt()->'o'->>'rol'` for role in any policy that reads the token; in middleware use `auth()`'s `orgId`/`orgRole`. For D-18's GUC approach, the app reads `o.id` from `auth()` and passes it to `withTenant`.
**Warning signs:** All queries return empty, or cross-tenant test "passes" because everything is denied.

### Pitfall 2: Queries outside the tenant transaction leak or vanish
**What goes wrong:** A query bypasses `withTenant` and runs with no GUC set.
**Why it happens:** Convenience direct `db.query` calls.
**How to avoid:** Lint/convention: all tenant-table access goes through `withTenant`. Use `current_setting('app.current_tenant_id', true)` (the `true` makes unset = NULL = fail-closed).
**Warning signs:** Intermittent empty results; rows visible in one code path, not another.

### Pitfall 3: PgBouncer transaction-mode breaks prepared statements
**What goes wrong:** Production errors "prepared statement already exists".
**Why it happens:** Supabase transaction pooler (port 6543) doesn't support prepared statements.
**How to avoid:** `postgres(url, { prepare: false })`. Use the transaction pooler (`:6543`) for serverless (Vercel); direct connection (`:5432`) only for long-running migrations. `[CITED: orm.drizzle.team/docs/connect-supabase]`

### Pitfall 4: Webhook route protected by middleware
**What goes wrong:** Clerk webhook returns 401 → org never provisioned → user has account but no tenant.
**Why it happens:** `clerkMiddleware` protects all non-public routes; `/api/webhooks/*` forgotten.
**How to avoid:** Add `/api/webhooks(.*)` to the public matcher (Pattern 2). Return 2xx; handler must be idempotent.
**Warning signs:** `tenants` row missing after sign-up; Svix dashboard shows retries.

### Pitfall 5: create-next-app pulls Next 16 / wrong package manager
**What goes wrong:** Scaffold installs Next 16 (registry latest) or uses npm.
**How to avoid:** Run `pnpm create next-app@latest`, then pin `next@^15` in package.json and reinstall; verify `pnpm-lock.yaml` exists (no `package-lock.json`).
**Warning signs:** `package-lock.json` appears; `next --version` reports 16.x.

### Pitfall 6: Session token missing org claims because no active org
**What goes wrong:** `o` claim is absent → `o.id` is null → RLS denies everything.
**Why it happens:** The `o` claim is only present when the user has an **active** organization. A user who signed up but hasn't selected/activated an org has no `o`.
**How to avoid:** Make org creation part of sign-up (D-03) and ensure the org is set active. Set Clerk to require/auto-activate an org; redirect users with no active org to org-creation/onboarding.
**Warning signs:** New users land in an empty/denied state right after first login.

## Code Examples

### Drizzle table with RLS policy (schema.ts)
```typescript
// Source: orm.drizzle.team/docs/rls (pgPolicy/pgRole), adapted to app-owned GUC
import { pgTable, uuid, text, pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),                 // == Clerk org id (o.id)
  companyName: text('company_name'),
  phone: text('phone'),
  address: text('address'),
  email: text('email'),
  logoUrl: text('logo_url'),
}, (t) => [
  pgPolicy('tenant_self_isolation', {
    for: 'all', to: 'authenticated',
    using: sql`${t.id} = current_setting('app.current_tenant_id', true)::uuid`,
    withCheck: sql`${t.id} = current_setting('app.current_tenant_id', true)::uuid`,
  }),
])
```

### Using the wrapper in a server action
```typescript
import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import { tenants } from '@/db/schema'

export async function saveProfile(data: ProfileInput) {
  const { orgId } = await auth()                 // o.id from verified session
  if (!orgId) throw new Error('No active organization')
  return withTenant(orgId, (tx) =>
    tx.update(tenants).set(data).where(/* id = orgId */))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Clerk Supabase JWT template | Native third-party auth integration | Deprecated April 1, 2025 | Must use native; no shared JWT secret, no per-request token fetch |
| Flat `org_id` JWT claim | Compact `o` object (`o.id`, `o.rol`, `o.per`) | JWT v2, April 14, 2025 | All RLS/middleware must use `o.id`/`o.rol` |
| `tailwind.config.ts` | Inline `@theme` in CSS (Tailwind v4) | Tailwind v4 | components.json `tailwind.config` left blank; no config file required |
| next-pwa | Serwist | next-pwa unmaintained ~2 yrs | (Phase 5 concern; not Phase 0) |
| Prisma w/ app-layer tenancy | Drizzle + RLS | project decision | RLS enforced at DB; Drizzle has `pgPolicy`/`pgRole` |

**Deprecated/outdated:**
- Clerk Supabase JWT template — replaced by native integration.
- shadcn "default" style — deprecated; new projects use "new-york".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `zod` is the validation library for forms/webhook payloads | Standard Stack / Security | Low — could be valibot/yup; planner should confirm. Not pinned in CLAUDE.md |
| A2 | Custom org roles will be named `org:admin`, `org:dispatcher`, `org:technician` | Pattern 2 | Medium — exact role keys must be created in Clerk Dashboard; if named differently, middleware checks break. Planner/setup must create these roles |
| A3 | Logo upload uses service-role server-side upload (Pattern 8 option a) rather than client-side scoped policy | Pattern 8 | Low — both work; choice affects whether a storage RLS policy is needed |
| A4 | The `tenants.id` is set equal to the Clerk org id (`o.id`) | Code Examples | Low-Medium — alternative is a separate UUID PK with an `org_id` unique column. Using org id directly simplifies the GUC mapping; planner should confirm |
| A5 | `@supabase/ssr` may be unneeded given Drizzle-direct + service-role Storage | Supporting stack | Low — include only if user-context Supabase client is required |

**If unsure, the planner should surface A2 and A4 to the user** — they are structural and hard to change later.

## Open Questions

1. **Exact Clerk org role keys**
   - What we know: Clerk supports custom org roles beyond default `org:admin`/`org:member`; middleware must match them.
   - What's unclear: Whether to use Clerk custom roles `org:dispatcher`/`org:technician` or store role in metadata.
   - Recommendation: Create custom org roles in Clerk Dashboard (`org:admin`, `org:dispatcher`, `org:technician`); they surface as `o.rol`. Confirm during setup task.

2. **`tenants.id` = org id vs separate PK (A4)**
   - What we know: Either works with RLS.
   - Recommendation: Use Clerk `org.id` as `tenants.id` for a 1:1 GUC mapping; simplest.

3. **Test project connection for D-17**
   - What we know: Cross-tenant test needs a real Supabase test project + a connection that hits RLS as the `authenticated` role (not service-role, which bypasses RLS).
   - Recommendation: Use a non-service-role connection string for the test; ensure the GUC wrapper is exercised. Document the test env var separately from prod.

## Environment Availability

> Most dependencies are cloud SaaS configured at runtime (Clerk, Supabase, Vercel) — no local binaries required beyond Node/pnpm. The cross-tenant test (D-17) requires a real Supabase test project.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/runtime | assumed ✓ (verify ≥18.18 / 20+) | — | — |
| pnpm | All installs (CLAUDE.md) | assumed ✓ | — | none — hard requirement |
| Clerk account + app | AUTH-* | ✗ (must be created) | — | none — blocking; create Clerk app + custom org roles |
| Supabase project (prod) | TENANT-* | ✗ (must be created) | — | none — blocking |
| Supabase project (test) | D-17 cross-tenant test | ✗ (must be created) | — | none — needed for success criterion #4 |
| Clerk webhook signing secret | D-02 webhook | ✗ (set after webhook config) | — | none |

**Missing dependencies with no fallback (planner must include setup tasks):**
- Clerk application with custom org roles (`org:admin`, `org:dispatcher`, `org:technician`) and Supabase integration activated.
- Supabase production project + a dedicated test project, third-party Clerk provider configured on both.
- Webhook endpoint registered in Clerk → `CLERK_WEBHOOK_SIGNING_SECRET` set.

**Missing dependencies with fallback:** none.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (verified npm) |
| Config file | none yet — Wave 0 creates `vitest.config.ts` |
| Quick run command | `pnpm vitest run <file>` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TENANT-01 | Tenant B cannot read Tenant A row; unset GUC returns 0 rows | integration (real Supabase test project) | `pnpm vitest run tests/rls-cross-tenant.test.ts` | ❌ Wave 0 |
| TENANT-01 | `withTenant` sets GUC inside transaction | unit | `pnpm vitest run tests/with-tenant.test.ts` | ❌ Wave 0 |
| AUTH-06 | Role → visible-modules map returns correct set per role | unit | `pnpm vitest run tests/roles.test.ts` | ❌ Wave 0 |
| AUTH-06/D-15 | Technician redirected from shell; non-admin blocked from /settings | integration/e2e | manual or Playwright (see note) | ❌ Wave 0 |
| AUTH-01/D-02 | `organization.created` payload → `tenants` insert (idempotent) | unit (mock verified payload) | `pnpm vitest run tests/webhook.test.ts` | ❌ Wave 0 |
| TENANT-02 | Save/read business profile round-trips under correct tenant | integration | `pnpm vitest run tests/profile.test.ts` | ❌ Wave 0 |

> Middleware/role redirects (AUTH-06 route-level) are awkward to unit-test; the role→modules **map** is unit-tested, and the redirect behavior is covered by the cross-tenant/integration layer or a manual check. Full E2E (Playwright) is optional and may be deferred — flag for planner.

### Sampling Rate
- **Per task commit:** quick run of the touched test file.
- **Per wave merge:** `pnpm vitest run` (full suite).
- **Phase gate:** full suite green + cross-tenant test green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework config (none exists)
- [ ] `tests/rls-cross-tenant.test.ts` — TENANT-01 (the success-criterion-#4 guard)
- [ ] `tests/with-tenant.test.ts` — TENANT-01 wrapper unit
- [ ] `tests/roles.test.ts` — AUTH-06 role map
- [ ] `tests/webhook.test.ts` — AUTH-01/D-02 provisioning
- [ ] `tests/profile.test.ts` — TENANT-02
- [ ] Test Supabase project + non-service-role connection string env var
- [ ] Framework install: `pnpm add -D vitest`

## Security Domain

> security_enforcement is enabled (config.json), ASVS level 1, block_on: high.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk (managed auth, password reset, MFA-capable) — do not hand-roll |
| V3 Session Management | yes | Clerk session cookies via `clerkMiddleware` (httpOnly, secure, rotated) |
| V4 Access Control | yes | Postgres RLS (DB source of truth) + `clerkMiddleware` role gates (defense in depth, D-16) |
| V5 Input Validation | yes | `zod` on onboarding/profile forms and webhook payloads `[ASSUMED]` |
| V6 Cryptography | yes (verification only) | Svix/`verifyWebhook` for signed webhooks; never hand-roll HMAC. TLS to Supabase enforced |
| V7 Error/Logging | partial | Don't leak tenant data in errors; webhook handler returns generic 2xx/4xx |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data access (IDOR at tenant level) | Information Disclosure / Elevation | RLS fail-closed (`current_setting(...,true)`), proven by D-17 cross-tenant test |
| SQL injection via tenant GUC | Tampering | `set_config(key, value, true)` parameterized — never string-concat the org id |
| Forged Clerk webhook → fake org provisioning | Spoofing | `verifyWebhook()` (Svix signature) before processing |
| Privilege escalation (Dispatcher reaching /settings) | Elevation | `auth.protect({ role: 'org:admin' })` at middleware (D-15), not just nav hiding |
| Service-role key leakage (bypasses RLS) | Information Disclosure | Keep service-role key server-only; never expose to client; use only for provisioning/Storage upload |
| Prepared-statement / pooler misconfig causing unscoped queries | Tampering | `prepare:false` + always-`withTenant` discipline |
| Session fixation / weak reset | Spoofing | Delegated entirely to Clerk (V2/V3) |

## Sources

### Primary (HIGH confidence)
- `supabase.com/docs/guides/auth/third-party/clerk` — native Clerk integration, `accessToken` client, `role:authenticated`
- `clerk.com/docs/guides/development/integrations/databases/supabase` — `createClerkSupabaseClient`, RLS with `auth.jwt()->>'sub'`
- `clerk.com/docs/guides/sessions/session-tokens` — JWT v2 default claims; `o.id`, `o.rol`, `o.per`, `o.slg`, `o.fpm`
- `clerk.com/changelog/2025-04-14-session-token-jwt-v2` — JWT v2 org claim nesting
- `clerk.com/docs/reference/nextjs/clerk-middleware` — `clerkMiddleware`, `createRouteMatcher`, default-public, role protection
- `clerk.com/docs/guides/development/webhooks/overview` — `verifyWebhook`, org.created + membership.created, idempotency
- `orm.drizzle.team/docs/rls` — `pgPolicy`, `pgRole`, Supabase roles, `set_config` transaction pattern
- `orm.drizzle.team/docs/connect-supabase` — postgres-js driver, `prepare:false` for transaction pooler
- `supabase.com/docs/guides/storage/security/access-control` — Storage RLS policies on `storage.objects`
- npm registry (`pnpm view`) — all package versions (2026-06-10)
- slopcheck 0.6.1 — package legitimacy scan (all OK except vitest false-positive SUS)

### Secondary (MEDIUM confidence)
- `ui.shadcn.com/docs/installation/next` + `ui.shadcn.com/docs/tailwind-v4` — Tailwind v4 / `components.json` blank config / new-york style
- `clerk.com/articles/organizations-and-role-based-access-control-in-nextjs` — org RBAC patterns

### Tertiary (LOW confidence)
- Community blog confirmations of `prepare:false` and `SET LOCAL` patterns (cross-verified against Drizzle/Supabase official docs, so effectively MEDIUM).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version verified on npm + slopcheck clean.
- Auth/RLS wiring (Patterns 1–4): HIGH — verified against official Supabase, Clerk, and Drizzle docs, including the JWT v2 `o.id` gotcha.
- Role keys (A2) / `tenants.id` shape (A4): MEDIUM — structural choices the planner should confirm with the user.
- Storage logo policy (Pattern 8): MEDIUM — two valid options documented.
- E2E role-redirect testing: MEDIUM — unit-testable parts identified; full E2E optional.

**Research date:** 2026-06-10
**Valid until:** ~2026-07-10 (fast-moving: Clerk JWT format and Next/Clerk SDK versions change frequently; re-verify `o.id` claim path and `@clerk/nextjs` major before planning if older than 30 days).
