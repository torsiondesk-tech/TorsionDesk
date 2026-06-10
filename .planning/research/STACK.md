# Technology Stack

**Project:** GarageOS — Custom FSM CRM (Service Fusion replacement)
**Researched:** 2026-06-10
**Overall confidence:** HIGH (verified against official docs + 2025/2026 sources)

## TL;DR — Verdict on the Proposed Stack

The proposed stack is **80% correct and shippable**, but it has **one architectural conflict and three version drift issues** that will cost you real time if not addressed before building.

| Layer | Proposed | Verdict | Action |
|-------|----------|---------|--------|
| Framework | Next.js **14** App Router | CHANGE version | Use **Next.js 15** (15.x is the stable, well-trodden line; 16 also stable but newer) |
| Database | PostgreSQL via Supabase | KEEP | Correct — RLS + Storage + Realtime is the right 3-in-1 |
| ORM | **Prisma** | CHALLENGE | **Drizzle** is the better fit *because of RLS*; Prisma fights RLS |
| Auth | Clerk (orgs) | KEEP (with caveat) | Correct for SaaS path; use the **native** Supabase integration, NOT the deprecated JWT template |
| UI | shadcn/ui + Tailwind **v4** | KEEP | Validated on Next 15; expect CSS-first config (no `tailwind.config.js`) |
| Hosting | Vercel | KEEP | Correct; watch function timeout limits for PDF gen |
| Email | Resend | KEEP | Correct |
| Payments | Stripe + Square | KEEP (clarify roles) | Stripe = online links; Square = on-site. Sound split. |
| SMS | Twilio | KEEP | Correct; budget A2P 10DLC registration |
| Mobile | PWA | KEEP | Use **Serwist**, NOT `next-pwa` (unmaintained) |
| Realtime | Supabase Realtime | KEEP | Correct at your scale; know the Postgres Changes ceiling |

**The single most important decision in this document:** Do not pair Prisma with Supabase RLS for multi-tenancy. Either (a) switch the ORM to Drizzle, which has first-class RLS support, or (b) keep Prisma but enforce tenancy in the application layer rather than relying on RLS. Mixing Prisma-as-superuser with RLS-as-your-security-model gives you the worst of both: RLS overhead with none of its protection. Details below.

---

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | **15.x** (App Router) | Full-stack React framework | Stable, React 19 support, well-tested App Router. Next 14 is two majors behind (15 = Oct 2024, 16 = Oct 2025). shadcn/Tailwind v4 guides target 15. |
| React | 19.x | UI runtime | Ships with Next 15; required by current shadcn components |
| TypeScript | 5.x | Type safety | Standard |
| Node | 20 LTS or 22 LTS | Runtime | Vercel default |

**Why not Next.js 14 (as proposed):** No technical blocker, but you'd be starting a brand-new project on a deprecated line. The ecosystem (shadcn CLI, Tailwind v4 guides, Serwist examples) now assumes 15+. Confidence: HIGH.

**Why not Next.js 16 (newest):** 16 is stable (Oct 2025) and fine, but 15.x has a deeper bed of community solutions for the exact integrations you're using (Clerk + Supabase + Serwist). Pick 15.x to minimize "you're the first to hit this" moments. If starting truly greenfield with appetite for newer, 16 is acceptable. Confidence: MEDIUM.

**Next 15 gotcha:** Caching defaults changed — `GET` Route Handlers and the Client Router Cache are **uncached by default** (opposite of 14). This is actually what you want for a live CRM/dispatch board (you want fresh data), but be deliberate about where you *do* cache (reports, catalog). Confidence: HIGH.

### Database & Backend Platform
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase (PostgreSQL 15+) | Current | Primary datastore | RLS for multi-tenancy, Storage for photos, Realtime for dispatch — three requirements, one platform |
| Supabase Storage | Current | Job photos, doc/PDF attachments | S3-compatible, RLS-protected, direct browser upload from tech's camera |
| Supabase Realtime | Current | Live dispatch board | Postgres Changes / Broadcast — adequate at your scale (see Realtime section) |

**Verdict: KEEP.** Supabase is the correct backbone here. It solves three of your hard constraints (multi-tenant isolation, photo storage, real-time dispatch) in one $25/mo Pro plan, which fits your $20–50/mo budget. Confidence: HIGH.

### ORM — THE KEY DECISION
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Drizzle ORM** (recommended) | Current | Type-safe SQL + migrations | **First-class Postgres RLS support** (`crudPolicy()`, Supabase helpers), tiny bundle, fast serverless cold starts |
| Prisma (proposed) | 5.x/6.x | Type-safe ORM | Mature, great DX — but **no native RLS support**; bypasses RLS by default |

See the dedicated "Prisma vs Drizzle for RLS" section below. This is the one stack choice I'm actively challenging. Confidence: HIGH.

### Auth
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Clerk | Current | Auth + multi-tenant organizations | Built-in orgs/roles/invitations; **native Supabase third-party integration** (since Apr 2025) means Clerk-signed JWTs flow into RLS via `auth.jwt()` |

**Verdict: KEEP** — Clerk is the right call for your SaaS path. But two non-negotiables:
1. Use the **native third-party auth integration**, NOT the JWT template (deprecated Apr 1 2025).
2. Understand the **organization billing model** before you go multi-tenant (see Clerk section). Confidence: HIGH.

### UI Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | Current (Radix-based) | Component primitives | Copy-in components, full control — ideal for replicating Service Fusion's dense layouts |
| Tailwind CSS | **v4** | Styling | CSS-first config (no `tailwind.config.js`), `@theme` directive |
| tw-animate-css | Current | Animations | Replaces deprecated `tailwindcss-animate` in Tailwind v4 |
| TanStack Table | v8 | Data grids | The job/estimate/invoice/catalog lists are heavy tables with sort/filter/paginate — don't hand-roll these |
| dnd-kit | Current | Drag-drop dispatch board | For dragging job blocks onto the technician/day grid |

**Verdict: KEEP.** shadcn + Tailwind v4 are validated together on Next 15. The dense, table-heavy, two-panel Service Fusion layouts are exactly what shadcn + TanStack Table handle well. Confidence: HIGH.

### Hosting
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | Current | App hosting | First-party Next.js host; Hobby/Pro fits budget |

**Verdict: KEEP**, with one watch item: PDF generation (invoices/work orders) and any heavy report export can hit serverless function **timeout/memory limits** on Hobby (10s) — Pro gives 60s+ (configurable). Plan PDF generation as a background/queued operation if invoices get large. Confidence: HIGH.

### Integrations
| Technology | Purpose | Why / Notes |
|------------|---------|-------------|
| Resend | Transactional email | Clean API, React Email templates. Verify your sending domain (`infantinosgaragedoor.com`) with SPF/DKIM before COMM-* features. |
| Stripe | Online payment links + webhooks | INV-06: payment link in invoice email; webhook → payment record + receipt. Mature, reliable. |
| Square | On-site card by technician | INV-07: use **Square Mobile Payments SDK** (GA in 2025) — accept contactless on the tech's phone with no extra hardware, or pair a Square Reader. |
| Twilio | SMS (On-The-Way, reminders) | COMM-07. **Budget A2P 10DLC brand/campaign registration** — required for US business SMS or messages get filtered. |

**Verdict: KEEP all.** The Stripe (online) + Square (in-person) split is a reasonable, common pattern — Stripe Terminal would require more custom integration for the same on-site outcome Square gives you out of the box. Confidence: HIGH.

### Mobile (Technician PWA)
| Technology | Purpose | Why |
|------------|---------|-----|
| **Serwist** (`@serwist/next`) | Service worker / PWA | **Replaces `next-pwa`** which is unmaintained (~2 yrs stale). Serwist is the recommended successor, Workbox-based, App Router friendly, referenced in Next.js docs. |
| Dexie.js (IndexedDB) | Offline data + mutation queue | Local source of truth for the tech's assigned jobs; durable outbound queue for offline status updates/photos |
| Background Sync API (+ sync-on-focus fallback) | Replay offline mutations | Chromium supports Background Sync; **Safari/Firefox do NOT** — implement a sync-on-focus fallback (critical, techs may use iPhones/Safari) |

**Verdict: KEEP PWA, CHANGE the tooling.** PWA is the right call (no App Store, same-day deploy, offline). But `next-pwa` (which the constraint implies) is dead — use Serwist. See PWA section. Confidence: HIGH.

---

## DECISION DEEP-DIVE 1: Prisma vs Drizzle for Supabase RLS

This is the most consequential finding in this research.

### The conflict
Your architecture says "multi-tenancy via Supabase RLS from day one." But **Prisma connects to Postgres as a privileged role that bypasses every RLS policy by default.** So out of the box, your RLS policies do nothing for Prisma-issued queries — you'd have RLS giving you a false sense of security while Prisma reads every tenant's data.

To make Prisma respect RLS you must:
1. Create a **non-superuser Postgres role** and point `DATABASE_URL` at it (so it can't bypass RLS).
2. Wrap **every** query in a transaction that first runs `SET LOCAL` to inject the tenant/user context the RLS policies read.
3. Do this via **Prisma Client Extensions** (still flagged preview-ish) or middleware, and accept that this **breaks with Prisma's connection pooling assumptions** and is awkward with Supavisor transaction-mode pooling on Vercel serverless.

That's a lot of fragile plumbing on a hot path, for every query, forever.

### Why Drizzle is the better fit
- **First-class RLS:** Drizzle ships Postgres RLS helpers including Supabase-specific `crudPolicy()` and an `rls`-aware client — you define policies in your schema and Drizzle issues queries under the right role/context.
- **Serverless-friendly:** ~7KB, zero native binary. Cold starts drop from Prisma's 1–3s to sub-500ms — meaningful on Vercel functions and for the tech PWA's perceived speed.
- **Supabase-native:** designed around the Supavisor pooler (`prepare: false` for transaction mode) that you'll use on Vercel.

### Recommendation (pick ONE coherent model)
- **Option A (recommended): Drizzle + Supabase RLS.** RLS is your real, database-enforced tenant boundary. Best long-term for the SaaS path where you're licensing to other businesses and cannot afford a tenant-leak bug.
- **Option B: Keep Prisma, drop RLS as the security boundary.** Enforce tenancy in the application layer (every query filtered by `tenant_id`, centralized in a repository layer). Treat RLS as optional defense-in-depth only if you do the SET LOCAL work. Simpler DX, but a single missing `where tenant_id` is a cross-tenant leak — risky for a multi-tenant SaaS.

**Do not do the implicit Option C** (Prisma + RLS "on" but Prisma connecting as superuser) — that's the worst case: RLS exists in the schema but protects nothing.

**My call:** Switch to **Drizzle** and let RLS be the real boundary. For a product whose explicit endgame is "licensable multi-tenant SaaS," database-enforced isolation is worth the slightly steeper SQL learning curve. If the team strongly prefers Prisma's DX and ships single-tenant first, Option B is acceptable *provided* the tenant filter is centralized and reviewed.

Confidence: HIGH (Prisma-bypasses-RLS is documented and well-known; Drizzle RLS support is documented).

---

## DECISION DEEP-DIVE 2: Clerk + Supabase (org-based multi-tenancy)

### Use the native integration, not the JWT template
As of **April 1, 2025**, the old "Clerk JWT template for Supabase" approach is **deprecated**. The current path is Clerk as a **Supabase third-party auth provider**:
- Supabase accepts Clerk-signed session tokens directly.
- Your RLS policies read Clerk claims via `auth.jwt()` (e.g. `auth.jwt()->>'org_id'`).
- No JWT secret sharing, no per-request token minting.

Any tutorial older than mid-2025 showing a JWT template is stale — ignore it. Confidence: HIGH.

### Multi-tenancy model: Clerk Organizations = your tenants
Map **one Clerk Organization = one garage-door business (tenant)**. The org's `org_id` lands in the session token, RLS scopes every table by it. Clerk roles (admin / dispatcher / technician) map cleanly to your SET-04 user roles. This is exactly what Clerk Organizations are built for. Confidence: HIGH.

### Cost reality for the SaaS path (plan ahead)
- **Free tier:** up to 50K monthly users, but only **100 monthly active organizations** and (on free B2B) **5 members/org**.
- **Pro:** $25/mo base, then **$1 per monthly-active-organization beyond 100**, plus per-MAU beyond included.
- For **today (single tenant)** you're free/cheap — fits the $20–50 budget easily.
- For **SaaS at scale**, orgs are a real line item. Not a blocker, just model it before pricing your product. WorkOS is the usual "we outgrew Clerk's org pricing" alternative — note it, don't switch now.

Confidence: HIGH (pricing verified June 2026; re-check at purchase time as pricing shifts).

---

## DECISION DEEP-DIVE 3: Real-time Dispatch Board

Your dispatch board (DISP-01..07) needs multiple office users to see job moves/status changes instantly.

### Supabase Realtime is the right choice at your scale — KEEP
- You have **1–2 techs + a few office users today**, growing slowly. You are nowhere near Realtime's ceilings.
- Pro plan includes **500 concurrent connections** and **5M messages/mo** — orders of magnitude past your needs for years.

### Know the Postgres Changes ceiling (and design around it)
- **Postgres Changes** re-checks RLS per subscriber per change (100 subscribers + 1 insert = 100 authorization reads) and processes on a **single thread** — it does NOT scale to high write volume (1,000+ writes/sec would overload it). Your dispatch board is low-volume (a handful of status changes per minute), so this is fine.
- **Recommendation:** Use **Realtime Broadcast** (or Broadcast-from-database triggers) for the dispatch board rather than raw Postgres Changes where practical — Broadcast scales better and decouples the live channel from per-row RLS re-checks. Use Postgres Changes for low-frequency tables (job status) if simpler.

### Alternatives (do NOT adopt now)
- **Pusher / Ably:** purpose-built event distribution, scale further — but add a second vendor, second bill, and you don't need them at 1–2 techs. Note as the escape hatch if you later run hundreds of concurrent dispatcher sessions across many tenants.
- **Raw SSE:** lightweight, but you'd rebuild reconnection/fan-out that Supabase already gives you. Not worth it when Supabase is already in the stack.

**Verdict: Supabase Realtime, leaning on Broadcast for the board.** Confidence: HIGH.

---

## DECISION DEEP-DIVE 4: PWA & Offline (Technician View)

TECH-01 requires offline operation in poor-signal areas — the hardest non-obvious part of this whole project.

### Tooling: Serwist, not next-pwa
- `next-pwa` is **unmaintained (~2 years stale)**. The maintained fork (`@ducanh2912/next-pwa`) exists, but the ecosystem and Next.js docs now point to **Serwist** (`@serwist/next`) as the successor. Use Serwist.

### Offline architecture (this needs a dedicated phase)
1. **Service worker (Serwist):** cache-first for the app shell/static assets, network-first for API/data.
2. **IndexedDB via Dexie.js:** local source of truth for the tech's assigned jobs (TECH-02), so the app works fully offline.
3. **Outbound mutation queue in IndexedDB:** status updates (TECH-03), completion notes (TECH-06), photo uploads (TECH-04), signatures (TECH-05) are written locally with a **client-generated UUID / idempotency key**, then replayed when online.
4. **Background Sync API** to replay the queue — **with a sync-on-focus fallback**, because **Safari and Firefox do not support Background Sync** (as of early 2026) and your techs may be on iPhones/Safari. This fallback is mandatory, not optional.
5. **Conflict policy:** last-write-wins by timestamp is fine for 95% of cases; for job status specifically, prefer server-authoritative ordering so a stale offline "On Site" can't overwrite a newer office-side "Cancelled."

### Photo upload caveat
Photos (TECH-04) can be large; queueing several before-and-after images offline can pressure IndexedDB quotas (Safari ~1GB). Compress client-side before queuing, and upload directly to Supabase Storage with a resumable strategy when back online.

Confidence: HIGH on tooling/patterns; the *implementation* is genuinely hard — flag as needing deep, dedicated research in its own phase.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not (now) |
|----------|-------------|-------------|---------------|
| ORM | Drizzle | Prisma | Prisma bypasses RLS by default; RLS plumbing is fragile on serverless |
| Framework version | Next.js 15 | Next.js 14 / 16 | 14 deprecated line; 16 newer with thinner integration bed for your exact stack |
| Auth | Clerk | Supabase Auth | Supabase Auth is cheaper but org/team management is weaker for B2B SaaS; Clerk's orgs map to tenants |
| Auth (scale) | Clerk | WorkOS | Only if Clerk org pricing bites at SaaS scale — not now |
| Realtime | Supabase Realtime (Broadcast) | Pusher / Ably | Second vendor + bill; unnecessary at 1–2 techs |
| PWA | Serwist | next-pwa | next-pwa unmaintained |
| Auth-DB bridge | Clerk native 3rd-party integration | Clerk JWT template | Template deprecated Apr 2025 |
| In-person pay | Square Mobile Payments SDK | Stripe Terminal | Terminal needs more custom POS integration for same outcome |

---

## Installation (target stack)

```bash
# Core (Next 15 + React 19)
npx create-next-app@latest garageos --typescript --tailwind --app

# UI
npx shadcn@latest init            # Tailwind v4 + tw-animate-css
npm install @tanstack/react-table @dnd-kit/core @dnd-kit/sortable

# Data (Drizzle path — recommended)
npm install drizzle-orm postgres
npm install -D drizzle-kit
# (If keeping Prisma instead: npm install prisma @prisma/client — see Deep-Dive 1 caveats)

# Auth
npm install @clerk/nextjs

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# PWA / offline
npm install @serwist/next @serwist/precaching @serwist/sw dexie idb

# Integrations
npm install resend stripe @square/web-sdk twilio
npm install react-email @react-email/components   # email templates

# PDF (invoices / work orders) — pick one
npm install @react-pdf/renderer   # or puppeteer-core + @sparticuz/chromium for HTML->PDF
```

---

## What NOT to Use (and why)

| Avoid | Reason | Use instead |
|-------|--------|-------------|
| `next-pwa` | Unmaintained (~2 yrs) | Serwist (`@serwist/next`) |
| Clerk JWT template for Supabase | Deprecated Apr 2025 | Clerk native third-party auth integration |
| Prisma **with** RLS as your security model | Connects as RLS-bypassing role by default; SET-LOCAL plumbing is fragile on serverless pooling | Drizzle + RLS, OR Prisma + app-layer tenancy (one model, not both half-done) |
| Next.js 14 for a new build | Deprecated line; ecosystem targets 15+ | Next.js 15.x |
| Postgres Changes for high-write tables | Single-threaded, per-subscriber RLS re-check, doesn't scale | Realtime Broadcast for the board |
| Relying on Background Sync alone | Unsupported in Safari/Firefox | Background Sync **+ sync-on-focus fallback** |
| Hand-rolled data grids | Sort/filter/paginate/virtualize is a tar pit | TanStack Table v8 |
| NextAuth/Auth.js (the rejected option) | Correct to reject — multi-tenant org retrofit is painful, exactly as PROJECT.md states | Clerk |
| Tailwind v3 patterns / `tailwindcss-animate` | v4 is CSS-first; old plugin deprecated | Tailwind v4 `@theme` + `tw-animate-css` |
| PDF gen inline on Hobby plan | 10s function timeout; large invoices/work orders can exceed | Pro plan timeouts or background/queued PDF job |

---

## Confidence Summary

| Recommendation | Confidence | Basis |
|----------------|------------|-------|
| Next.js 15 over 14 | HIGH | Official release status; ecosystem targeting |
| Drizzle over Prisma for RLS | HIGH | Prisma RLS bypass documented; Drizzle RLS support documented |
| Clerk native integration (not JWT template) | HIGH | Supabase + Clerk official docs, deprecation dated Apr 2025 |
| Supabase Realtime (Broadcast) for dispatch | HIGH | Supabase Realtime limits/benchmarks docs |
| Serwist over next-pwa | HIGH | Maintenance status + Next.js docs |
| Offline mutation-queue architecture | HIGH (pattern) / implementation hard | Multiple corroborating 2025/2026 sources |
| Tailwind v4 + shadcn on Next 15 | HIGH | shadcn official Tailwind v4 docs |
| Clerk org pricing for SaaS | MEDIUM | Verified June 2026; pricing drifts — re-check at purchase |
| Square Mobile Payments SDK for on-site | HIGH | Square developer blog (GA 2025) |
| Keep Stripe + Square split | MEDIUM-HIGH | Common pattern; verify both account approvals early |

---

## Roadmap Implications (stack-driven)

1. **Foundation phase must lock the ORM + RLS model first.** The Drizzle-vs-Prisma + RLS decision is load-bearing for every table you create. Get tenant isolation right on table #1; retrofitting RLS across an existing schema is painful.
2. **Auth + tenant context is phase-zero plumbing.** Clerk native integration + `auth.jwt()->>'org_id'` RLS policies need to exist before any data feature, because every table depends on the tenant boundary.
3. **The Technician PWA / offline sync deserves its own dedicated phase with deep research.** It's the highest-risk, least-standard part of the build (offline queue, Background Sync fallback, photo upload, conflict resolution). Do not bury it inside a generic "mobile" task.
4. **Dispatch board is a focused phase** (Realtime Broadcast + dnd-kit grid + hover/popup) — well-understood pieces, but the "Close & Invoice in one click" (DISP-06) crosses jobs→invoice→email and should be designed deliberately.
5. **Payments split into two integration phases** (Stripe online webhooks; Square on-site SDK) — different SDKs, different webhook/receipt flows. Start merchant-account approval early; it has external lead time.
6. **PDF generation is an infrastructure spike**, not an afterthought — Vercel timeout limits make it a real design decision (INV-08, COMM-09, RPT-09).

---

## Sources

**Clerk + Supabase integration (native, JWT template deprecation):**
- [Clerk | Supabase Docs](https://supabase.com/docs/guides/auth/third-party/clerk)
- [Integrate Supabase with Clerk — Clerk Docs](https://clerk.com/docs/guides/development/integrations/databases/supabase)
- [Supabase Third-Party Auth Integration — Clerk changelog (2025-03-31)](https://clerk.com/changelog/2025-03-31-supabase-integration)
- [How Clerk integrates with Supabase](https://clerk.com/blog/how-clerk-integrates-with-supabase-auth)

**Prisma / Drizzle + RLS:**
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Prisma | Supabase Docs](https://supabase.com/docs/guides/database/prisma)
- [prisma-extension-supabase-rls (GitHub)](https://github.com/dthyresson/prisma-extension-supabase-rls)
- [Drizzle vs Prisma ORM — makerkit](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [Drizzle ORM vs Prisma — Bytebase](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Supabase Security Retro 2025](https://supabase.com/blog/supabase-security-2025-retro)

**Next.js version:**
- [Next.js 15 — official blog](https://nextjs.org/blog/next-15)

**PWA / Serwist / offline:**
- [Guides: PWAs | Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Building a PWA in Next.js with Serwist (next-pwa successor)](https://javascript.plainenglish.io/building-a-progressive-web-app-pwa-in-next-js-with-serwist-next-pwa-successor-94e05cb418d7)
- [Offline and background operation — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [How to Implement Background Sync in React PWAs](https://oneuptime.com/blog/post/2026-01-15-background-sync-react-pwa/view)

**Supabase Realtime:**
- [Realtime Limits | Supabase Docs](https://supabase.com/docs/guides/realtime/limits)
- [Realtime Benchmarks | Supabase Docs](https://supabase.com/docs/guides/realtime/benchmarks)
- [Supabase Realtime in Production: What Nobody Tells You](https://www.agilesoftlabs.com/blog/2026/05/supabase-realtime-in-production-what)

**Clerk pricing / organizations:**
- [Clerk Pricing](https://clerk.com/pricing)
- [B2B SaaS with Clerk (Organizations)](https://clerk.com/organizations)
- [Clerk pricing: how it compares to WorkOS](https://workos.com/blog/clerk-pricing)

**Payments:**
- [Announcing Mobile Payments SDK GA — Square Developers](https://developer.squareup.com/blog/announcing-mobile-payments-sdk-ga-and-new-terminal-api-features/)
- [Square In-Person Payments APIs & SDKs](https://developer.squareup.com/us/en/in-person-payments)

**UI:**
- [Tailwind v4 — shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
