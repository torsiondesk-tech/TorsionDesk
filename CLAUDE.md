# GarageOS — Project Instructions

**Project:** GarageOS — FSM CRM for Infantino's Garage Door Service
**Purpose:** Service Fusion replacement, custom-built for a garage door service business. Multi-tenant from day one for future SaaS path.

---

## Package Manager

**ALWAYS use `pnpm`. NEVER use `npm`, `npx`, or `yarn`.**

```bash
pnpm install          # install dependencies
pnpm add <pkg>        # add a dependency
pnpm dlx <pkg>        # run a package without installing (replaces npx)
pnpm dev              # start dev server
pnpm build            # build for production
```

This is a hard requirement — owner preference for security reasons.

---

## GSD Workflow

This project uses the GSD planning framework. Planning artifacts live in `.planning/`.

### Key files
- `.planning/PROJECT.md` — project context, constraints, key decisions
- `.planning/REQUIREMENTS.md` — 97 v1 requirements with REQ-IDs
- `.planning/ROADMAP.md` — 11 phases, Vertical MVP mode
- `.planning/STATE.md` — current phase status

### Commands
- `/gsd-plan-phase N` — plan the next phase (creates `PLAN.md`)
- `/gsd-discuss-phase N` — discuss approach before planning
- `/gsd-execute-phase N` — execute the current phase plan
- `/gsd-transition` — mark a phase complete, update state
- `/gsd-progress` — see current status

### Phase sequence
```
Phase 0  → Foundation (Tenancy + Auth + RLS) — START HERE
Phase 1  → Customers, Locations, Equipment
Phase 2  → Catalog and Settings
Phase 3  → Jobs Core and Status FSM
Phase 4  → Dispatch Board          ┐ parallelizable
Phase 5  → Technician Mobile PWA   ┘ (both depend on Phase 3)
Phase 6  → Estimates
Phase 7  → Invoicing and Payments
Phase 8  → Communications and Notifications
Phase 9  → Reports
Phase 10 → Data Migration (SF import)
```

---

## Stack Constraints (locked decisions)

| Constraint | Detail |
|---|---|
| Framework | **Next.js 15** (App Router, React 19) — NOT 14 |
| Database | **Supabase** (PostgreSQL + RLS + Storage + Realtime) |
| ORM | **Drizzle** — NOT Prisma (Prisma bypasses RLS by default — silent multi-tenant data leak) |
| Auth | **Clerk** via native Supabase third-party auth — NOT the JWT template (deprecated April 1, 2025) |
| UI | **shadcn/ui** + **Tailwind CSS v4** + TanStack Table v8 + dnd-kit |
| PWA | **Serwist** — NOT next-pwa (unmaintained ~2 years) |
| Offline | **Dexie.js** (IndexedDB) for offline mutation outbox |
| Realtime | **Supabase Realtime Broadcast** per-tenant topics — NOT postgres_changes (single-threaded) |
| Email | **Resend** from contact@infantinosgaragedoor.com |
| Online payments | **Stripe** — idempotent webhooks, raw body verification |
| On-site payments | **Square Mobile Payments SDK** |
| SMS | **Twilio** A2P 10DLC registered |
| Hosting | **Vercel** |
| Package manager | **pnpm** — no npm, npx, or yarn |

---

## Critical Architecture Rules

### Multi-tenancy
- **Every table must have `tenant_id`** — no exceptions
- RLS policies enforce tenant isolation; app-layer is a second check only
- Clerk `org_id` (not `auth.uid()`) is the tenant identifier in RLS policies

### Job Status Machine
- Status transitions are **server-enforced** via a transition table — not a free dropdown
- Three writers (job form, dispatch popup, tech PWA) must all go through the same transition endpoint
- Side effects (SMS "On The Way", invoice creation "Close & Invoice") are **bound to transition events**, not status values

### Payment Ledger
- **Single canonical ledger** for both Stripe and Square
- Stripe webhooks: verify on **raw body**, deduplicate by `event.id` UNIQUE constraint
- Balance is a **locked recompute** (sum of all payment records), not a mutable field

### PWA Offline
- iOS/Safari does **not** support Background Sync API
- Dual flush triggers required: `online` event + Background Sync where available
- Treat device as a **thin buffer** (not durable storage) — warn techs of unsynced items
- IndexedDB eviction (~7 days on iOS) — never rely on local data persisting

### Equipment Ownership
- Equipment FK must be `service_location_id` — **never** `customer_id`
- Commercial clients have multiple properties; equipment belongs to the property

---

## Service Fusion Parity Notes

This app must feel nearly identical to Service Fusion in layout, terminology, and interaction patterns. Key design references confirmed during discovery:

- **Job form**: two-panel layout (Details left, Job Info right)
- **Dispatch board**: week-view grid, techs as rows, days as columns; job pool below
- **Dispatch popup**: click any job block → modal with map, details, quick actions
- **Estimates dashboard**: left sidebar with status-folder nav + tag filters
- **Invoicing**: AR aging sidebar always visible; pay from invoice directly
- **Discount line items**: separate negative line item, not a per-line % reduction
- **Labor tab**: placeholder in v1 ($0 in all SF export jobs — labor is bundled into pricing)

---

## Data Model Insights (from SF export analysis, 2026-06-10)

- ~75 customers; some named by address (rental property pattern) — migration must preserve this
- ~150 catalog items in 9 categories; extension springs are color-coded by # weight
- Products have TWO description fields: **sales description** (customer-facing) and **purchase description** (internal/ordering)
- Products have up to 3 vendors with individual purchase prices per vendor
- Discounts are a separate line item type (negative total), not a percentage modifier
- Progress Billing = multi-job billing pattern for commercial (deposit job + milestone jobs), not a single-job feature

---

*Last updated: 2026-06-10 — project initialized, roadmap approved, ready for Phase 0*
