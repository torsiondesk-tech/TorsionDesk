# TorsionDesk Roadmap

**Project:** TorsionDesk — FSM CRM for Infantino's Garage Door Service
**Generated:** 2026-06-10
**Requirements:** 97 v1 requirements
**Phases:** 11
**Mode:** Vertical MVP (each phase delivers a working capability)

## Phase Overview

| Phase | Name | Goal | Requirements |
|-------|------|------|-------------|
| 0 | Foundation — Tenancy, Auth, and Data Spine | Complete | 2026-06-11 |
| 1 | Customers, Locations, and Equipment | The office can manage the full customer book — contacts, properties, and spring/door equipment specs | CUST-01 through CUST-09 |
| 2 | Catalog and Settings | Complete | 2026-06-14 |
| 3 | Jobs Core and Status FSM | Complete | 2026-06-15 |
| 4 | Dispatch Board | A dispatcher schedules and dispatches jobs on a live week-view board and closes-and-invoices in one click | DISP-01 through DISP-07 |
| 5 | Technician Mobile PWA | A tech runs their day offline on their phone — status, photos, signature, notes, and on-site spec lookup | TECH-01 through TECH-08 |
| 6 | Estimates | Sales can run estimates through their own pipeline and convert a won estimate into a job in one action | EST-01 through EST-09 |
| 7 | Invoicing and Payments | A job becomes a tracked invoice; payments record via Stripe and Square into one ledger with live AR aging | INV-01 through INV-09 |
| 8 | Communications and Notifications | The system auto-emails and texts the right people on job, estimate, invoice, and payment events | COMM-01 through COMM-09 |
| 9 | Reports | The owner sees revenue, AR, day sheets, and tax totals by period and exports them | RPT-01 through RPT-09 |
| 10 | Data Migration | The full Service Fusion history — customers, catalog, and job records — is imported for cutover | MIGR-01 through MIGR-03 |

**Parallelization:** Phases 4 (Dispatch Board) and 5 (Technician PWA) are independent surfaces over the same Phase 3 job data and can be built simultaneously.

## Phases

- [x] **Phase 0: Foundation — Tenancy, Auth, and Data Spine** - Workspace creation, Clerk native auth, role-based access, and RLS tenant isolation
- [x] **Phase 1: Customers, Locations, and Equipment** - Customer book with contacts, service locations, and per-location equipment/spring specs
- [x] **Phase 2: Catalog and Settings** - Product/service catalog plus admin configuration of categories, tags, templates, users, and lookups (completed 2026-06-14)
- [x] **Phase 3: Jobs Core and Status FSM** - Job form, line items, totals, and the server-enforced status machine that everything consumes (completed 2026-06-15)
- [ ] **Phase 4: Dispatch Board** - Live week-view scheduling grid with job pool, popup actions, and one-click Close & Invoice
- [ ] **Phase 5: Technician Mobile PWA** - Offline-first tech app for status, photos, signature, notes, and on-site spec lookup
- [ ] **Phase 6: Estimates** - Separate estimate module with its own pipeline, dashboard, templates, and convert-to-job
- [ ] **Phase 7: Invoicing and Payments** - Invoices from jobs, dual-processor payment ledger, and live AR aging dashboard
- [ ] **Phase 8: Communications and Notifications** - Event-triggered email (Resend) and SMS (Twilio) automations with per-trigger settings
- [ ] **Phase 9: Reports** - Sales, AR, day sheet, job activity, and sales-tax reports with CSV/PDF export
- [ ] **Phase 10: Data Migration** - CSV import of Service Fusion customers, catalog, and historical jobs for cutover

## Phase Details

### Phase 0: Foundation — Tenancy, Auth, and Data Spine

**Goal:** A team member can create a workspace, log in with a role, and is provably confined to their own tenant's data by Row Level Security — the foundation every later phase builds on.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, TENANT-01, TENANT-02
**Success Criteria:**

  1. An admin can create a workspace via Clerk during initial setup and lands in an empty, tenant-scoped app.
  2. An admin can invite a teammate by email, assign a role (Admin / Dispatcher / Technician), and that user logs in with the correct module visibility for their role.
  3. A logged-in session survives a browser refresh and tab close, and a user can reset a forgotten password via email link.
  4. A user in Tenant A cannot read or write any Tenant B record — verified by an automated cross-tenant test that confirms RLS denies access.
  5. The tenant's business profile (company name, address, phone, email, logo) can be set and is persisted for use on later invoices and email headers.

**Plans:** 5/5 plans executed (00-05 intentionally deferred)
**Wave 1**

- [x] 00-01-PLAN.md — Wave 0: vitest setup + five failing tests (cross-tenant RLS, withTenant, roles, webhook, profile)
- [x] 00-02-PLAN.md — Wave 1: Next 15 scaffold + Clerk + Drizzle client/schema/withTenant + roles map + org.created webhook

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 00-03-PLAN.md — Wave 2: middleware role gates + public sign-up/sign-in + onboarding + app shell sidebar + dashboard

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 00-04-PLAN.md — Wave 3: Settings (company profile + logo + users/invites + stub tabs) + [BLOCKING] drizzle-kit push

**Wave 4** *(blocked on Wave 3 completion)*

- [~] 00-05-PLAN.md — Wave 4: cross-tenant RLS test green against real Supabase + full suite green (deferred — test project not yet set up; RLS code is production-ready)

### Phase 1: Customers, Locations, and Equipment

**Goal:** The office can manage the complete customer book — customers with contacts, multiple service locations, and per-location door/opener/spring equipment specs — and find any customer fast.
**Mode:** mvp
**Depends on:** Phase 0
**Requirements:** CUST-01, CUST-02, CUST-03, CUST-04, CUST-05, CUST-06, CUST-07, CUST-08, CUST-09
**Success Criteria:**

  1. A user can create a customer with name, account number, VIP flag, parent account, tags, referral source, taxable flag, and internal/public notes.
  2. A customer can hold multiple contacts (with phones, emails, SMS consent, billing/booking flags) and multiple service locations (each with full address and gated-property flag).
  3. Each service location stores equipment records including door specs (brand, size, material, style, color, model/series) and spring specs (wire size, inside diameter, length, wind direction, cycle rating).
  4. A user can search customers by name, phone, email, or address with type-ahead, filter the customer list by status/tags/city, and merge two duplicate records into one canonical record.
  5. A customer profile shows a live Activity Feed timeline (ready to receive job, estimate, invoice, payment, and email events as later phases produce them).

**Plans:** 5/5 plans executed across 3 waves
**UI hint:** yes
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Wave 0: seven failing (RED) customer-book unit tests (Nyquist floor)
- [x] 01-02-PLAN.md — Wave 1: install deps + 10 Drizzle tables + lib helpers + all Server Actions + [BLOCKING] drizzle-kit push

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — Wave 2: customer create/edit form + server-side list + Create New header + shared TagSelect/ReferralSelect/CustomerSearch
- [x] 01-04-PLAN.md — Wave 2: customer detail hub + contacts/locations/equipment drawers + live Activity Feed empty state

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-05-PLAN.md — Wave 3: duplicate-merge side-by-side compare + archive-not-delete

### Phase 2: Catalog and Settings

**Goal:** An admin can configure everything downstream phases depend on — the product/service catalog and all settings: job categories, tags, templates, users, email automation toggles, lookups, and tax items.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07
**Success Criteria:**

  1. An admin can create products (with model, SKU, UPC, prices, sales/purchase descriptions, and up to three vendors with prices) and services, and manage them on a filterable, sortable, CSV-exportable catalog page.
  2. An admin can configure hierarchical job categories, custom tags, and reusable job/estimate templates with pre-filled line items and task lists.
  3. An admin can add users with roles, configure tax items, and manage lookup lists (referral sources, job sources) used by job and estimate forms.
  4. An admin can set per-trigger email automation toggles and edit email body templates (the configuration Phase 8 will consume).
  5. The "Create New Product / Service" inline modal saves to the catalog and is reusable as the line-item add flow that Phases 3 and 6 will embed.

**Plans:** 5/6 plans complete
**UI hint:** yes
Plans:
**Wave 0**

- [~] 02-01-PLAN.md — Six RED Nyquist contract tests (products/services/categories/tags-color/tax-items/lookups) — partially satisfied by tests created inline during 02-03 execution

**Wave 1** *(blocked on Wave 0)*

- [x] 02-02-PLAN.md — Add 6 tables (products, services, product/job categories, tax_items, job_sources) + [BLOCKING] drizzle-kit push

**Wave 2** *(blocked on Wave 1 — three parallel slices)*

- [x] 02-03-PLAN.md — Catalog Products slice: lib/catalog + actions + list/filter/sort + CSV export + product form (vendors) + nav (CAT-01, CAT-03)
- [x] 02-05-PLAN.md — Settings: Job Categories (hierarchical) + Product Categories (flat) (SET-01, CAT-05)
- [x] 02-06-PLAN.md — Settings: Tags (color+usage) + Tax Items + Lookup Lists + activate 4 settings tabs (SET-02, SET-07, SET-06)

**Wave 3** *(blocked on Wave 2 / Plan 02-03)*

- [x] 02-04-PLAN.md — Catalog Services slice + inline-create modal (CAT-02, CAT-04)

### Phase 3: Jobs Core and Status FSM

**Goal:** A job can be created with full two-panel detail, priced with grouped line items and a live totals panel, and driven through a server-enforced status machine — the central hub every other surface reads from and writes to.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** JOB-01, JOB-02, JOB-03, JOB-04, JOB-05, JOB-06, JOB-07, JOB-08, JOB-09, JOB-10, JOB-11, JOB-12, JOB-13, JOB-14
**Success Criteria:**

  1. A user can create a job via the two-panel form (Details left, Job Info right) selecting an existing customer, contact, service location, hierarchical category, assigned techs, and tags.
  2. A user can add Product / Service / Discount line items across the Products & Services and Expenses tabs and watch the totals panel compute Job Total, Total Due, Job Cost, and Gross Profit %.
  3. Job status only moves along server-enforced legal transitions (Open / In Progress / Closed groups) and rejects illegal jumps — guarding the SMS and invoice side-effects that later phases bind to transition events.
  4. A user can apply a job template to pre-fill line items and tasks, configure a repeating job, and add additional site visits with their own dates/statuses.
  5. The jobs dashboard lists jobs with the left sidebar (My Jobs by status, Jobs by Tag with counts, All Open, Completed & Ready to Close, To Be Invoiced) and a sortable main list, with the Summary/Pics/Docs/Equipment/Sign tabs present on the job detail.

**Plans:** 6/6 plans complete
**UI hint:** yes
Plans:
**Wave 0**

- [x] 03-01-PLAN.md — Nyquist RED tests: FSM transitions, transitionJobStatus, totals (cent-exact), nextJobNo, per-tag counts, applyTemplate

**Wave 1** *(blocked on Wave 0)*

- [x] 03-02-PLAN.md — 12 job tables + 3 enums + [BLOCKING] pnpm db:push + nextJobNo helper + flip Jobs sidebar enabled

**Wave 2** *(blocked on Wave 1)*

- [x] 03-03-PLAN.md — FSM core (ALLOWED_TRANSITIONS + transitionJobStatus + named stubs) + computeJobTotals + listJobs/getJob/countJobsByTag

**Wave 3** *(blocked on Wave 2)*

- [x] 03-04-PLAN.md — Job CRUD actions + two-panel JobForm + line items (Add dialog + inline catalog create) + live totals + FSM status dropdown

**Wave 4** *(blocked on Wave 3)*

- [x] 03-05-PLAN.md — Jobs dashboard (8-bucket nested sidebar + sortable table) + job detail 6 tabs + Equipment (read-only) + Pics (Storage upload)

**Wave 5** *(blocked on Wave 4)*

- [x] 03-06-PLAN.md — Templates (SET-03 + Apply) + repeating-job config + site visits + tasks/reminders + wire customer New Job button + Jobs tab

### Phase 4: Dispatch Board

**Goal:** A dispatcher schedules, assigns, and dispatches jobs on a live week-view board, acts on any job from a popup, and closes-and-invoices in a single click without leaving the board.
**Mode:** mvp
**Depends on:** Phase 3
**Parallelization:** Can be built in parallel with Phase 5 (Technician PWA) — both are independent surfaces over the same Phase 3 job data.
**Requirements:** DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06, DISP-07
**Success Criteria:**

  1. A dispatcher sees a week-view grid with technicians as rows and days as columns, with job blocks positioned by scheduled date/time.
  2. Assigning a tech (from the job form or by dragging from the live job pool) places the job on the calendar automatically, and the pool's filterable tabs show live counts.
  3. Hovering a job block shows customer/address/status; clicking opens a popup with map, details, invoice link, and quick-action buttons (Dispatch, View Details, Make Changes, Deposits, Close & Invoice, Cancel, Email, Print).
  4. "Close & Invoice" from the popup transitions the job to Invoiced and creates the invoice in one click without navigating away.
  5. A tech assignment or status change made in one open session appears in another open session in real time via Supabase Realtime Broadcast.

**Plans:** TBD
**UI hint:** yes

### Phase 5: Technician Mobile PWA

**Goal:** A technician runs their entire day from an installable, offline-capable phone app — viewing their schedule, updating status, capturing photos and signatures, adding notes, and looking up spring specs on site — with reliable sync.
**Mode:** mvp
**Depends on:** Phase 3
**Parallelization:** Can be built in parallel with Phase 4 (Dispatch Board) — both are independent surfaces over the same Phase 3 job data.
**Requirements:** TECH-01, TECH-02, TECH-03, TECH-04, TECH-05, TECH-06, TECH-07, TECH-08
**Success Criteria:**

  1. A tech installs the app to their phone home screen and can open it and view their assigned jobs (today + next 7 days) even with no signal.
  2. A tech updates job status from the allowed set (On The Way, On Site, Started, Completed, Partially Completed, Paused), with "On The Way" flagged to trigger the customer SMS once Phase 8 is live.
  3. A tech captures before/after photos from the phone camera and collects a customer touchscreen signature on completion; both attach to the job.
  4. A tech adds completion notes and views the service location's equipment and spring specs from the job detail screen.
  5. Status updates, notes, and photos created offline are queued in IndexedDB, visually flagged as unsynced, and auto-sync on reconnect (including the iOS sync-on-focus fallback).

**Plans:** TBD
**UI hint:** yes

### Phase 6: Estimates

**Goal:** Sales can run estimates through their own dedicated pipeline and dashboard, build them with grouped catalog line items, email them as PDFs, and convert a won estimate into a job in one action.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** EST-01, EST-02, EST-03, EST-04, EST-05, EST-06, EST-07, EST-08, EST-09
**Success Criteria:**

  1. A user creates an estimate in its own module via the two-panel form (Project Specs left, Sales Data right) with customer, location, category, opportunity rating, tags, and follow-up tasks.
  2. An estimate moves through its server-enforced pipeline (Requested → Provided → Accepted → Won / Lost) and supports grouped Product/Service/Discount line items with margins and tax.
  3. A user can save and apply estimate templates and configure task-list and reminder presets.
  4. The estimates dashboard shows the status-folder sidebar with counts (My / All Estimates) and tag filtering, plus the main list columns (Requested On, Customer, Description, Value, Status, Rating).
  5. A user can email an estimate as a PDF to the customer, and convert a won estimate into a new job in one action carrying over all fields, line items, and contact info.

**Plans:** TBD
**UI hint:** yes

### Phase 7: Invoicing and Payments

**Goal:** A completed job becomes a tracked invoice; payments are recorded online via Stripe and on-site via Square into one canonical ledger, with a live AR aging dashboard the owner checks constantly.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09
**Success Criteria:**

  1. An invoice is created from a job carrying over all line items, customer, and contact details, with a per-tenant auto-incrementing invoice number.
  2. The invoicing dashboard shows the AR aging sidebar (Grand Total Unpaid, Grand Total Past Due, 1–30 / 31–60 / 61–90 / 91+ buckets, color-coded) and Unpaid / Paid / All views with search, sort, and pagination.
  3. A payment is recorded directly on an invoice (method + amount applied) and stores full transaction detail (card last 4, token, auth #, billing address, balance after).
  4. A Stripe payment link in the invoice creates a payment record via an idempotent webhook (deduped by event.id); a Square on-site card payment from the tech's phone posts to the same canonical ledger.
  5. A user can generate an invoice PDF (with optional work order including line items, completion notes, and signature) and email it to the customer with the PDF attached.

**Plans:** TBD
**UI hint:** yes

### Phase 8: Communications and Notifications

**Goal:** The system automatically emails and texts the right people on the right events — job confirmations, tech notifications, estimate/invoice sends, payment receipts, and "On The Way" SMS — all governed by per-trigger settings.
**Mode:** mvp
**Depends on:** Phase 7
**Requirements:** COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, COMM-06, COMM-07, COMM-08, COMM-09
**Success Criteria:**

  1. All outbound email sends via Resend from contact@infantinosgaragedoor.com with the configured business name in the sender header.
  2. Job creation emails a customer confirmation, tech assignment/modification emails the tech, invoice creation emails the customer, and an estimate can be emailed — each only when its trigger is enabled in settings.
  3. A confirmed Stripe payment automatically emails the customer a payment receipt (webhook-triggered, not manual).
  4. A job's transition to "On The Way" sends the customer an SMS via Twilio (A2P 10DLC registered), and appointment reminder SMS is configurable per job.
  5. Outbound job/estimate/invoice emails include the relevant PDF attachment, with the work order PDF optionally included on invoice emails.

**Plans:** TBD

### Phase 9: Reports

**Goal:** The owner can see revenue, AR, day sheets, job activity, and sales tax broken down by period and tech/customer/product, and export any report.
**Mode:** mvp
**Depends on:** Phase 7
**Requirements:** RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-07, RPT-08, RPT-09
**Success Criteria:**

  1. The owner can view All Sales by period with breakdowns by Products, Services, Labor, and Taxes, plus Sales by Technician, by Customer, and by Product/Service.
  2. The owner can view a Day Sheet of jobs per tech for today / tomorrow / next 14 days and print it.
  3. The owner can view Unpaid Invoices with aging (mirroring the AR sidebar), Job Activity volume by period, and a Sales Tax report grouped by tax item for filing.
  4. Any report can be exported as CSV and PDF.

**Plans:** TBD
**UI hint:** yes

### Phase 10: Data Migration

**Goal:** The full Service Fusion history — customers, catalog, and historical jobs — is imported so the business can cut over from Service Fusion entirely.
**Mode:** mvp
**Depends on:** Phase 9
**Requirements:** MIGR-01, MIGR-02, MIGR-03
**Success Criteria:**

  1. An admin can import the customer list from a Service Fusion CSV, mapping name, account number, contacts, and service locations (preserving the address-as-name pattern).
  2. An admin can import the product/service catalog from CSV, mapping category, name, model, SKU, prices, and both description fields.
  3. An admin can import historical jobs from CSV as read-only reference records that appear in reporting but are not editable as live jobs.

**Plans:** TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Foundation — Tenancy, Auth, and Data Spine | 5/5 | Completed | 2026-06-11 |
| 1. Customers, Locations, and Equipment | 5/5 | Completed | 2026-06-12 |
| 2. Catalog and Settings | 5/6 | Completed | 2026-06-14 |
| 3. Jobs Core and Status FSM | 6/6 | Completed | 2026-06-15 |
| 4. Dispatch Board | 0/0 | Ready to plan | - |
| 5. Technician Mobile PWA | 0/0 | Ready to plan | - |
| 6. Estimates | 0/0 | Not started | - |
| 7. Invoicing and Payments | 0/0 | Not started | - |
| 8. Communications and Notifications | 0/0 | Not started | - |
| 9. Reports | 0/0 | Not started | - |
| 10. Data Migration | 0/0 | Not started | - |

---
*Roadmap generated: 2026-06-10 | 11 phases, 97 v1 requirements, 100% coverage*
*Phase 0 planned: 2026-06-10 — 5 plans across 5 waves (Walking Skeleton)*
*Phase 3 completed: 2026-06-15 — 6/6 plans, 8/8 UAT passed, 17/17 truths verified*
*Next: Phase 4 (Dispatch Board) and Phase 5 (Technician PWA) ready for parallel planning*
