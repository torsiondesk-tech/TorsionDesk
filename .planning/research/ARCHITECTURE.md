# Architecture Patterns — GarageOS (Multi-Tenant FSM CRM)

**Domain:** Field Service Management CRM (multi-tenant SaaS path)
**Researched:** 2026-06-10
**Overall confidence:** HIGH on stack mechanics; MEDIUM on offline-sync specifics (browser-API dependent)

---

## TL;DR — The Five Decisions That Shape Everything

1. **Tenant isolation: defense in depth, but Prisma is your *primary* enforcement layer, not RLS.** Because you query through Prisma (direct Postgres connection), RLS does **not** automatically fire — Prisma connects as a role that can bypass it. Enforce `tenantId` in *every* Prisma query via a centralized scoped client, and keep RLS as a second wall that protects the Supabase client paths (Realtime, Storage, any direct browser reads). Do not assume RLS alone saves you when the app talks to the DB through Prisma.
2. **Realtime dispatch board: use "Broadcast from Database," not `postgres_changes`.** `postgres_changes` runs on a single thread and re-checks RLS per client per event — it bottlenecks. Broadcast (triggered from DB changes, scoped to a per-tenant topic) is the current Supabase-recommended pattern for fan-out to many dispatch clients.
3. **Clerk + Supabase: the JWT-template integration is DEPRECATED (April 2025).** Use Clerk as a **native third-party auth provider** in Supabase. This matters only for the Supabase-client paths (Realtime/Storage RLS); Prisma auth is a separate DB role.
4. **Stripe webhooks: persist-then-process, idempotent by `event.id`, verify on raw body.** Webhook handler writes a dedup record + does business work in one transaction, returns 2xx fast. Never do email/PDF inline in the webhook.
5. **PWA offline: optimistic IndexedDB writes + an outbound mutation queue, last-write-wins on `updatedAt`.** Do not rely on the Background Sync API as your only trigger (Safari/Firefox don't ship it) — pair it with an `online`-event flush.

---

## Recommended System Architecture

```
                          ┌─────────────────────────────────────────┐
                          │            Clerk (auth + orgs)            │
                          │   org = tenant; roles: admin/dispatch/tech│
                          └───────────────┬──────────────────────────┘
                                          │ session JWT (org_id, role claims)
                 ┌────────────────────────┼────────────────────────────────┐
                 │                        │                                 │
        ┌────────▼─────────┐   ┌──────────▼──────────┐          ┌───────────▼──────────┐
        │  Office Web App  │   │  Technician PWA     │          │  Public payment page │
        │ (Next.js RSC +   │   │ (offline-first,     │          │  (Stripe Checkout/   │
        │  client islands) │   │  installable)       │          │   payment link)      │
        └───────┬──────────┘   └─────────┬───────────┘          └──────────┬───────────┘
                │                         │                                 │
   ┌────────────▼─────────────────────────▼───────────┐            ┌────────▼─────────┐
   │            Next.js (App Router) on Vercel         │            │  Stripe / Square │
   │  • Server Actions (mutations: CRUD, status, etc.) │◄───webhook─┤  Twilio / Resend │
   │  • Route Handlers (webhooks, file proxy, exports) │            └──────────────────┘
   │  • Prisma client — TENANT-SCOPED wrapper          │
   └──────┬───────────────────────┬────────────────────┘
          │ Prisma (pooled, 6543) │ Supabase JS (RLS via Clerk JWT)
   ┌──────▼───────────────────────▼───────────────────────────────────┐
   │                         Supabase Postgres                          │
   │  • All tables carry tenant_id  • RLS policies (defense-in-depth)   │
   │  • Realtime: Broadcast-from-DB triggers → per-tenant topics        │
   │  • Storage: job-photos bucket, path = tenant_id/job_id/...         │
   └────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries — Server Actions vs Route Handlers vs Client Components

This is the question that causes the most churn if you get it wrong. Decision rules:

| Use a... | When | Examples in GarageOS |
|----------|------|----------------------|
| **Server Action** | User-initiated mutation tied to the authed session; you want progressive enhancement, revalidation, and type-safe args | Create/edit customer, job, estimate; change job status; add line item; convert estimate→job; record manual payment; apply template; "Close & Invoice" |
| **Route Handler (API route)** | Caller is **not** your authed UI, or you need raw request/response control, streaming, or a stable URL | Stripe webhook, Square webhook, Twilio status callbacks; PWA sync endpoint (batched offline mutations); file upload signed-URL minting; PDF generation; CSV/PDF report export; cron-style jobs |
| **Client Component** | Needs browser state, interactivity, Realtime subscription, or offline cache | Dispatch board grid, hover/popup cards, type-ahead customer search, line-item editor, photo capture, signature pad, AR-aging widget live updates |
| **Server Component (default)** | Read-only render of server data; no interactivity | Dashboard list pages, invoice/job detail shells, report tables (initial render) |

**Hard rules:**
- **Webhooks MUST be Route Handlers**, never Server Actions — Server Actions can't receive Stripe's raw body or arbitrary external POSTs, and you need `request.text()` for signature verification before any JSON parse.
- **The PWA offline-sync flush endpoint MUST be a Route Handler** — it accepts a *batch* of queued mutations with client-generated idempotency keys, not one action per call.
- **Server Actions are your default for everything the office UI does.** They're simpler, type-safe, and revalidate cleanly. Don't reach for API routes out of habit.
- Keep a **single tenant-scoped Prisma accessor** that both Server Actions and Route Handlers import — never `new PrismaClient()` per-call and never an unscoped raw client in feature code.

---

## Pattern 1: Tenant Isolation (the most important pattern in the system)

### The core tension
Your stack queries Postgres through **Prisma**, but RLS is enforced by Postgres against the **connecting role + session JWT**. Prisma connects with a fixed DB role over a pooled connection — it does **not** carry the Clerk JWT, so **RLS policies generally do not constrain Prisma queries.** Two viable models:

**Model A (RECOMMENDED for this project): App-layer enforcement is primary; RLS is the backstop.**
- Every table has a non-null `tenantId`.
- All Prisma access goes through a wrapper that injects `where: { tenantId }` (and sets it on create). Use Prisma Client Extensions (`$extends` with a `query` hook) to make this automatic and hard to forget, rather than hand-writing `tenantId` in 400 queries.
- RLS is still enabled on every table and **does** protect the Supabase-client paths: Realtime subscriptions, Storage, and any direct browser reads. Those paths carry the Clerk JWT, so RLS works there.

```ts
// tenant-scoped prisma — the ONLY way feature code touches the DB
export function forTenant(tenantId: string) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, operation }) {
          if (WRITE_OPS.has(operation)) injectTenantOnCreate(args, tenantId);
          else injectTenantWhere(args, tenantId);
          return query(args);
        },
      },
    },
  });
}
```

**Model B (heavier): Force every query through RLS via `SET LOCAL`.**
- Use a custom Postgres login role + wrap each query in a transaction that runs `SET LOCAL app.tenant_id = '...'` and have RLS policies read `current_setting('app.tenant_id')`.
- Costs: every query becomes a transaction; `executeRawUnsafe` for the `SET` is a SQL-injection footgun if you interpolate; pooling-mode caveats. **Reserve for when you sell to other businesses and want DB-enforced isolation as a hard guarantee.**

**Recommendation:** Ship Model A now (fast, type-safe, testable). Keep RLS enabled with `tenant_id = org_id` policies as defense-in-depth. Plan Model B as a hardening phase before opening the platform to external tenants.

> Confidence: HIGH. The Prisma-bypasses-RLS behavior and the deprecation of Clerk's JWT template (April 2025, replaced by native third-party auth) are both confirmed in current Supabase/Clerk docs.

### Connection pooling (do not skip)
- Use Supabase's **pooler (port 6543, transaction mode)** as Prisma's `DATABASE_URL` on Vercel serverless; use the **direct connection (5432)** as `DIRECT_URL` for migrations only. Serverless + un-pooled = connection exhaustion under dispatch load.

---

## Pattern 2: Data Model for Multi-Tenant FSM

Every table below carries `tenantId` (FK to `Tenant`/org). Core entity graph:

```
Tenant (org)
 ├─ User (role: admin|dispatcher|technician; Clerk userId)
 ├─ Customer ──┬─ Contact (phones[], emails[], smsConsent, billing/booking flags, birthday)
 │             ├─ ServiceLocation ──┬─ Equipment (door/opener/spring specs, install/warranty dates)
 │             │                    └─ (jobs/estimates reference this location)
 │             └─ Tag[] (customer tags)
 ├─ Estimate ──┬─ EstimateLineItem (group, catalogRef, qty, rate, cost, margin, tax)
 │             ├─ status (Requested→Provided→Accepted→Won/Lost)
 │             └─ Task[] / Reminder[]
 ├─ Job ───────┬─ JobLineItem (kind: product|labor|expense; qty/hrs, rate, cost, margin, tax)
 │             ├─ status (state machine, see below)
 │             ├─ SiteVisit[] (own date + status — JOB-09)
 │             ├─ JobPhoto[] (Storage path), Document[], Signature
 │             ├─ Task[] / Reminder[] / Note[] (internal vs work-order)
 │             └─ Tag[] (part-type: Springs, Rollers, LHR…)
 ├─ Invoice ───┬─ InvoiceLineItem (snapshot from job at creation)
 │             ├─ status (Unpaid|Paid|...), aging derived from dueDate
 │             └─ Payment[] (card last4, expiry, token, auth#, amountApplied, balanceAfter)
 ├─ CatalogItem (product|service; SKU/UPC/part#, price, cost, inventoryFlag, qtyOnHand)
 ├─ Category (hierarchical, self-FK parentId — jobs AND products)
 └─ Settings (tags, sources, tax items, email/SMS automation toggles, templates)
```

**Modeling decisions that matter:**
- **Equipment FK → ServiceLocation, never Customer** (commercial clients have many properties). The PROJECT explicitly calls this out; enforce it in the schema.
- **Line items are snapshots, not live joins.** When an estimate converts to a job, and a job converts to an invoice, **copy** the line-item values (price/cost/description). A later catalog price change must NOT mutate a sent invoice. Keep a nullable `catalogItemId` for traceability + denormalized columns for the captured values.
- **Money in integer cents (`Int`/`BigInt`), never floats.** Compute margin/tax/totals server-side; never trust client-computed totals on save.
- **Job status is a typed enum + an audit trail.** Persist a `JobStatusEvent` row on each transition (who, when, from→to) — drives the Activity Feed (CUST-05), the SMS-on-"On The Way" trigger, and dispatch pool membership.
- **Category and Tag are tenant-scoped configurable lookups**, not enums — they're admin-editable (SET-01/02).
- **Soft-delete + merge:** customer merge (CUST-08) needs a `mergedIntoId` pointer and re-parenting of children; design FKs so re-parenting is a single transaction.

> Confidence: HIGH (derived directly from PROJECT requirements + standard FSM modeling).

---

## Pattern 3: Realtime Dispatch Board

### Architecture: Broadcast-from-Database, per-tenant topic
- **Don't use `postgres_changes`** as the primary mechanism. At scale it processes on a single thread and re-evaluates RLS for every subscribed client per event — the exact fan-out shape a shared dispatch board creates.
- **Do use Broadcast triggered from the database.** A Postgres trigger on `Job` / `JobStatusEvent` / dispatch-relevant tables calls `realtime.broadcast_changes()` onto a topic like `dispatch:{tenantId}`. All dispatchers for that tenant subscribe to that one topic. One replication connection fans out; RLS-style access is enforced once at subscription (channel authorization), not per-event.
- Payload should carry the **minimum delta** (jobId, newStatus, assignedTechId, scheduledSlot) — clients patch local state, optionally refetch the single affected job.

### State management: server state vs client state
- **Server state (TanStack Query / RSC-loaded):** the authoritative job list, line items, customer data. This is the source of truth.
- **Realtime is a cache-invalidation signal, not a data store.** On a broadcast event, update the TanStack Query cache for the affected job (or invalidate + refetch that one row). Do not try to reconstruct full entities purely from broadcast payloads — they drift.
- **Local UI state (React, ephemeral):** which popup is open, drag-in-progress, filter tab selection, hover card. Never put this in server state.
- **Optimistic updates** for the dispatcher's own actions (drag job to tech, change status): mutate cache immediately, fire Server Action, reconcile on response; the broadcast that echoes back is deduped by job version/`updatedAt`.

> Confidence: HIGH on the Broadcast-vs-postgres_changes recommendation (current Supabase docs + benchmarks). MEDIUM on exact trigger wiring (verify `realtime.broadcast_changes` signature against your Supabase version at build time).

---

## Pattern 4: PWA Offline Strategy (Technician View)

### What to cache
- **App shell + static assets:** precache via service worker (Serwist is the current Next.js-friendly choice). Stale-while-revalidate for the shell.
- **Today's/this-week's assigned jobs for the logged-in tech:** hydrate into **IndexedDB** on load (customer, address, arrival window, description, office notes, equipment specs). This is the read cache the tech works from offline.
- **Do NOT cache the whole tenant dataset** — only the tech's own job slice. Keeps storage small and avoids leaking other techs'/tenants' data onto the device.

### What syncs, and how
Field techs mutate: job status, photos, signature, completion notes. Pattern:

1. **Optimistic local write** to IndexedDB → UI updates instantly.
2. **Enqueue an outbound mutation** in an IndexedDB "outbox" with: client-generated `mutationId` (idempotency key), op type, payload, `updatedAt` timestamp, retryCount.
3. **Flush triggers (use BOTH):**
   - `online` window event + a foreground retry loop (works everywhere, including Safari/Firefox).
   - Background Sync API where available (Chromium) for flush even when the tab is closed.
4. **Batch POST** the outbox to a **Route Handler** (`/api/sync`). Server applies each mutation idempotently (skip if `mutationId` already processed), returns per-item results.
5. **Reconcile:** server responds with canonical `updatedAt`/status; client clears acked outbox items and patches IndexedDB.

### Conflict resolution
- **Last-write-wins on `updatedAt`** is sufficient for this domain (a job is effectively owned by one tech in the field; office rarely edits the same field simultaneously). Document this explicitly.
- **Exception — photos are append-only**, so they never conflict; just dedup by `mutationId`.

### Photos offline
- Capture → store the blob in IndexedDB → enqueue an upload job. On flush, request a **signed upload URL** (Route Handler) and PUT directly to Supabase Storage, then attach the resulting path to the job via the sync batch. Don't base64 photos through your API — upload binary direct to Storage.

> Confidence: MEDIUM. Core pattern (optimistic + outbox + LWW) is well-established. Background Sync API support is genuinely partial (Chromium only; Safari/Firefox do not ship it) — hence the dual-trigger requirement. Verify Serwist version compatibility with your Next.js version at build time.

---

## Pattern 5: Stripe Webhook Reliability

```
Stripe ──POST──► /api/webhooks/stripe (Route Handler)
  1. const body = await request.text()       // RAW body — never request.json() first
  2. stripe.webhooks.constructEvent(body, sig, secret)   // verify
  3. BEGIN TX:
       - insert ProcessedWebhookEvent(event.id)  ← UNIQUE constraint = idempotency
         (if conflict → already handled → COMMIT + return 200)
       - create Payment record, update Invoice status   ← business work
     COMMIT
  4. return 200 immediately
  5. AFTER commit (out of band): enqueue receipt email (Resend) + PDF — NOT inline
```

**Non-negotiables:**
- **Verify on the raw body.** Next.js App Router gives it via `request.text()`. Parsing JSON first corrupts the signature.
- **Idempotent by `event.id`.** Stripe guarantees *at-least-once*, never exactly-once — you WILL get duplicates and replays. A `UNIQUE` constraint on the stored event id is the simplest correct dedup.
- **Dedup record + business write in the SAME transaction.** Otherwise a crash between them double-fulfills on retry.
- **Return 2xx fast; defer slow work.** Receipt email + PDF generation happen *after* the response (background task / queue), not inline — Stripe retries on slow/failed responses.
- **Square + Twiliocallbacks follow the identical shape** (verify provider signature → dedup → 2xx fast).

> Confidence: HIGH (consistent across current Stripe docs and multiple 2026 implementation guides).

---

## Pattern 6: File / Photo Storage

- **Bucket:** single `job-photos` bucket, **path-namespaced by tenant**: `{tenantId}/{jobId}/{uuid}.jpg`. Same for `documents`. Path prefix + RLS-style Storage policies (keyed on the Clerk JWT `org_id`) prevent cross-tenant reads.
- **Upload from phone:** client requests a **signed upload URL** from a Route Handler (which validates job ownership), then uploads the binary **directly to Storage** — bytes never pass through your serverless function (avoids Vercel payload limits + saves function time).
- **Serve in UI:** signed download URLs (short TTL) or a thin authenticated proxy route. Don't make the bucket public — these are customer property photos.
- **Associate with job:** store the Storage object path + metadata (taken-at, before/after tag, techId) in a `JobPhoto` row, written via the normal sync/Server-Action path.

> Confidence: HIGH.

---

## Build Order — Dependency Graph

```
                ┌──────────────────────────────────────────────┐
 FOUNDATION ──► │ 0. Tenancy + Auth spine                       │
                │   Clerk orgs↔Tenant, scoped Prisma wrapper,   │
                │   RLS enabled, pooled connection, base schema  │
                └───────────────┬──────────────────────────────┘
                                │ everything depends on this
        ┌───────────────────────┼───────────────────────────────┐
        ▼                       ▼                                ▼
 ┌─────────────┐        ┌──────────────┐                ┌────────────────┐
 │1. Customers │        │2. Catalog     │                │ (Settings/      │
 │  +Locations │        │  products/svc │                │  lookups: tags, │
 │  +Equipment │        │  +categories  │                │  categories,    │
 └──────┬──────┘        └──────┬────────┘                │  tax, sources)  │
        │                      │                          └───────┬────────┘
        └──────────┬───────────┘                                  │
                   ▼                                              │
            ┌─────────────┐                                       │
            │3. Jobs core │◄──────────────────────────────────────┘
            │  +line items│  (jobs need customers, catalog, lookups)
            │  +status FSM│
            └──────┬──────┘
        ┌──────────┼─────────────────┬──────────────────┐
        ▼          ▼                 ▼                  ▼
 ┌───────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
 │4.Estimates│ │5.Dispatch    │ │6.Tech PWA     │ │7.Invoicing  │
 │ (mirrors  │ │  board       │ │  (offline)    │ │  +payments  │
 │  job form)│ │ (Realtime)   │ │ needs jobs+   │ │ needs jobs+ │
 │ →convert  │ │ needs jobs+  │ │ status+photos │ │ line items  │
 │  to job   │ │ status FSM   │ └──────────────┘ └──────┬──────┘
 └───────────┘ └──────────────┘                         ▼
                                              ┌────────────────────┐
                                              │8. Stripe/Square     │
                                              │   webhooks + Resend │
                                              │   receipts (needs   │
                                              │   payments + email) │
                                              └──────────┬─────────┘
                                                         ▼
                                       ┌──────────────────────────────┐
                                       │9. Comms automations (Twilio   │
                                       │   SMS on-the-way, confirms)   │
                                       │10. Reports (read-only, last)  │
                                       │11. Inventory (PO/stock)       │
                                       │12. SF data import (pre-cutover)│
                                       └──────────────────────────────┘
```

**Critical ordering rationale:**
- **Tenancy + auth spine is phase 0 and blocks everything.** Retrofitting `tenantId` and the scoped Prisma wrapper after features exist is a painful rewrite — exactly the trap to avoid. Build it first even though it ships no visible feature.
- **Customers + Catalog + Settings-lookups before Jobs.** A job form references a customer, a service location, catalog line items, categories, and tags. Jobs are the hub; build their dependencies first.
- **Jobs (with the status FSM) before Dispatch, PWA, and Invoicing.** All three consume job status. The status state machine + `JobStatusEvent` audit trail is the shared backbone — get it right once.
- **Estimates after Jobs** because the estimate form *mirrors* the job form and estimates *convert into* jobs (EST-05). Building estimates first means rebuilding when the job form changes.
- **Dispatch and PWA can parallelize** once Jobs+status exist — different surfaces over the same data. Realtime (dispatch) and offline-sync (PWA) are independent infrastructure tracks.
- **Invoicing before payment webhooks** (webhook needs an invoice to attach a payment to). **Webhooks before comms automations** (receipt email is webhook-triggered).
- **Reports last** — pure read models over finished tables; cheap once data exists.
- **Inventory is explicitly a later phase** (per Key Decisions); catalog prices/costs ship in MVP, stock/PO tracking follows.
- **SF data import is not an MVP blocker but is a hard pre-cutover gate** — schedule it as its own phase once the schema stabilizes, before the owner goes live.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Trusting RLS to isolate Prisma queries
**Why bad:** Prisma connects as a privileged role over a pooler and does not carry the Clerk JWT — RLS won't constrain it. A forgotten `where: tenantId` = cross-tenant data leak with RLS providing false comfort.
**Instead:** Centralized tenant-scoped Prisma client (Client Extension), RLS as defense-in-depth for Supabase-client paths only.

### Anti-Pattern 2: `postgres_changes` for the dispatch board
**Why bad:** Single-threaded, per-client RLS re-check per event; bottlenecks exactly under multi-dispatcher fan-out.
**Instead:** Broadcast-from-Database on a per-tenant topic.

### Anti-Pattern 3: Doing email/PDF inline in the Stripe webhook
**Why bad:** Slow handler → Stripe times out → retries → duplicate receipts; or a crash mid-send corrupts state.
**Instead:** Persist idempotently + return 2xx fast; defer receipt email/PDF to a background task.

### Anti-Pattern 4: Live catalog joins on sent invoices/estimates
**Why bad:** A later price change silently rewrites historical financial documents.
**Instead:** Snapshot line-item values at estimate/job/invoice creation; keep `catalogItemId` only for traceability.

### Anti-Pattern 5: Background Sync API as the only offline flush trigger
**Why bad:** Safari and Firefox don't implement it; techs on iPhones silently never sync.
**Instead:** Dual trigger — `online` event + foreground retry loop, plus Background Sync where supported.

### Anti-Pattern 6: Caching the whole tenant dataset in the PWA
**Why bad:** Storage bloat + other techs'/customers' data sitting on a personal phone.
**Instead:** Cache only the logged-in tech's own job slice for the current window.

### Anti-Pattern 7: Float money / client-computed totals
**Why bad:** Rounding drift on margins/tax; a tampered or buggy client can save wrong totals.
**Instead:** Integer cents; recompute all totals server-side on save.

---

## Scalability Considerations

| Concern | Single op (today) | Multi-tech (10–20) | Multi-tenant SaaS |
|---------|-------------------|---------------------|-------------------|
| Tenant isolation | App-layer (Model A) | App-layer + RLS backstop | Add DB-enforced RLS via `SET LOCAL` (Model B) before external onboarding |
| Realtime | Broadcast, one topic | Broadcast per-tenant topic | Per-tenant topics scale naturally; monitor concurrent connections |
| DB connections | Pooler fine | Pooler (txn mode) essential on serverless | Watch pool sizing; consider per-tenant connection budgeting |
| Webhooks | Inline-after-commit deferral fine | Same | Move deferred work to a real queue (e.g. QStash/BullMQ) if volume grows |
| Photos/Storage | Direct signed upload | Same | Per-tenant path prefixes already isolate; add lifecycle/cost policies |
| Reports | Query live tables | Live tables fine | Introduce read replicas / materialized views per tenant if heavy |

---

## Sources

- [Supabase RLS Best Practices (Makerkit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM
- [Securing Multi-Tenant Apps with RLS + Prisma (Medium, Labuschagne)](https://medium.com/@francolabuschagne90/securing-multi-tenant-applications-using-row-level-security-in-postgresql-with-prisma-orm-4237f4d4bd35) — MEDIUM (Prisma-bypasses-RLS + custom-role pattern)
- [Prisma with Supabase RLS policies (Medium, Nambissan)](https://medium.com/@kavitanambissan/prisma-with-supabase-rls-policies-c72b68a62330) — MEDIUM
- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture) — HIGH
- [Supabase Realtime Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks) — HIGH
- [Supabase Broadcast docs](https://supabase.com/docs/guides/realtime/broadcast) — HIGH (Broadcast-from-DB pattern)
- [Supabase Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) — HIGH (scaling caveats)
- [Clerk → Supabase native third-party auth (Supabase Docs)](https://supabase.com/docs/guides/auth/third-party/clerk) — HIGH (JWT template deprecated April 2025)
- [Clerk: Integrate Supabase (Clerk Docs)](https://clerk.com/docs/guides/development/integrations/databases/supabase) — HIGH
- [Stripe Webhook Best Practices 2026 (HookRay)](https://hookray.com/blog/stripe-webhook-best-practices-2026) — MEDIUM
- [Idempotent webhook handlers in Next.js (The Agent Practice)](https://theagentpractice.com/blog/nextjs-webhook-idempotency-hmac) — MEDIUM
- [Stripe Webhooks Complete Guide 2026 (Hooklistener)](https://www.hooklistener.com/learn/stripe-webhooks-implementation) — MEDIUM
- [Build a Next.js PWA with offline support (LogRocket)](https://blog.logrocket.com/nextjs-16-pwa-offline-support/) — MEDIUM
- [MDN: Offline and background operation (Background Sync support)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — HIGH (browser support reality)
- [Build Offline-First PWA with Next.js & IndexedDB (WellAlly)](https://www.wellally.tech/blog/build-offline-first-pwa-nextjs-indexeddb) — LOW/MEDIUM
