# GarageOS — Custom FSM CRM for Infantino's Garage Door Service

## What This Is

A full-featured field service management CRM built as a Service Fusion replacement, tailored exactly to a garage door service business. Covers the complete operational loop: customer management with equipment tracking, estimates with pipeline status, job lifecycle from creation through dispatch and completion, invoicing with AR aging, and a product/service catalog with inventory. Designed multi-tenant from day one so it can scale from a single operation to multiple locations and eventually be licensed to other garage door businesses.

## Core Value

A tech gets dispatched from the board, completes the job on their phone, and the customer has a paid invoice with a receipt in their inbox — without the owner touching anything twice.

## Requirements

### Validated

(None yet — ship to validate)

### Active

#### Module 1: Customer Management
- [ ] **CUST-01**: User can create a customer with name, account number, VIP flag, service agreement flag, active status, and parent account (for commercial hierarchies)
- [ ] **CUST-02**: Customer has multiple contacts, each with name, phone(s), email(s), SMS consent, billing/booking contact flags, birthday, anniversary, job title
- [ ] **CUST-03**: Customer has multiple service locations, each with name, address, gated property flag
- [ ] **CUST-04**: Each service location has equipment records: door specs (brand, size, material, style, **color, model/series** for panel reordering), opener (brand, model, HP, serial), springs (**wire size, inside diameter, length, wind direction left/right, cycle rating**), install and warranty dates per component
- [ ] **CUST-05**: Customer profile has a live Activity Feed on the right — chronological timeline of every job, estimate, invoice, payment, and email for that customer
- [ ] **CUST-06**: Customer record has internal/private notes, public/work order notes, customer tags, referral source, taxable flag, tax item, assigned agent/rep
- [ ] **CUST-07**: User can search customers by name, phone, email, or address from any job/estimate form (type-ahead search)
- [ ] **CUST-08**: User can merge duplicate customer records
- [ ] **CUST-09**: Customer list is filterable and searchable

#### Module 2: Estimates
- [ ] **EST-01**: Estimates are a separate module from jobs with their own dashboard, navigation, and status pipeline
- [ ] **EST-02**: Estimate status pipeline: Estimate Requested → Estimate Provided → Estimate Accepted → Estimate Won / Lost
- [ ] **EST-03**: Estimate form mirrors job form layout — two-panel (Project Specs left, Sales Data right) with: customer, contact, service location, category, description, PO#, on-site visit scheduling, assigned techs, notes for techs, opportunity rating (stars), referral source, tags, follow-up tasks
- [ ] **EST-04**: Estimate has line items with groups, catalog search (products and services), inline product/service creation, qty/hrs, rate, total, cost, margin, tax columns
- [ ] **EST-05**: Estimate can be converted to a job with one action (all fields, line items, and contact info carry over)
- [ ] **EST-06**: Estimate templates — user can save and reuse estimate structures for common job types
- [ ] **EST-07**: Estimates dashboard has left sidebar with status-folder navigation showing counts (My Estimates and All Estimates), tag-based filtering, and main list with columns: Requested On, Customer, Description, Value, Status, Rating
- [ ] **EST-08**: Task lists with presets on estimates; reminders with presets
- [ ] **EST-09**: User can email estimate to customer directly from estimate form

#### Module 3: Jobs
- [ ] **JOB-01**: Job form — two-panel layout (Details left, Job Info right): customer, contact, service location, job category (hierarchical, admin-configurable), description, PO#, job source, agent/rep, tags
- [ ] **JOB-02**: Job Info panel: status (full dropdown), start/end dates, arrival time window, estimated duration, multi-day job flag, job priority, assigned techs with notify-all checkbox, notes for techs, completion notes, requires follow-up flag
- [ ] **JOB-03**: Job status machine — Open Jobs: Unscheduled, Scheduled, Dispatched, Cancelled; In Progress: Delayed, On The Way, On Site, Started, Paused, Resumed, Partially Completed, Completed; Closed: Invoiced, Paid in Full, Job Closed
- [ ] **JOB-04**: Line items with three tabs: Products & Services | Drive & Labor Times | Expenses — all with description, qty/hrs, rate, total, cost, margin, tax columns. Line item types include Product, Service, and **Discount** (a separate negative line item, not a per-line % reduction — confirmed from SF export data).
- [ ] **JOB-05**: Billing type selector: Single Invoice / Progress Billing / No Charge
- [ ] **JOB-06**: Job totals panel: Products/Services/Taxes/Fees, Total Drive & Labor Time, Total Billable Expenses, Job Total, Payments/Deposits, Total Due, Job Cost, Gross Profit %
- [ ] **JOB-07**: Job templates — user can save and reuse job structures with pre-filled line items and task lists; heavily used
- [ ] **JOB-08**: Repeating jobs — user can schedule a job to recur on a defined schedule
- [ ] **JOB-09**: Additional site visits — each job can have multiple site visits, each with their own date and status
- [ ] **JOB-10**: Task lists with presets; reminders with presets; notes
- [ ] **JOB-11**: Top tabs on job: Summary, Custom Fields, Pics (photo attachments), Docs, Equipment (links to service location equipment), Sign (signature collection)
- [ ] **JOB-12**: Jobs dashboard — left sidebar with: Advanced Search, Jobs by Tag (custom tags with counts), My Jobs by status with counts, My Additional Visits, All Open Jobs, Completed & Ready to Close, To Be Invoiced; main list sortable by date/job#/city/customer/priority/category
- [ ] **JOB-13**: Custom tags — user creates tags and applies to jobs and estimates for filtering; tags are fully configurable in settings
- [ ] **JOB-14**: Job categories are hierarchical and admin-configurable (Commercial, Residential with sub-categories: New Door, New Door + Operator, New Operator, Service/Repair, etc.)

#### Module 4: Dispatch Board
- [ ] **DISP-01**: Week-view calendar grid — technicians as rows, days as columns, job blocks placed on grid
- [ ] **DISP-02**: Live job pool at bottom — auto-populated from job status, filterable tabs: Unscheduled / Unassigned / With Open POs / Partially Completed / Paused / Marked For Follow Up (with counts)
- [ ] **DISP-03**: Assign tech from job form via dropdown; jobs appear on calendar automatically
- [ ] **DISP-04**: Hover card on job block — shows customer, address, status badge
- [ ] **DISP-05**: Click-to-popup modal on any job — shows customer, contact, service location, map of address, current status, invoice link, scheduling details, assigned tech — with quick action buttons: Dispatch, View Details, Make Changes, Deposits, Close & Invoice, Cancel This Job, Email, Print
- [ ] **DISP-06**: "Close & Invoice" from dispatch popup — completes job and creates invoice in one click without navigating to the job page
- [ ] **DISP-07**: Map in dispatch popup — shows service location for routing decisions

#### Module 5: Technician Mobile View (PWA)
- [ ] **TECH-01**: Mobile-optimized PWA — works offline in poor signal areas; no App Store required
- [ ] **TECH-02**: Tech can see their assigned jobs for the day/week with customer info, address, arrival window, job description, notes from office
- [ ] **TECH-03**: Tech can update job status (On The Way, On Site, Started, Completed, Partially Completed)
- [ ] **TECH-04**: Tech can add photos to a job (before/after)
- [ ] **TECH-05**: Tech can collect customer signature on job completion
- [ ] **TECH-06**: Tech can add completion notes

#### Module 6: Invoicing & Payments
- [ ] **INV-01**: Invoice created from job; carries over all line items, customer, and contact details
- [ ] **INV-02**: Unpaid Invoices dashboard with AR aging sidebar: Grand Total Unpaid, Grand Total Past Due, 91+ days / 61-90 / 31-60 / 1-30 day buckets with color-coded totals (checked constantly for collections)
- [ ] **INV-03**: Invoice views: Unpaid, Paid, All Invoices tabs with search and pagination
- [ ] **INV-04**: Payment recorded directly from the invoice — no separate batch payment screen needed
- [ ] **INV-05**: Payment detail record — stores full transaction: card last 4, expiry, transaction token, auth #, billing address, amount applied to invoice(s), balance after
- [ ] **INV-06**: Stripe integration — online payment links sent in invoice email; payment webhook creates payment record and fires receipt email automatically
- [ ] **INV-07**: Square integration — for on-site card swipe by technician
- [ ] **INV-08**: Invoice PDF generation with option to include work order
- [ ] **INV-09**: Invoice email to customer with PDF attachment

#### Module 7: Product & Service Catalog
- [ ] **CAT-01**: Products have: category, name, model, SKU, UPC, part number, unit price, unit cost, type, active flag, inventory item flag, **sales description** (customer-facing, appears on invoices), **purchase description** (internal, for ordering), **primary/secondary/tertiary vendor with purchase price per vendor**
- [ ] **CAT-02**: Services have: category, name, unit price, unit cost, description, active flag
- [ ] **CAT-03**: Catalog management page — filterable by category, name, price range, cost range, inventory item flag; sortable; bulk export
- [ ] **CAT-04**: Inline product/service creation from job/estimate form — "Add Line Item" → "Create New Service" / "Create New Product" opens modal, saves to catalog and immediately adds as line item
- [ ] **CAT-05**: Product categories are admin-configurable (Garage Doors, Openers, Hardware, Springs, Operator Parts, etc.)
- [ ] **CAT-06**: Inventory tracking — quantity on hand per product, stock level management, inventory orders (purchase orders to replenish stock)

#### Module 8: Communications & Notifications
- [ ] **COMM-01**: Email via Resend from contact@infantinosgaragedoor.com with configurable automations
- [ ] **COMM-02**: Email settings panel (mirrors SF layout) — per-trigger toggles: job confirmation to customer, job notification to tech, invoice send, payment receipt
- [ ] **COMM-03**: Payment receipt auto-sent to customer when Stripe payment processes (webhook-triggered)
- [ ] **COMM-04**: Job confirmation auto-sent to customer when job is created
- [ ] **COMM-05**: Tech notification auto-sent when job is assigned or modified
- [ ] **COMM-06**: Invoice auto-sent to customer when created
- [ ] **COMM-07**: SMS via Twilio — triggered on job status change to "On The Way" (tech is en route), appointment reminders
- [ ] **COMM-08**: SMS and email settings configurable per trigger in settings panel
- [ ] **COMM-09**: PDF copies attached to all outbound emails; work orders optionally included with invoices

#### Module 9: Reports
- [ ] **RPT-01**: All Sales — total revenue by period (this week / this month / last month / this year / custom)
- [ ] **RPT-02**: Sales by Technician — revenue per tech by period
- [ ] **RPT-03**: Sales by Customer — top customers by spend
- [ ] **RPT-04**: Sales by Product/Service — which services and parts drive revenue
- [ ] **RPT-05**: Day Sheet — jobs scheduled per tech for today / tomorrow / next two weeks
- [ ] **RPT-06**: Unpaid Invoices report — outstanding balances by customer and aging
- [ ] **RPT-07**: Job Activity — open, completed, and created volume by period
- [ ] **RPT-08**: Sales Tax report — tax collected by period for filing
- [ ] **RPT-09**: All reports exportable (CSV/PDF)

#### Module 10: Settings & Administration
- [ ] **SET-01**: Job categories — add, edit, delete, reorder hierarchical categories (Commercial/Residential with sub-types)
- [ ] **SET-02**: Tags — create and manage custom tags for jobs and estimates
- [ ] **SET-03**: Job and estimate templates — create, edit, apply presets for task lists and line items
- [ ] **SET-04**: User management — add technicians and office staff; assign roles (admin, dispatcher, technician)
- [ ] **SET-05**: Email settings panel — configure all automation triggers
- [ ] **SET-06**: Referral sources, job sources — configurable lookup lists
- [ ] **SET-07**: Tax items — configurable tax rates

### Out of Scope

- **Customer portal (web/app login)** — eventually, not v1; customers can't log in to view their history yet
- **QuickBooks real-time sync** — CSV export only for MVP; full sync is a project of its own
- **Native mobile apps** — PWA covers tech mobile; no iOS/Android App Store builds
- **Fleet management** — not used
- **Vendor management** — not used
- **Service agreements / recurring contracts** — want eventually, not v1
- **Payroll / hours worked reports** — handled separately
- **Sales commission tracking** — not used
- **Batch edit jobs** — never used, skip MVP
- **Barcode scanning** — search by name is sufficient, skip MVP
- **Warehouse / multi-location inventory** — single location inventory for MVP

## Context

**Current system:** Service Fusion at $300/month. Replacing it to save $3,000+/year and own the workflow.

**Business:** Infantino's Garage Door Service, Chicago area. Currently 1-2 technicians (Marcos Infantino operating). Commercial and residential clients. Commercial clients often have multiple properties.

**Existing data:** Full Service Fusion history to migrate — all customers, job history, equipment records, catalog. Import is a critical requirement (not MVP blocker but must happen before full cutover).

**Scale path:** Single operation today → more technicians and locations → eventually a multi-tenant SaaS platform licensable to other garage door businesses. Multi-tenancy must be designed in from day one (Supabase RLS).

**Workflow familiarity:** Operator is deeply familiar with Service Fusion's layout and interaction patterns. Minimizing workflow change is a hard requirement — screens should feel nearly identical to SF in layout, terminology, and interaction flow. Every screen shown during discovery was captured as a design reference.

**SF export analysis (2026-06-10):** Three exports reviewed: Sales by Customer (61 jobs, $158k revenue), Customer List (~75 customers), Inventory (~150 products). Key findings:
- **Labor column $0 on all jobs** — labor is bundled into product/service pricing, not tracked separately. Drive & Labor Times tab is present in SF UI but unused in practice. Can be simplified in v1.
- **Discounts are a separate line item type** — not a % reduction per line. A "5% Discount" or flat "Discount" appears as its own negative-total line item.
- **Progress Billing is a multi-job invoicing pattern** — one large commercial project is split across multiple job records (each job = one billing milestone: deposit, 40%, remaining balance). Not a single-job partial-billing toggle.
- **Address-as-customer-name pattern** — some customers are named by address (e.g., "128 Asbury Ave") for rental properties where no personal name is on file. Migration must preserve this.
- **Products have two description fields** — a sales description (customer-facing, used on invoices) and a purchase description (internal, for ordering). Both are in SF and must carry over.
- **Vendor tracking** — products track up to 3 vendors with individual purchase prices per vendor.

**Key domain specifics:**
- Equipment is tracked per service location, not per customer (commercial clients have multiple properties each with different equipment)
- Spring specs (wire size, inside diameter, length, wind direction left/right, cycle rating) are critical — wrong specs = wrong parts ordered. Confirmed by owner 2026-06-10.
- Job tags are part-type based (Springs, Bottom Seal, Rollers, LHR, etc.) for filtering history by repair type
- Job status "On The Way" triggers the customer SMS notification
- "Close & Invoice" from the dispatch board is a primary daily action — must be one click

## Constraints

- **Tech Stack**: Next.js 15 (App Router), PostgreSQL via Supabase (RLS + Storage + Realtime), **Drizzle ORM** (Prisma bypasses RLS by default — Drizzle has first-class RLS support), Clerk native Supabase auth (JWT template deprecated April 2025), shadcn/ui + Tailwind CSS v4, **Serwist** (PWA service worker — next-pwa unmaintained), Vercel hosting
- **Integrations**: Resend (email), Stripe (online payments), Square (on-site card), Twilio (SMS)
- **Multi-tenancy**: Supabase Row Level Security from day one — every table scoped by tenant. Required for eventual SaaS path.
- **Mobile**: PWA for technician view — offline-capable, no App Store, photo upload from phone camera
- **Budget**: Hosting and services must stay $20–50/month (vs. $300/month Service Fusion)
- **Auth**: Clerk instead of NextAuth — multi-tenant org management built in; retrofitting NextAuth for SaaS would be painful
- **File storage**: Supabase Storage for job photos and document attachments
- **Real-time**: Supabase Realtime for dispatch board live updates (multiple users see changes instantly)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Clerk native Supabase auth over JWT template | JWT template deprecated April 1, 2025; native integration is required for RLS policies using org_id | — Pending |
| Drizzle over Prisma | Prisma connects as a privileged role that bypasses RLS by default — silent multi-tenant data leak. Drizzle has first-class RLS support and faster cold starts. | — Pending |
| Supabase over plain Postgres | RLS handles multi-tenancy cleanly, Storage for photos, Realtime for dispatch board — three problems solved by one platform | — Pending |
| PWA over native app | No App Store overhead, works offline, deployable same day as the web app | — Pending |
| Estimates as separate module | Estimates have their own pipeline (Requested→Won/Lost), own dashboard, own templates — not just a job status | — Pending |
| Equipment scoped to service location | Commercial clients have multiple properties; equipment belongs to the property not the customer | — Pending |
| Inline product creation from job form | Reduces context switching — tech or office staff adds a new part to catalog without leaving the job | — Pending |
| Inventory management as dedicated phase | Catalog (prices/costs) ships first in MVP; full stock tracking and purchase orders follow as a separate phase | — Pending |
| Drive & Labor Times tab is v2 | SF export shows $0 labor on all 61 reviewed jobs — labor is bundled into pricing, not tracked separately. Tab can be placeholder in v1. | — Pending |
| Progress Billing is a billing pattern, not a toggle | Confirmed from SF export: large jobs split into multiple job records (deposit job, 40% job, balance job), each with their own invoice. No single-job partial-billing workflow needed for v1. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-10 after SF data export analysis — catalog, customer list, and sales history reviewed*
