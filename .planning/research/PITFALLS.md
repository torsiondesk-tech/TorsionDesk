# Domain Pitfalls

**Domain:** Field Service Management (FSM) CRM — garage door service, multi-tenant SaaS path
**Project:** GarageOS (Service Fusion replacement)
**Researched:** 2026-06-10
**Stack under review:** Next.js 14 App Router · Supabase (Postgres + RLS + Realtime + Storage) · Prisma · Clerk · Vercel · Stripe · Square · Twilio · Resend

---

## How to read this document

Pitfalls are grouped by severity. **Critical** = causes data leakage, lost money, or a rewrite. **Moderate** = causes painful bugs and rework but is recoverable. **Minor** = annoyances that compound.

Each pitfall carries: **What goes wrong → Why → Consequence → Prevention → Detection (warning signs) → Phase to address.**

The single most important architectural finding from this research: **the Prisma + Supabase RLS combination is the #1 silent multi-tenancy killer for this exact stack.** Prisma connects as a privileged Postgres role that bypasses RLS by default, so RLS gives you a false sense of security while every query runs unscoped. Read PITFALL-1 before writing a single line of data access.

---

## Critical Pitfalls

### PITFALL-1: Prisma silently bypasses Supabase RLS (the false-security trap)

**What goes wrong:** You enable RLS on every table, write tenant-isolation policies, feel safe — but Prisma connects to Postgres as the `postgres`/owner role (or via a connection string that uses a privileged role). Postgres roles with `BYPASSRLS`, table ownership, or superuser **ignore RLS policies entirely**. Every Prisma query returns all tenants' rows. RLS is effectively decorative.

**Why it happens:** Supabase RLS is enforced at the database role level and keyed off the request JWT (`auth.jwt()`). Prisma does not carry the end-user's Supabase/Clerk JWT — it holds a static connection string. By default that connection is privileged and table-owning, which short-circuits RLS. Teams assume "RLS is on, therefore isolated" without testing that Prisma's specific role is actually subject to it.

**Consequence:** Cross-tenant data leakage in production. For a SaaS licensed to competing garage door businesses, one tenant seeing another's customers, pricing, and revenue is a business-ending event. This is the classic cause of a from-scratch security rewrite.

**Prevention (pick a lane and commit — do not mix):**
- **Recommended for this project — application-level tenant scoping as the source of truth.** Treat RLS as defense-in-depth, NOT the primary guard. Enforce `tenant_id`/`org_id` on *every* Prisma query via a mandatory Prisma Client Extension (`$allModels.$allOperations`) that injects the current tenant's `where` clause and throws if no tenant context is set. Derive tenant context from Clerk's `auth().orgId` per request. Never expose a raw Prisma client to feature code.
- **If you want true RLS enforcement through Prisma:** connect Prisma as a **non-privileged, non-owning** role (NOT `postgres`), and set the session context before each query with `SET LOCAL request.jwt.claims` / `set_config('request.jwt.claim.org_id', ...)` inside an interactive transaction. This is the only way RLS actually fires on a Prisma connection, and it adds a round-trip per query.
- Put a `tenant_id NOT NULL` column on **every** tenant-owned table and a composite index `(tenant_id, <pk or common filter>)`.
- **Write an automated cross-tenant test** in CI: seed two tenants, authenticate as tenant A, assert tenant B's rows are never returned by any list endpoint. This single test catches 90% of isolation regressions.

**Detection / warning signs:**
- A list query returns rows even when you remove the `where: { tenantId }` clause.
- Your Prisma `DATABASE_URL` contains the `postgres` user or the Supabase service role.
- No request-scoped tenant context object exists; `tenantId` is passed ad hoc per function.
- Row counts in a "single tenant" view grow as other tenants onboard.

**Confidence:** HIGH — Prisma's default privileged connection bypassing RLS is documented behavior; multiple independent sources confirm using a restricted role + session variables is required for RLS to apply through Prisma.

**Phase:** Foundation / Data Layer (the very first data-access phase). This decision is load-bearing for the entire app and is the hardest thing to retrofit. Address before any feature module.

---

### PITFALL-2: RLS policy gaps on the "boring" tables and the service-role escape hatch

**What goes wrong:** Tenant isolation is applied to obvious tables (customers, jobs, invoices) but forgotten on join tables, lookup tables, attachments metadata, audit logs, equipment records, line items, and Stripe/payment records. Or: the Supabase **service role key** (which bypasses RLS by design) leaks into a path it shouldn't — e.g. used in a webhook handler that then serves data back to a user without re-scoping.

**Why it happens:** RLS is opt-in per table. A new table ships without `ENABLE ROW LEVEL SECURITY` and without a policy, so it's either fully open (if accessed via an anon/authenticated role with default-deny absent) or fully readable. Line-item and equipment tables are the usual blind spots because devs reach them "through" a parent that is scoped, forgetting direct queries exist.

**Consequence:** Partial data leakage — often the most sensitive data (payment records, pricing/cost/margin columns, equipment serials). Hard to detect because the main screens look correctly isolated.

**Prevention:**
- Maintain a checklist: **every** new table gets `ENABLE ROW LEVEL SECURITY` + a tenant policy in the same migration that creates it. Make it a PR review gate.
- Add a CI/SQL assertion that **fails the build if any table in the tenant schema lacks RLS enabled** (`pg_tables` / `pg_policies` query).
- Confine the Supabase service-role key to a tiny, audited set of server-only modules (Stripe/Clerk webhooks). Never import it into anything that can be reached by a user request. Lint-ban the env var outside an allowlist.
- Cost/margin/cost-price columns (CAT-01, JOB-06) deserve extra scrutiny — these are competitive secrets in a multi-tenant SaaS.

**Detection / warning signs:**
- A migration adds a table but no accompanying policy.
- `SELECT tablename FROM pg_tables WHERE schemaname='public'` shows tables not present in `pg_policies`.
- The service-role client is imported in more than ~2 files.

**Confidence:** HIGH.

**Phase:** Foundation, then re-checked at the end of *every* feature phase that adds tables (Estimates, Jobs, Invoicing, Catalog, Inventory).

---

### PITFALL-3: Clerk → database sync race conditions and the deprecated JWT template

**What goes wrong (two related issues):**

**(a) Deprecated integration path.** As of **April 1, 2025 the Clerk Supabase JWT template is deprecated.** Building on it now means building on a sunset path. Supabase's **native third-party auth** integration is the current recommended method — Supabase verifies Clerk-signed tokens directly, no shared JWT secret, no per-request token fetch.

**(b) Webhook sync races.** Clerk is the identity source of truth; your DB needs mirror rows (user, organization/tenant, membership). These arrive via Svix webhooks with **at-least-once delivery and eventual consistency.** A user can land on the app *before* the `user.created`/`organization.created` webhook has written their tenant row — producing "tenant not found" errors, orphaned records, or a first request that creates a duplicate. Concurrent webhook deliveries cause Prisma `P2002` unique-constraint crashes on naive `create`.

**Why it happens:** Webhooks are async and replayed. The app and the webhook race. Devs write `prisma.user.create()` instead of `upsert()`, and don't make the handler idempotent.

**Consequence:** Intermittent broken signups, duplicate tenant rows, foreign-key failures on first job/invoice, and a confusing class of "works on my machine, fails under load" bugs.

**Prevention:**
- Use the **native Clerk↔Supabase third-party auth integration**, not the deprecated JWT template. (Note: with Clerk, `auth.uid()` returns nothing useful because Clerk uses string IDs, not UUIDs — write RLS policies against the Clerk `org_id`/`sub` claim from `auth.jwt()`, and store Clerk IDs as `text` columns, not `uuid`.)
- Make every webhook handler **idempotent**: `upsert` keyed on Clerk's stable ID, wrapped so duplicate deliveries are no-ops. Store the Svix event ID and short-circuit if already processed.
- **Lazy-provision defensively:** on first authenticated request, if the tenant/user row is missing, create it via upsert rather than assuming the webhook already ran. Belt and suspenders.
- Verify the Svix signature on every webhook; reject unsigned requests.
- Map Clerk **Organization = tenant** explicitly. Decide day one: one Clerk org per garage-door business → one `tenant_id`. Don't conflate user and org.

**Detection / warning signs:**
- New-signup flows fail intermittently; retrying "fixes" it (classic race tell).
- `P2002` errors in webhook logs.
- Duplicate org/user rows with the same Clerk ID.
- RLS policies reference `auth.uid()` (won't work with Clerk).

**Confidence:** HIGH — deprecation date and native-integration recommendation confirmed by both Clerk and Supabase docs; upsert/idempotency guidance confirmed by Clerk's own syncing docs.

**Phase:** Foundation / Auth phase. The JWT-template-vs-native decision must be made before RLS policies are written, because policy authoring differs between the two.

---

### PITFALL-4: Stripe webhook non-idempotency → duplicate payments and double receipts

**What goes wrong:** Stripe delivers webhook events **at least once** and retries on any non-2xx or timeout. A handler that inserts a payment row and fires a Resend receipt on every delivery will: create duplicate payment records, double-count revenue/AR, and email the customer two receipts. Worse, an out-of-order or replayed event can mark an invoice paid that was later refunded.

**Why it happens:** Devs treat the webhook as a single fire. Network blips, slow handlers (Stripe times out at ~tens of seconds), and Stripe's own retry policy all cause repeats. The handler also does side effects (email) before committing the idempotency marker, so a crash mid-handler re-sends on retry.

**Consequence:** Direct financial/accounting corruption — the worst category for a billing system. Customer trust damage from duplicate receipts. AR aging (INV-02) becomes untrustworthy, which is the screen the owner checks constantly for collections.

**Prevention:**
- **Persist a unique constraint on Stripe's `event.id`** (a `processed_webhook_events` table). At the top of the handler, attempt to insert the event ID inside the same transaction; if it conflicts, return 200 immediately and do nothing.
- Make the payment write itself idempotent with a **unique constraint on the Stripe object ID** (`payment_intent` / `charge` id) on the payments table. A duplicate event then cannot create a second payment row even if event-id dedup is bypassed.
- Do the DB write **before** the side effect, and mark the event processed atomically with the payment insert (single transaction). Send the receipt email only after the transaction commits — and ideally trigger the receipt off a "payment row newly created" condition, not "webhook received."
- Verify the Stripe signature (`stripe.webhooks.constructEvent`) — reject anything unsigned.
- Return 2xx fast: acknowledge, then process. If processing is heavy, enqueue.
- Reconcile against Stripe's API as the source of truth for amounts; never trust client-side "payment succeeded" callbacks to create payment rows.

**Detection / warning signs:**
- Two payment rows with the same `payment_intent` ID.
- Customers report receiving duplicate receipt emails.
- AR totals don't reconcile with the Stripe dashboard.
- Webhook handler does `INSERT` without an idempotency guard.

**Confidence:** HIGH — Stripe's at-least-once delivery and the event-ID/unique-constraint pattern are documented and widely corroborated.

**Phase:** Invoicing & Payments phase (Module 6 / INV-06). This is the highest-stakes phase in the build — flag it for dedicated, careful research and testing.

---

### PITFALL-5: Two payment processors (Stripe + Square) → split source of truth & double-apply

**What goes wrong:** The project uses **Stripe for online payment links and Square for on-site card swipe** against the same invoices. Without a single canonical payment ledger, the same invoice can be paid in both systems (customer pays the link *and* the tech swipes on site), or a payment recorded in one processor isn't reflected when the other is reconciled. Partial payments (INV-04, INV-05, Progress Billing JOB-05) multiply the edge cases: amount-applied-to-invoice, balance-after, and split-across-multiple-invoices must stay consistent regardless of which processor produced the money.

**Why it happens:** Each processor has its own webhooks, IDs, and timing. Teams build two parallel payment paths that each write invoice state independently, with no locking or shared invariant.

**Consequence:** Over-collection, incorrect "Total Due" (JOB-06), invoices stuck partially paid, and reconciliation nightmares at tax time (RPT-08).

**Prevention:**
- Model **one internal `payment` ledger table** that both Stripe and Square webhooks write into (with a `processor` discriminator and processor-specific external IDs, each uniquely constrained). Invoice balance is a *derived* value computed from the ledger, never directly mutated by two code paths.
- Recompute `amount_due`/`balance` from the sum of applied payments inside a transaction with row locking (`SELECT ... FOR UPDATE` on the invoice) so concurrent Stripe + Square events can't both apply against a stale balance.
- Guard against over-application: refuse a payment application that would drive balance negative; surface as an overpayment/credit instead.
- Decide partial-payment semantics up front: does a partial payment move the job out of "Invoiced"? AR aging buckets (INV-02) must reflect remaining balance, not original total.

**Detection / warning signs:**
- Invoice balance is `UPDATE`d directly in more than one place.
- No `FOR UPDATE` / serializable guard around payment application.
- Sum of payment rows ≠ invoice's stored "paid" amount.

**Confidence:** HIGH (concurrency/ledger patterns) · MEDIUM (specific Square-on-site timing behavior — verify Square webhook semantics during the payments phase).

**Phase:** Invoicing & Payments phase. Note Square (INV-07) is listed as a v1 integration — if it can be deferred behind Stripe, do so to reduce simultaneous risk; otherwise the ledger model must land before either processor is wired.

---

### PITFALL-6: Job-status state machine that allows illegal transitions

**What goes wrong:** JOB-03 defines a rich status set (Unscheduled, Scheduled, Dispatched, Cancelled, Delayed, On The Way, On Site, Started, Paused, Resumed, Partially Completed, Completed, Invoiced, Paid in Full, Job Closed). Implemented as a free dropdown (JOB-02 says "status (full dropdown)"), any value can jump to any other. A job goes from "Paid in Full" back to "Unscheduled," or "Closed" → "On The Way," firing the customer SMS (COMM-07) on a job that's already done. Side effects bound to transitions (SMS on "On The Way", invoice on "Completed/Close & Invoice") fire on illegal or repeated transitions.

**Why it happens:** Status is stored as a plain enum/string with no transition guard. The dispatch board and the job form and the tech PWA all write status independently. Re-selecting the same status re-fires side effects.

**Consequence:** Customers get "tech is on the way" texts for finished jobs; duplicate invoices from re-hitting "Completed"; corrupted reports (RPT-07 job activity); AR mismatches when a paid job reopens.

**Prevention:**
- Implement an explicit **transition table** (allowed `from → to` set) enforced server-side. Reject illegal transitions with a clear error; the dropdown should only *offer* legal next states.
- Bind side effects to the **transition event**, not the resulting state, and make them idempotent (SMS sent flag per transition; invoice creation guarded by "invoice already exists for this job").
- Treat the three groups (Open / In Progress / Closed) as phases with constrained movement; reopening a Closed/Paid job should require an explicit, audited action — not a dropdown pick.
- Log every transition (who, when, from→to) — feeds the Activity Feed (CUST-05) and debugging.

**Detection / warning signs:**
- Status is a bare `enum` column with no transition validation function.
- Selecting the current status again triggers an email/SMS/invoice.
- "On The Way" SMS sent on a Completed job (check Twilio logs vs job status).
- Multiple invoices per job.

**Confidence:** HIGH (state-machine discipline is standard FSM domain knowledge).

**Phase:** Jobs phase (Module 3), with side-effect idempotency revisited in Communications (Module 8) and Dispatch (Module 4, the "Close & Invoice" one-click path is a prime offender).

---

### PITFALL-7: Equipment data model that breaks when a property changes hands

**What goes wrong:** The project correctly scopes **equipment to the service location, not the customer** (CUST-04, Key Decision). The trap is the *next* layer: when a commercial property is sold, or a residential customer moves, or a service location is reassigned to a different customer/parent account, the equipment+job history must follow the **physical property**, not the customer record. A naive schema that hangs equipment off `customer_id` (or duplicates location rows per customer) loses door/opener/spring specs (the specs that, per the domain notes, must be exact or the wrong parts get ordered).

**Why it happens:** Modeling shortcuts: equipment FK'd to customer; service location treated as a child of customer with no independent identity; merge/duplicate-customer flow (CUST-08) that doesn't correctly re-parent locations and equipment.

**Consequence:** Wrong spring specs surfaced for a property → wrong parts ordered → wasted truck rolls (a direct, expensive real-world failure called out in the domain context). Lost service history when ownership changes. Broken Activity Feed and equipment tab (JOB-11).

**Prevention:**
- Give **service location** a first-class identity (its own table/PK) keyed by physical address, with equipment FK'd to `service_location_id` only.
- The customer↔location link is a *relationship* (and can be temporal/reassignable), not ownership of the equipment.
- Spring/door/opener specs are versioned or append-only where it matters (a re-spring changes the spec — keep history, don't overwrite silently).
- The **customer-merge** flow (CUST-08) must re-point contacts, locations, equipment, jobs, estimates, invoices, and the activity feed atomically in one transaction, with a dry-run/preview. Merges are a top source of orphaned/duplicated FSM data.
- Address normalization to detect "same physical property, different customer."

**Detection / warning signs:**
- `equipment.customer_id` exists anywhere.
- Service location has no PK independent of the customer.
- After a test merge, some jobs/equipment still point at the old customer.
- Two location rows for the same physical address under different customers.

**Confidence:** HIGH (domain-specific, directly grounded in the project's stated key decision and pain points).

**Phase:** Customer Management phase (Module 1) — this is foundational data modeling; merge logic can follow but the schema shape must be right first.

---

## Moderate Pitfalls

### PITFALL-8: Dispatch board concurrent assignment race (lost update / double-book)

**What goes wrong:** Two dispatchers (or a dispatcher + the tech's PWA) assign/move the same job at the same time on the live board (DISP-01/03). Last write wins silently; one assignment is lost, or a tech is double-booked into the same slot. With Supabase Realtime broadcasting, both clients *think* they succeeded.

**Why it happens:** Plain `UPDATE job SET assigned_tech, start_time` with no concurrency control. Realtime shows optimistic UI that diverges from the committed state.

**Prevention:**
- **Optimistic locking:** add a `version` (or `updated_at`) column; `UPDATE ... WHERE id = ? AND version = ?` and check affected-row count. Zero rows → conflict → refetch and tell the user the board changed.
- For slot-exclusivity (don't double-book a tech in the same window), enforce at the DB with a constraint or a `SELECT ... FOR UPDATE` check inside a transaction; an **exclusion constraint** on (tech, time-range) using `tstzrange` + `btree_gist` is the robust option.
- Reconcile Realtime optimistic UI against the authoritative row on conflict; don't trust the broadcast as commit confirmation.

**Detection / warning signs:** Assignments "disappear"; two jobs on one tech at one time; bug reports that only happen when two people use the board together.

**Confidence:** HIGH (standard Postgres concurrency patterns; corroborated).

**Phase:** Dispatch Board phase (Module 4).

---

### PITFALL-9: PWA offline sync conflicts and lost field updates

**What goes wrong:** The tech PWA must work in poor-signal areas (TECH-01). Tech updates status, adds notes/photos offline; multiple updates queue; on reconnect they replay out of order or clobber office-side changes. Or the office edits the same job while the tech is offline — whose version wins?

**Why it happens:** Naive "last write wins" sync over a queue, with no conflict model and no per-field merge. Status transitions (PITFALL-6) replayed offline can be illegal by the time they sync.

**Prevention:**
- Define an explicit **offline write queue** with stable client-generated IDs (idempotency keys) so replays are safe.
- Prefer **field-level / append-only** semantics for tech inputs: completion notes append, photos add (never overwrite), status changes carry a client timestamp and are validated against the server state machine on sync (reject illegal transitions, surface to tech).
- Decide conflict policy per field: status = server validates; notes = append/merge; photos = additive.
- Keep the offline surface **small** — only what the tech truly needs offline (their day's jobs, status, photos, notes, signature). Don't try to make the whole CRM offline-capable.

**Detection / warning signs:** Field updates lost after reconnect; status jumps that skip steps; "I marked it complete but it shows started."

**Confidence:** MEDIUM (general offline-sync principles; exact behavior depends on chosen sync library — verify during PWA phase).

**Phase:** Technician PWA phase (Module 5).

---

### PITFALL-10: Photo upload failures on poor connections + Supabase Storage RLS

**What goes wrong:** Before/after photos (TECH-04) are large, captured on the exact low-signal job sites the PWA targets. Uploads time out, partially complete, or silently fail; the tech moves on assuming the photo saved. Separately, Supabase **Storage buckets need their own RLS-style policies** — files are not automatically tenant-isolated just because the DB is.

**Why it happens:** Direct full-resolution multi-MB uploads over a flaky connection with no resumability, no retry, no client-side compression. Storage bucket left public or policy-less.

**Prevention:**
- **Compress/resize client-side** before upload (phone photos are 3–12 MB; a 1600px JPEG is plenty for before/after documentation).
- Use **resumable uploads** (Supabase Storage supports TUS/resumable) with retry and a clear per-photo upload state (queued → uploading → done → failed-retry). Never show "complete" until the server confirms.
- Queue photo uploads in the offline store; upload opportunistically when signal returns; surface failures explicitly so a photo is never silently dropped.
- Lock down Storage bucket policies to tenant + job scope; generate **signed URLs** for reads rather than public buckets. Validate file type/size server-side.
- Strip EXIF GPS if privacy matters; orient via EXIF so rotated phone photos display correctly.

**Detection / warning signs:** Jobs completed with missing before/after photos; large gaps between capture and server timestamp; public bucket; storage costs spiking from full-res images.

**Confidence:** HIGH (Storage policies + resumable uploads are documented Supabase features; upload-reliability practices are standard).

**Phase:** Technician PWA phase (Module 5), Storage policy setup in Foundation.

---

### PITFALL-11: iOS PWA platform limitations (the silent data-loss one)

**What goes wrong:** On iOS/Safari, PWAs face hard platform limits: **script-writable storage (IndexedDB, Cache API) can be evicted after ~7 days of non-use**, and iOS can clear PWA storage if the app isn't opened for a few weeks. Cache API quota is small (~50MB reported). Service-worker reliability is shaky (registration failures, cache not updating, push unsubscribing after restarts). For a tech who doesn't open the app over a weekend, **queued offline data can be silently wiped.**

**Why it happens:** These are OS-imposed, not bugs you can fix — only design around.

**Prevention:**
- **Never treat the device as durable storage.** Sync offline queues to the server at the earliest opportunity; minimize the window where unsynced data lives only on-device.
- Warn the tech (badge/indicator) when unsynced items exist and signal is available — push them to sync.
- Keep cached payload small (well under the quota); cache the app shell + today's jobs, not history.
- Test specifically on a real iPhone added to Home Screen (standalone mode behaves differently from Safari tab). Test cold-start after days of non-use.
- Document for the operator that the PWA is a thin offline buffer, not an offline database.

**Detection / warning signs:** Tech reports "my notes/photos from Friday are gone" after a weekend; service worker not updating to new app versions; iOS-only data loss that never reproduces on Android.

**Confidence:** HIGH (iOS storage-eviction and SW limitations are well-documented and current as of 2025–2026).

**Phase:** Technician PWA phase (Module 5) — set expectations and sync strategy here.

---

### PITFALL-12: N+1 queries and unbounded lists on dispatch board & job dashboards

**What goes wrong:** The dispatch board (DISP-01/02) loads a week of jobs across techs plus a live job pool with counts; job dashboards (JOB-12) and invoice lists (INV-03) show large filtered lists. Naive code fetches jobs, then for each job fetches customer, location, contact, tech, tags, line-item totals — an N+1 explosion. The board "loading 500 jobs" with per-job sub-queries makes the most-used screen slow.

**Why it happens:** Prisma relation access in a loop without `include`/`select`; computing job totals (JOB-06) per row at request time; no pagination; counts computed by loading rows instead of `COUNT()`.

**Prevention:**
- Use Prisma `select`/`include` to fetch relations in one round trip; project only needed columns (don't pull cost/margin into list views you don't show).
- **Paginate / window** every list. The dispatch board should query only the visible week range + pool, not all jobs.
- Compute sidebar counts (JOB-12, DISP-02, INV-02 AR buckets) with `GROUP BY`/`COUNT` aggregate queries, not by fetching rows. Consider a materialized/cached aggregate for AR aging.
- Pre-compute or denormalize job totals where they're listed frequently (store rolled-up totals on the job, recomputed on line-item change) to avoid summing line items per row.
- Add composite indexes matching the board's hot filters: `(tenant_id, status)`, `(tenant_id, assigned_tech, start_time)`, `(tenant_id, scheduled_date)`.

**Detection / warning signs:** Dispatch board p95 latency climbs with job count; DB shows hundreds of small queries per page load; Vercel function duration creeping up; counts slow as data grows.

**Confidence:** HIGH (classic ORM/list performance; directly applicable to the described screens).

**Phase:** Surfaces first in Jobs/Dispatch phases; revisit in Reports (Module 9) where aggregates dominate. Cheap to design in, expensive to retrofit after data grows.

---

### PITFALL-13: Prisma migrations vs Supabase-managed schema conflicts

**What goes wrong:** Supabase manages parts of the schema (auth schema, RLS policies, storage, realtime publication, extensions, the `postgres`/role setup). Prisma's migration engine wants to own the schema and can drift from or fight Supabase-applied changes — e.g. RLS policies and grants made in the Supabase dashboard aren't in Prisma's schema, so a `prisma migrate` can reset/ignore them, or a shadow-database step fails against Supabase's role setup.

**Why it happens:** Two tools believe they own DDL. RLS policies, grants, triggers, and publications live outside Prisma's `schema.prisma`.

**Prevention:**
- **Decide one owner of DDL.** Recommended: Prisma owns tables/columns; **RLS policies, grants, and triggers live in versioned SQL migrations** (Prisma supports custom SQL in migrations) so they're reproducible and not lost on the next migrate. Do not author policies only in the dashboard.
- Use a dedicated migration connection (direct connection, not the pooler) and configure the shadow database appropriately for Supabase.
- Keep RLS-enable + policy statements adjacent to each table's migration (ties into PITFALL-2).
- Use Supabase's pooled connection (PgBouncer, transaction mode) for app queries with `pgbouncer=true` + the direct URL for migrations — mixing these up causes prepared-statement and migration errors.

**Detection / warning signs:** RLS policies vanish after a deploy/migrate; migration fails on shadow DB; "prepared statement already exists" errors (pooler misconfig); dashboard-made changes not in source control.

**Confidence:** MEDIUM-HIGH (Prisma+Supabase migration friction and connection-mode pitfalls are widely reported; exact remedies evolve — verify current Supabase pooler guidance during Foundation).

**Phase:** Foundation / Data Layer phase.

---

### PITFALL-14: Connection exhaustion — serverless Prisma against Supabase

**What goes wrong:** Vercel serverless functions each open DB connections; under load or with many concurrent webhook/dispatch requests, you exhaust Supabase's Postgres connection limit, causing timeouts and 500s — especially painful on the live dispatch board and during webhook bursts.

**Why it happens:** Each serverless invocation spins a Prisma client/connection; without pooling you blow the connection cap fast.

**Prevention:**
- Connect Prisma through **Supabase's connection pooler (PgBouncer, transaction mode)** with `?pgbouncer=true`; use the direct connection only for migrations.
- Reuse a single Prisma client instance per warm function (global singleton pattern) to avoid per-request client creation.
- Consider Prisma Accelerate or the Supabase pooler's session vs transaction modes deliberately (transaction mode disables prepared statements — Prisma needs `pgbouncer=true` to cope).

**Detection / warning signs:** "Too many connections"/timeout errors under load; intermittent 500s during traffic spikes or webhook storms.

**Confidence:** HIGH.

**Phase:** Foundation, validated under load before launch.

---

## Minor Pitfalls

### PITFALL-15: Timezone and arrival-window correctness
**What goes wrong:** Job arrival windows (JOB-02), scheduling, day sheets (RPT-05), and AR aging buckets (1–30/31–60…) computed in server UTC vs the business's Chicago local time produce off-by-a-day errors and wrong aging buckets.
**Prevention:** Store timestamps as `timestamptz`; compute business-day boundaries and aging in the tenant's timezone (per-tenant TZ setting for the SaaS path). Test around DST and midnight.
**Phase:** Jobs / Reports.

### PITFALL-16: Tax calculation and rounding drift
**What goes wrong:** Per-line tax (JOB-04/EST-04) summed and rounded inconsistently vs invoice-level tax produces totals that are off by a cent, which compounds in the Sales Tax report (RPT-08) used for filing.
**Prevention:** Define one rounding strategy (round at line vs at total) and apply it everywhere; use integer cents or a decimal type, never floats, for money. Make `taxable`/`tax item` (CUST-06, SET-07) authoritative.
**Phase:** Catalog/Jobs, audited in Reports.

### PITFALL-17: Realtime channel scoping leaks across tenants
**What goes wrong:** Supabase Realtime subscriptions on the dispatch board not scoped by tenant could broadcast one tenant's job changes to another's open board.
**Prevention:** Scope Realtime channels/filters by `tenant_id`; ensure RLS applies to Realtime (Realtime respects RLS only when configured to). Verify a second tenant never receives the first tenant's broadcasts.
**Phase:** Dispatch (Module 4), tied to multi-tenant testing.

### PITFALL-18: Resend/Twilio send retries causing duplicate customer messages
**What goes wrong:** Email/SMS triggers (COMM-03/04/05/07) fired from non-idempotent paths (or retried serverless invocations) double-send job confirmations, receipts, and "On The Way" texts.
**Prevention:** Gate each send behind a "already sent for this event" flag/record; bind sends to committed state transitions (PITFALL-6), not to handler entry. Respect SMS consent (CUST-02 SMS consent flag) and quiet hours.
**Phase:** Communications (Module 8).

### PITFALL-19: Data migration from Service Fusion corrupting relationships
**What goes wrong:** Importing full SF history (customers, jobs, equipment, catalog) can flatten the customer→location→equipment hierarchy, drop parent-account links (CUST-01), or mis-map statuses into the new state machine.
**Prevention:** Map SF's model to the new schema explicitly before import; import into a staging tenant; validate counts and spot-check relationships; run the import idempotently so it can be re-run. Treat equipment/spring specs as high-value, verify exactness.
**Phase:** Dedicated migration phase (pre-cutover, not MVP-blocking per PROJECT.md, but high-risk).

### PITFALL-20: PDF generation cost/timeout on serverless
**What goes wrong:** Invoice/work-order PDF generation (INV-08, COMM-09) with heavy headless-browser renderers can exceed Vercel function limits and cost.
**Prevention:** Prefer a lightweight PDF library over headless Chromium where layout allows; generate async and store in Supabase Storage; cache generated PDFs.
**Phase:** Invoicing (Module 6).

---

## Phase-Specific Warning Table

| Phase / Topic | Likely Pitfall(s) | Mitigation Summary | Severity |
|---|---|---|---|
| **Foundation / Data + Auth** | PITFALL-1 (Prisma bypasses RLS), 2 (policy gaps), 3 (Clerk native integration + sync races), 13 (migration conflicts), 14 (connection pooling) | App-level tenant scoping as source of truth + RLS as defense-in-depth; native Clerk↔Supabase integration; idempotent webhooks; PgBouncer; SQL-versioned RLS policies; cross-tenant CI test | CRITICAL |
| **Customer Management (M1)** | PITFALL-7 (equipment/location model), 19 (migration) | Service-location as first-class entity; equipment FK to location; transactional merge | CRITICAL |
| **Estimates (M2)** | PITFALL-2 (new tables need RLS), 12 (list perf) | RLS on every new table; paginate/index | MODERATE |
| **Jobs (M3)** | PITFALL-6 (status machine), 12 (N+1/totals), 15 (timezones) | Server-side transition table; idempotent side effects; denormalized totals; timestamptz | CRITICAL |
| **Dispatch Board (M4)** | PITFALL-8 (assignment race), 12 (500-job load), 17 (Realtime tenant leak), 6 (Close & Invoice idempotency) | Optimistic locking + exclusion constraint; windowed queries + aggregate counts; tenant-scoped channels; one-click invoice guarded against duplicates | CRITICAL |
| **Technician PWA (M5)** | PITFALL-9 (offline sync), 10 (photo upload), 11 (iOS limits) | Idempotent offline queue; append/field-level merge; compressed resumable uploads; treat device as thin buffer | MODERATE-HIGH |
| **Invoicing & Payments (M6)** | PITFALL-4 (Stripe idempotency), 5 (Stripe+Square ledger), 16 (tax rounding), 20 (PDF) | Event-ID + object-ID unique constraints; single payment ledger with locked balance recompute; integer cents; async PDF | CRITICAL |
| **Catalog & Inventory (M7)** | PITFALL-2 (RLS), 16 (cost/margin exposure + tax) | RLS on catalog/inventory; never leak cost/margin to wrong scope | MODERATE |
| **Communications (M8)** | PITFALL-18 (duplicate sends), 6 (transition-bound) | Sent-flags; bind to committed transitions; honor consent | MODERATE |
| **Reports (M9)** | PITFALL-12 (aggregates), 15 (TZ buckets), 16 (tax totals) | Aggregate SQL / materialized views; tenant TZ; consistent rounding | MODERATE |

---

## The Five Things Most Likely to Cause a Rewrite (read these first)

1. **PITFALL-1** — Prisma bypassing RLS. If tenant isolation isn't actually enforced, the whole SaaS premise fails and the data layer is rebuilt. *Foundation.*
2. **PITFALL-7** — Equipment/location ownership model. Get the customer→location→equipment identity wrong and every property-ownership change corrupts history. *Customer Management.*
3. **PITFALL-4 / PITFALL-5** — Payment idempotency and a single payment ledger. Money bugs erode trust instantly and corrupt the AR screen the owner lives in. *Invoicing.*
4. **PITFALL-6** — Job status state machine. Free-dropdown statuses with transition-bound side effects produce wrong customer texts and duplicate invoices across three different UIs. *Jobs.*
5. **PITFALL-3** — Building on the deprecated Clerk JWT template instead of native integration, with non-idempotent sync. Wrong foundation for auth + RLS. *Foundation.*

---

## Sources

**Prisma + Supabase RLS / tenant isolation** (HIGH):
- [Prisma with Supabase RLS policies — Medium](https://medium.com/@kavitanambissan/prisma-with-supabase-rls-policies-c72b68a62330)
- [Supabase RLS Best Practices: Production Patterns for Secure Multi-Tenant Apps — Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Authorization via Row Level Security — Supabase](https://supabase.com/features/row-level-security)
- [Enable RLS for Multi-Tenant Data — SupaExplorer](https://supaexplorer.com/best-practices/supabase-postgres/security-rls-basics/)

**Clerk ↔ Supabase native integration + webhook sync** (HIGH):
- [Clerk — Supabase Docs (third-party auth)](https://supabase.com/docs/guides/auth/third-party/clerk)
- [Integrate Supabase with Clerk — Clerk Docs](https://clerk.com/docs/guides/development/integrations/databases/supabase)
- [Clerk Changelog: Supabase Third-Party Auth Integration (JWT template deprecated 2025-04-01)](https://clerk.com/changelog/2025-03-31-supabase-integration)
- [Sync Clerk data with webhooks — Clerk Docs](https://clerk.com/docs/guides/development/webhooks/syncing)
- [Multi-tenant architecture — Clerk Docs](https://clerk.com/docs/guides/how-clerk-works/multi-tenant-architecture)

**Stripe webhook idempotency** (HIGH):
- [Idempotent requests — Stripe API Reference](https://docs.stripe.com/api/idempotent_requests)
- [Stripe Webhooks: Complete Guide — MagicBell](https://www.magicbell.com/blog/stripe-webhooks-guide)
- [How to Implement Webhook Idempotency — Hookdeck](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency)

**Postgres concurrency / optimistic locking** (HIGH):
- [Implementing Optimistic Locking in PostgreSQL — Reintech](https://reintech.io/blog/implementing-optimistic-locking-postgresql)
- [How to Handle Race Conditions in PostgreSQL Functions — OneUptime](https://oneuptime.com/blog/post/2026-01-25-postgresql-race-conditions/view)
- [Postgres concurrency, locks and isolation levels — Medium](https://medium.com/@zeeshan.shamsuddeen/postgres-concurrency-locks-and-isolation-levels-ef222204484d)

**iOS PWA limitations** (HIGH):
- [PWA iOS Limitations and Safari Support — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [PWAs on iOS 2025: Real Capabilities vs. Hard Limitations — Medium](https://ravi6997.medium.com/pwas-on-ios-in-2025-why-your-web-app-might-beat-native-0b1c35acf845)
- [PWA on iOS — Current Status & Limitations — Brainhub](https://brainhub.eu/library/pwa-on-ios)

**Confidence note:** Equipment/location modeling (PITFALL-7), status-machine (PITFALL-6), and the dual-processor ledger (PITFALL-5) are grounded in FSM domain knowledge plus this project's stated decisions rather than a single citable source — HIGH confidence on the principle, but validate the exact schema against the real Service Fusion export during the migration phase.
