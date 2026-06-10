# Phase 0: Foundation — Tenancy, Auth, and Data Spine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 0 — Foundation — Tenancy, Auth, and Data Spine
**Areas discussed:** Workspace provisioning, App shell depth, Business profile timing, Technician web access

---

## Workspace Provisioning

| Option | Description | Selected |
|--------|-------------|----------|
| Public signup | Anyone with the URL can create a new workspace via Clerk org creation. Multi-tenant from day 1. | ✓ |
| Single-tenant setup | No public sign-up; owner provisions one workspace via seed script or /setup page. | |
| Invite-only, multi-tenant | Sign-up exists but only admins can create new orgs. | |

**User's choice:** Public signup

---

| Option | Description | Selected |
|--------|-------------|----------|
| Clerk webhook auto-provisions | `org.created` webhook inserts tenant row automatically. | ✓ |
| Lazy provision on first request | Tenant DB row created on first authenticated request if missing. | |

**User's choice:** Clerk webhook auto-provisions

---

| Option | Description | Selected |
|--------|-------------|----------|
| Onboarding step first | Redirect to /onboarding (company name + phone) before dashboard. | ✓ |
| Straight into the app | Land on dashboard immediately; fill in profile via Settings later. | |

**User's choice:** Onboarding step first

---

| Option | Description | Selected |
|--------|-------------|----------|
| Custom pages with Clerk components | `/sign-in` and `/sign-up` built with Clerk React components, styled to app's design system. | ✓ |
| Clerk hosted UI | Redirect to Clerk's hosted pages on a subdomain. | |

**User's choice:** Custom pages with Clerk components

---

| Option | Description | Selected |
|--------|-------------|----------|
| Org creation during signup | Email/password → verify → name org → onboarding — one continuous flow. | ✓ |
| Org creation after signup | Sign up as individual, then create/join org on first login. | |

**User's choice:** Org creation during signup

---

| Option | Description | Selected |
|--------|-------------|----------|
| Clerk's built-in invitations | Admin enters email + role; Clerk handles invite email and accept flow. | ✓ |
| Custom invite flow | Build custom invitation tokens, emails via Resend, accept page. | |

**User's choice:** Clerk's built-in invitations

---

## App Shell Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full skeleton now | Permanent sidebar with all module items built in Phase 0; future phases fill in sections. | ✓ |
| Minimal shell now | Just auth pages + blank dashboard; nav items added phase-by-phase. | |

**User's choice:** Full skeleton now

---

| Option | Description | Selected |
|--------|-------------|----------|
| Visible but disabled | All module items show in sidebar; unbuilt ones greyed out and non-clickable. | ✓ |
| Hidden until built | Nav items only appear when their phase ships. | |

**User's choice:** Visible but disabled

---

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder cards with phase roadmap | Metric cards (Open Jobs, Unpaid Invoices, etc.) with `—` values and "coming in Phase N" context. | ✓ |
| Blank welcome screen | Just a welcome message / getting-started checklist. | |
| Jump straight to Jobs list | Skip dashboard; redirect to /jobs after login. | |

**User's choice:** Placeholder cards with phase roadmap

---

| Option | Description | Selected |
|--------|-------------|----------|
| Modern but SF-adjacent | Same modules/terms, shadcn/ui aesthetic — subtle active state, dark sidebar option. | ✓ |
| Match SF exactly | Pixel-for-pixel SF sidebar style and layout. | |

**User's choice:** Modern but SF-adjacent

---

## Business Profile Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Both — basics in onboarding, full form in Settings | Onboarding: company name + phone. Full profile: Settings → Company Profile. | ✓ |
| Full profile in onboarding | All fields collected at once during onboarding. | |
| All in Settings | Skip onboarding; owner fills everything in Settings. | |

**User's choice:** Both — basics in onboarding, full form in Settings

---

| Option | Description | Selected |
|--------|-------------|----------|
| Logo upload in Phase 0 Settings | Logo upload built now as part of Company Profile; later phases read the stored URL. | ✓ |
| Defer logo to Phase 7/8 | Skip logo upload until invoices/emails actually need it. | |

**User's choice:** Logo upload in Phase 0 Settings

---

| Option | Description | Selected |
|--------|-------------|----------|
| All settings tabs stubbed | All future tabs visible from Phase 0 with placeholder content. | ✓ |
| Company Profile + Users tab only | Only two functional tabs; others not shown until their phase ships. | |
| Company Profile only | Settings has just Company Profile; user management lives elsewhere. | |

**User's choice:** All settings tabs stubbed

---

## Technician Web Access

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to PWA coming-soon page | Technician web login → dedicated holding page. No sidebar, no modules. | ✓ |
| Same app, restricted nav | Technicians get the same layout but with most items blocked. | |
| Block web login entirely | Technicians can only log in via PWA URL; web login returns error. | |

**User's choice:** Redirect to PWA coming-soon page

---

| Option | Description | Selected |
|--------|-------------|----------|
| Settings is admin-only | Settings restricted to Admin. Dispatcher sees Dispatch/Jobs/Customers/Reports only. | ✓ |
| Dispatchers can view Settings read-only | Dispatchers can see but not edit Settings pages. | |

**User's choice:** Settings is admin-only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Both middleware + client hiding | Next.js middleware (server-side) + nav hiding (client-side) — defense in depth. | ✓ |
| Middleware only | Server enforces access; nav still shows all items regardless of role. | |

**User's choice:** Both middleware + client hiding

---

| Option | Description | Selected |
|--------|-------------|----------|
| Real Supabase test project | Cross-tenant RLS test runs against a dedicated Supabase test project. | ✓ |
| Local Postgres with RLS | Use local Postgres (Docker / Supabase CLI) for the cross-tenant test. | |

**User's choice:** Real Supabase test project

---

| Option | Description | Selected |
|--------|-------------|----------|
| Drizzle middleware SET LOCAL | `SET LOCAL app.current_tenant_id = ?` before each transaction; RLS reads `current_setting()`. PgBouncer-safe. | ✓ |
| Supabase JWT approach | Pass Clerk JWT via request header; Supabase `auth.jwt()` reads org_id. | |

**User's choice:** Drizzle middleware SET LOCAL

---

## Claude's Discretion

No areas deferred to Claude — all gray areas had a clear user preference.

## Deferred Ideas

None — discussion stayed within Phase 0 scope.
