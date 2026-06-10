# Project Research Summary

**Project:** GarageOS — Custom FSM CRM (Service Fusion replacement)
**Domain:** Field Service Management (FSM) CRM for garage door service, multi-tenant SaaS path
**Researched:** 2026-06-10
**Confidence:** HIGH (stack/architecture/pitfalls verified against official 2025–2026 docs; features MEDIUM-HIGH)

## Executive Summary

GarageOS is a full-loop FSM CRM built to replace Service Fusion at ~1/10th the cost and architected multi-tenant from day one for an eventual SaaS path. The research is strongly convergent: the proposed scope is **already MVP-disciplined** — the dominant failure mode for a 1-2 tech shop is *over-building*, not under-building. The roadmap's job is to hold the line on scope while getting four hard things right: tenant isolation, payments, the status machine, and offline sync.

**The single most consequential finding:** The proposed Prisma + Supabase RLS combination is a **silent multi-tenancy trap.** Prisma connects as a privileged Postgres role that bypasses RLS by default — a tenant-leak bug that is business-ending for a multi-tenant SaaS. This ORM-vs-tenancy-model decision must be locked in Phase 0 before a single table is created.

Two stack corrections required up front: use **Next.js 15** (not 14 — deprecated line), and use the **native Clerk↔Supabase third-party auth integration** (JWT template deprecated April 1, 2025).

## Key Findings

### Stack: Recommended Changes

| Layer | Current Plan | Recommendation | Reason |
|---|---|---|---|
| Framework | Next.js 14 | **Next.js 15** | 14 is deprecated; shadcn/Tailwind-v4/Serwist all target 15+ |
| ORM | Prisma | **Drizzle** (recommended) OR Prisma + app-layer tenancy | Prisma bypasses RLS by default — silent data leak |
| Auth integration | Clerk JWT template | **Clerk native Supabase third-party auth** | JWT template deprecated April 1, 2025 |
| PWA tooling | next-pwa | **Serwist** | next-pwa is unmaintained (~2 years) |
| Dispatch Realtime | Supabase postgres_changes | **Supabase Realtime Broadcast** | postgres_changes is single-threaded; Broadcast scales correctly |
| Everything else | As specified | ✅ Validated | Supabase, Clerk orgs, shadcn/Tailwind v4, Vercel, Resend, Stripe, Square, Twilio all confirmed correct |

**iOS/Safari critical note:** Background Sync API is not supported in Safari or Firefox. Tech PWA needs a mandatory sync-on-focus fallback — iPhone techs silently never sync without it.

### Features: Gaps Found

All PROJECT.md table-stakes requirements are correct. Two small data gaps warrant a 10-minute owner confirmation before Phase 1 schema is built:

1. **Spring spec fields may be under-specified.** "Type, size, coil count" is insufficient for ordering — industry standard is: wire size + inside diameter + length + wind direction (left/right) + cycle rating. Wrong specs = wrong parts ordered (the owner's stated #1 pain).
2. **Door color + model/series** for panel reordering is missing from equipment records.
3. **Tech PWA should show equipment/spring specs on site** — universally provided by FSM tools because a tech needs the spring specs before they can quote or order parts. Not explicit in current TECH scope.

### Architecture: Build Order

**Phase 0 (Tenancy + Auth) blocks everything** — lock ORM/RLS model and Clerk native integration before any table exists. The dependency chain:

```
Phase 0: Tenancy + Auth Spine
   ↓
Phase 1: Customer / Location / Equipment
   ↓
Phase 2: Catalog + Settings Lookups
   ↓
Phase 3: Jobs Core + Status FSM (the hub — everything else consumes this)
   ↓           ↓
Phase 4:    Phase 5:
Dispatch    Technician PWA
Board       (offline-first)
   ↓
Phase 6: Estimates
   ↓
Phase 7: Invoicing + Payments
   ↓
Phase 8: Communications Automations
   ↓
Phase 9+: Reports / Inventory / SF Import
```

Phases 4 and 5 (Dispatch Board + Technician PWA) **parallelize** — different surfaces over the same job data.

### Critical Pitfalls (Top 6)

1. **Prisma silently bypasses Supabase RLS** — pick one lane: Drizzle+RLS, or Prisma with mandatory app-layer `tenantId` scoping via `$extends`. Never both half-done. Add a cross-tenant CI test. *Phase 0.*
2. **Equipment/location ownership model** — `equipment.service_location_id` only; never `customer_id`. Get this wrong before data accrues and every property-ownership change corrupts spring specs. *Phase 1.*
3. **Payment idempotency + dual-processor ledger** — unique constraint on Stripe `event.id`; one canonical payment ledger for both Stripe and Square; locked balance recompute. The AR aging dashboard the owner checks constantly derives from this. *Phase 7.*
4. **Job-status as a free dropdown fires wrong side effects** — explicit server-side transition table; bind SMS and invoice creation to the *transition event*, not the status value. Three UIs write status (job form, dispatch popup, tech PWA) — a free dropdown sends "on the way" texts on completed jobs. *Phase 3.*
5. **Deprecated Clerk JWT template** — native third-party auth only; RLS policies use `org_id` from JWT, not `auth.uid()` (useless with Clerk's string IDs). *Phase 0.*
6. **iOS PWA storage eviction (~7 days) + no Background Sync** — treat the device as a thin buffer; dual flush triggers (`online` event + Background Sync where available); warn techs of unsynced items. *Phase 5.*

## Recommended Stack (Final)

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | Uncached by default in 15 — correct for a live CRM |
| Database | PostgreSQL via Supabase | RLS + Storage + Realtime — three problems, one platform |
| ORM | **Drizzle** (recommended) | First-class RLS support, faster cold starts; OR Prisma + `$extends` tenant wrapper |
| Auth | Clerk (orgs = tenants) via native Supabase third-party auth | Org = tenant; roles: admin/dispatcher/technician |
| UI | shadcn/ui + Tailwind v4 + TanStack Table v8 + dnd-kit | Dense SF-parity tables + drag-drop dispatch grid |
| PWA | Serwist + Dexie.js (IndexedDB) | Offline service worker + mutation outbox |
| Dispatch real-time | Supabase Realtime **Broadcast** | Per-tenant topic; TanStack Query as data source, Broadcast as cache-invalidation signal |
| Email | Resend | From: contact@infantinosgaragedoor.com |
| Online payments | Stripe (payment links + webhooks) | Idempotent webhooks, raw body verification |
| On-site payments | Square Mobile Payments SDK | GA'd 2025 |
| SMS | Twilio (A2P 10DLC) | ~$1/mo number + $0.01/text |
| Hosting | Vercel | Auto-deploys, free tier |

## Open Questions (for owner confirmation — Phase 1)

- **Spring spec fields:** Should we track wire size, inside diameter, length, wind direction, and cycle rating — or is the current "type, size, coil count" sufficient for how you order parts?
- **Door color + model/series:** Do you need these on the door equipment record to reorder matching panels for commercial clients?
- **ORM final call:** Drizzle vs Prisma + app-layer tenancy — decide in Phase 0 before any table is created.

## Research Phase Flags

Phases that need deeper research before planning:
- **Phase 0** — ORM/RLS model, Clerk native integration wiring, PgBouncer config
- **Phase 5 (PWA)** — highest-risk; offline outbox, dual-trigger flush, iOS eviction handling, resumable photo upload
- **Phase 7 (Invoicing)** — dual-processor ledger semantics, Square webhook timing, partial-payment edge cases

Phases with standard patterns (lighter research):
- Phases 1, 2, 6 (well-understood CRUD)
- Phase 4 (Broadcast + dnd-kit documented)
- Phase 9 (read-only aggregates)

---
*Research completed: 2026-06-10 | Ready for roadmap: yes*
