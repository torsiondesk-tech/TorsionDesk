# TorsionDesk — Project Instructions

**Project:** TorsionDesk — FSM CRM for Infantino's Garage Door Service
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

### Supabase Realtime Broadcast — Topic Format

The REST broadcast API (`/realtime/v1/api/broadcast`) expects the **bare channel name**, not the internal Phoenix-prefixed topic.

```ts
// CORRECT — matches what clients subscribe with via client.channel('dispatch:orgId')
messages: [{ topic: `dispatch:${orgId}`, event, payload }]

// WRONG — double-prefixes the Phoenix topic, events are silently dropped
messages: [{ topic: `realtime:dispatch:${orgId}`, event, payload }]
```

Supabase prepends `realtime:` internally when routing. Sending `realtime:dispatch:...` results in routing to `realtime:realtime:dispatch:...` which matches nothing. This has been accidentally reverted twice — do not change it.

**Canonical implementation:** `src/lib/jobs/broadcast.ts`

### Dispatch Board — Auto-Refresh Pattern

The dispatch board must stay live without a manual page reload. Two mechanisms work together:

**1. Explicit `router.refresh()` on action success (same-session)**

The Realtime channel uses `self: false`, so the current tab never receives its own broadcast events. After a drag-and-drop (`updateJobAssignment`, `unassignJob`) succeeds, call `router.refresh()` directly in the action callback — do NOT rely on the WebSocket to trigger it.

```ts
// CORRECT — same session always pulls fresh server state
const result = await updateJobAssignment({...})
if (result.error) { rollback() } else { router.refresh() }

// WRONG — self:false means this tab never receives its own broadcast
// so router.refresh() in the realtime handler never fires for own actions
```

**2. 30-second polling fallback (cross-session)**

The WebSocket can drop silently on Vercel (cold start, idle timeout, anon key format mismatch). `useRealtimeSync` runs a `setInterval(onRefresh, 30_000)` alongside the WebSocket so cross-session changes (tech PWA → dispatch board) converge within 30 seconds even if Realtime is down. Never remove this interval.

```ts
// useRealtimeSync: always keep both
const pollId = setInterval(onRefresh, 30_000)  // fallback — do not remove
const channel = client.channel(...)             // real-time fast path
```

**Canonical implementations:**
- `src/app/(app)/dispatch/hooks/use-realtime-sync.ts` — WebSocket + polling
- `src/app/(app)/dispatch/board.tsx` — `router.refresh()` in drag handlers

This pattern was broken in production (but not dev) because Next.js dev mode revalidates more aggressively, masking both missing `router.refresh()` calls and WebSocket failures. Always test auto-refresh with `pnpm build && pnpm start`.

### Rate Limiting — Upstash Redis via Middleware

All routes (except `/api/webhooks/*`) are rate-limited at the Next.js Edge middleware layer **before** Clerk auth runs. Two tiers:

| Limiter | Limit | Routes |
|---|---|---|
| `generalLimiter` | 100 req / 10s per IP | All non-webhook routes |
| `strictLimiter` | 20 req / 60s per IP | `/api/invoices/*/pdf` (CPU-heavy) |

**Canonical implementation:** `src/lib/rate-limit.ts` + `src/middleware.ts`

**Fail-open:** If `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not set, both limiters are `null` and rate limiting is silently skipped. Local dev works with no config.

**Webhooks are excluded** intentionally — Stripe/Clerk webhooks are signature-verified and must never be dropped by a rate limit counter.

**Do not** move the rate limit check after `isPublic()` — it must run on all routes including sign-in/sign-up to catch credential-stuffing bots before they touch Clerk.

Production database: `torsiondesk-prod` on Upstash (Free Tier, GCP Iowa us-central1). Env vars are in Vercel project settings.

### PWA Offline
- iOS/Safari does **not** support Background Sync API
- Dual flush triggers required: `online` event + Background Sync where available
- Treat device as a **thin buffer** (not durable storage) — warn techs of unsynced items
- IndexedDB eviction (~7 days on iOS) — never rely on local data persisting

### Equipment Ownership
- Equipment FK must be `service_location_id` — **never** `customer_id`
- Commercial clients have multiple properties; equipment belongs to the property

### Date Handling — Calendar Dates vs. UTC Instants

There are **two kinds of Date objects** in this codebase and they require opposite extraction strategies. Mixing them is the single most-repeated bug in this project.

#### Kind 1 — Local midnight Date (client-constructed)
Created by `new Date(year, month, day)`, by `parseCalendarDate(string)`, or by user date inputs. The clock is at midnight in the browser's local timezone.

**Extract with local getters (`toISODate`):**
```ts
import { toISODate } from '@/lib/utils'
toISODate(localMidnightDate)   // getFullYear/getMonth/getDate — correct
localMidnightDate.toISOString().slice(0, 10)  // WRONG in UTC+ timezones (midnight is already yesterday UTC)
```

#### Kind 2 — UTC midnight Date (server/Drizzle-returned)
The PG driver returns calendar-date columns as `Date` objects at **UTC midnight** (`2026-06-21T00:00:00.000Z`). This includes:
- Drizzle rows in server actions (`row.startDate`, etc.)
- Props passed from a Server Component to a Client Component — **Next.js RSC flight format preserves `Date` objects as UTC midnight**, they are NOT serialized to strings.

**Extract with UTC getters (`.toISOString().slice(0, 10)`):**
```ts
utcMidnightDate.toISOString().slice(0, 10)   // reads UTC calendar date — correct
toISODate(utcMidnightDate)                   // WRONG in US timezones (UTC midnight = previous evening locally)
```

#### The conversion bridge — `parseCalendarDate(string)`
The correct way to go from a UTC midnight Date to a local midnight Date (which the rest of the display layer expects) is a two-step:
```ts
// UTC midnight Date → ISO string (UTC) → local midnight Date
parseCalendarDate(utcMidnightDate.toISOString().slice(0, 10))
```
`parseCalendarDate` on a string uses the YYYY-MM-DD digits directly (no timezone math), then constructs `new Date(year, month, day)` which is local midnight. This is the safe bridge.

**Do NOT** pass a UTC midnight Date object directly to `parseCalendarDate` — its Date branch calls `toISODate()` (local getters), which will shift the day in US timezones.

#### Where this bites hardest
- **`initialRows` in `tech-jobs-list.tsx`**: Server Component passes `JobRow[]` as props; `startDate` values arrive as UTC midnight Dates via RSC flight. Always normalize before display using the bridge above. (Bug fixed 2026-06-20.)
- **Dexie seed / `sync.ts`**: Server action rows go to Dexie — use `.toISOString().slice(0,10)`, not `toISODate()`. (Canonical: `src/app/(tech)/lib/sync.ts`.)
- **`type="date"` inputs**: The browser expects a `'YYYY-MM-DD'` string. If your Date is local midnight, `toISODate()` is correct. If it came from the server (UTC midnight), use `.toISOString().slice(0,10)` first. (Canonical: `src/lib/utils.ts` → `toDateInputValue`.)

#### Quick-reference table

| Date source | Midnight kind | Correct extraction |
|---|---|---|
| `new Date(y, m, d)` or `parseCalendarDate(str)` | Local | `toISODate(d)` |
| Drizzle row in server action | UTC | `d.toISOString().slice(0,10)` |
| RSC prop from Server Component | UTC | `d.toISOString().slice(0,10)` |
| Dexie / IndexedDB string field | String | `str.slice(0,10)` or `parseCalendarDate(str)` |

**Affected modules (patched):**
- `src/lib/utils.ts` — `toISODate` and `parseCalendarDate` canonical helpers.
- `src/app/(app)/dispatch/grid/week-grid.tsx` — cell date matching.
- `src/app/(app)/dispatch/board.tsx` — server prop re-hydration (`parseCalendarDate`).
- `src/app/(app)/jobs/[id]/page.tsx` — date input value prep (`toDateInputValue`).
- `src/app/(tech)/lib/sync.ts` — Dexie cache mapping uses `.toISOString().slice(0,10)`.
- `src/app/(tech)/components/tech-jobs-list.tsx` — `initialRows` normalization and Dexie seed (fixed 2026-06-20).

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

- ~1,000+ customers; some named by address (rental property pattern) — migration must preserve this
- Thousands of historical jobs to migrate
- ~150 catalog items in 9 categories; extension springs are color-coded by # weight
- Products have TWO description fields: **sales description** (customer-facing) and **purchase description** (internal/ordering)
- Products have up to 3 vendors with individual purchase prices per vendor
- Discounts are a separate line item type (negative total), not a percentage modifier
- Progress Billing = multi-job billing pattern for commercial (deposit job + milestone jobs), not a single-job feature

---

*Last updated: 2026-06-10 — project initialized, roadmap approved, ready for Phase 0*
