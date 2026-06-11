# Requirements: TorsionDesk — FSM CRM for Infantino's Garage Door Service

**Defined:** 2026-06-10
**Core Value:** A tech gets dispatched from the board, completes the job on their phone, and the customer has a paid invoice with a receipt in their inbox — without the owner touching anything twice.

## v1 Requirements

### Authentication & Roles

- [ ] **AUTH-01**: Admin user can create a workspace (tenant organization) via Clerk during initial setup
- [ ] **AUTH-02**: Admin can invite team members by email and assign roles (Admin, Dispatcher, Technician)
- [ ] **AUTH-03**: User can log in with email and password via Clerk
- [ ] **AUTH-04**: User session persists across browser refresh and tab close
- [ ] **AUTH-05**: User can reset password via email link
- [ ] **AUTH-06**: Role-based access — Admin sees all modules; Dispatcher sees dispatch, jobs, customers; Technician sees assigned jobs and customer info only

### Multi-Tenancy

- [ ] **TENANT-01**: All data is scoped to the tenant via Supabase Row Level Security — no cross-tenant data access is possible
- [ ] **TENANT-02**: Tenant has a configurable business profile: company name, address, phone, email, logo (used on invoices and email headers)

### Customer Management

- [ ] **CUST-01**: User can create a customer with name, account number, VIP flag, active status, and parent account (for commercial hierarchies)
- [ ] **CUST-02**: Customer has multiple contacts, each with name, phone(s), email(s), SMS consent flag, billing/booking contact flags, birthday, anniversary, job title
- [ ] **CUST-03**: Customer has multiple service locations, each with name, full address, gated property flag
- [ ] **CUST-04**: Each service location has equipment records: door specs (brand, size, material, style, color, model/series for panel reordering), opener (brand, model, HP, serial), springs (wire size, inside diameter, length, wind direction left/right, cycle rating), install and warranty dates per component
- [ ] **CUST-05**: Customer profile has a live Activity Feed — chronological timeline of every job, estimate, invoice, payment, and email sent for that customer
- [ ] **CUST-06**: Customer record has internal/private notes, public/work order notes, customer tags, referral source, taxable flag, tax item, assigned agent/rep
- [ ] **CUST-07**: User can search customers by name, phone, email, or address from any job/estimate form (type-ahead search returning name + primary address)
- [ ] **CUST-08**: User can merge duplicate customer records (one canonical record retained, other archived)
- [ ] **CUST-09**: Customer list page is filterable by active status, tags, and service location city; free-text searchable by name, phone, or email

### Estimates

- [ ] **EST-01**: Estimates are a separate module from jobs with their own navigation, dashboard, and status pipeline
- [ ] **EST-02**: Estimate status pipeline: Requested → Provided → Accepted → Won / Lost — transitions are server-enforced (not a free-edit dropdown)
- [ ] **EST-03**: Estimate form has two-panel layout (Project Specs left, Sales Data right): customer, contact, service location, category, description, PO#, on-site visit scheduling, assigned techs, notes for techs, opportunity rating (1–5 stars), referral source, tags, follow-up tasks
- [ ] **EST-04**: Estimate has line items supporting Product, Service, and Discount types; fields: description, qty/hrs, rate, total, cost, margin, tax flag; line items can be grouped
- [ ] **EST-05**: Estimate can be converted to a job with one action — all fields, line items, and contact info carry over to the new job record
- [ ] **EST-06**: User can save and apply estimate templates (presets for common job types with pre-filled line items and task lists)
- [ ] **EST-07**: Estimates dashboard has left sidebar with status-folder navigation showing counts (My Estimates / All Estimates), tag-based filtering; main list with columns: Requested On, Customer, Description, Value, Status, Rating
- [ ] **EST-08**: Estimates have task lists with configurable presets and reminders with configurable presets
- [ ] **EST-09**: User can email estimate to customer as a PDF directly from the estimate form

### Jobs

- [ ] **JOB-01**: Job form has two-panel layout (Details left, Job Info right): customer, contact, service location, job category (hierarchical), description, PO#, job source, agent/rep, tags
- [ ] **JOB-02**: Job Info panel includes: status, start/end dates, arrival time window, estimated duration, multi-day job flag, job priority, assigned techs with notify-all checkbox, notes for techs, completion notes, requires follow-up flag
- [ ] **JOB-03**: Job status is server-enforced with a valid transition table — transitions trigger side effects (SMS on "On The Way"; invoice created on "Close & Invoice"); valid groups: Open (Unscheduled, Scheduled, Dispatched, Cancelled), In Progress (Delayed, On The Way, On Site, Started, Paused, Resumed, Partially Completed, Completed), Closed (Invoiced, Paid in Full, Job Closed)
- [ ] **JOB-04**: Job has line items with three tabs: Products & Services | Drive & Labor Times (placeholder in v1) | Expenses; line item types: Product, Service, Discount (negative); fields: description, qty/hrs, rate, total, cost, margin, tax flag
- [ ] **JOB-05**: Billing type selector on job: Single Invoice / Progress Billing / No Charge
- [ ] **JOB-06**: Job totals panel shows: Products total, Services total, Taxes & Fees, Drive & Labor total, Billable Expenses total, Job Total, Payments/Deposits, Total Due, Job Cost, Gross Profit %
- [ ] **JOB-07**: User can save and apply job templates (presets with pre-filled line items and task lists); templates are heavily used for common repair types
- [ ] **JOB-08**: Repeating jobs — user can configure a job to automatically recur on a defined schedule (weekly, monthly, custom)
- [ ] **JOB-09**: Each job can have multiple additional site visits, each with their own date and status independent of the parent job
- [ ] **JOB-10**: Jobs have task lists with configurable presets; reminders with configurable presets; internal notes
- [ ] **JOB-11**: Job detail has top tabs: Summary | Custom Fields | Pics (photo attachments, upload from device) | Docs (file attachments) | Equipment (linked service location equipment records) | Sign (digital signature collection)
- [ ] **JOB-12**: Jobs dashboard has left sidebar: Advanced Search, Jobs by Tag with counts, My Jobs by status, My Additional Visits, All Open Jobs, Completed & Ready to Close, To Be Invoiced; main list sortable by date/job#/city/customer/priority/category
- [ ] **JOB-13**: Custom tags are user-defined and apply to both jobs and estimates; tags appear in sidebar with per-tag counts for quick filtering
- [ ] **JOB-14**: Job categories are hierarchical (e.g., Commercial → New Door + Operator) and admin-configurable in Settings

### Dispatch Board

- [ ] **DISP-01**: Week-view calendar grid — technicians as rows, days as columns, job blocks positioned by scheduled date/time
- [ ] **DISP-02**: Live job pool below calendar — auto-populated from job status; filterable tabs: Unscheduled / Unassigned / With Open POs / Partially Completed / Paused / Marked For Follow Up with live counts
- [ ] **DISP-03**: Jobs appear on the calendar automatically when a tech is assigned (from job form dropdown or drag-and-drop from pool)
- [ ] **DISP-04**: Job block hover card — shows customer name, service address, status badge
- [ ] **DISP-05**: Click-to-popup modal on any job block — displays customer, contact, service location, map of address, current status, invoice link, scheduling details, assigned tech; quick-action buttons: Dispatch, View Details, Make Changes, Deposits, Close & Invoice, Cancel, Email, Print
- [ ] **DISP-06**: "Close & Invoice" from dispatch popup — transitions job to Invoiced and creates invoice in one click without navigating away from the board
- [ ] **DISP-07**: Dispatch board updates in real-time for all open sessions via Supabase Realtime Broadcast (tech assignment and status changes visible instantly)

### Technician Mobile View (PWA)

- [ ] **TECH-01**: Technician mobile app is a PWA — installable on iPhone/Android home screen, works offline in poor signal areas, no App Store required
- [ ] **TECH-02**: Tech sees assigned jobs for today and the next 7 days with: customer name, address, arrival window, job description, notes from office
- [ ] **TECH-03**: Tech can update job status from the allowed set (On The Way, On Site, Started, Completed, Partially Completed, Paused) — "On The Way" triggers customer SMS automatically
- [ ] **TECH-04**: Tech can add before/after photos from phone camera; photos sync to Supabase Storage when connection is restored
- [ ] **TECH-05**: Tech can collect customer signature on job completion (touchscreen drawing); signature stored as image attached to the job
- [ ] **TECH-06**: Tech can add completion notes to a job from the mobile view
- [ ] **TECH-07**: Tech can view equipment records and spring specs for the service location from the job detail screen (to quote or order parts on site)
- [ ] **TECH-08**: Offline mutations (status updates, notes, photos queued) are stored in IndexedDB and auto-synced when connectivity is restored; unsynced items are visually flagged to the tech

### Invoicing & Payments

- [ ] **INV-01**: Invoice is created from a job and carries over all line items, customer, and contact details; invoice number auto-increments per tenant
- [ ] **INV-02**: Invoicing dashboard has AR aging sidebar: Grand Total Unpaid, Grand Total Past Due, aging buckets (1–30 / 31–60 / 61–90 / 91+ days) with color-coded totals
- [ ] **INV-03**: Invoice list has three views: Unpaid | Paid | All Invoices — each with search, sort, and pagination
- [ ] **INV-04**: Payments are recorded via a dedicated "Receive a Payment" page, scoped to a customer; the page lists all open invoices for that customer with an "Amount To Apply" field per invoice row; user enters: Payment Method, Check/Reference#, Received By, Received On date, Payment Memo, and total Amount; a running totals panel shows Total Outstanding, Amount Of Payment, Total To Be Applied, and Owed After Payment; submitting posts payment allocations for all selected invoices to the canonical payment ledger; accessible from the invoice action bar or from the customer record
- [ ] **INV-05**: Payment record stores: Method (from admin-configured list — see SET-08), Check/Reference#, Received By, Received On date, Payment Memo, Amount, and per-invoice allocation amounts; card-specific fields (last 4, expiry, transaction token, authorization #, billing address) stored only for Credit Card (Stripe) and On-Site Card (Square) methods; all payments record an audit entry of entered-at timestamp and entered-by user
- [ ] **INV-06**: Stripe integration — payment link in invoice email; Stripe webhook creates payment record and fires receipt email automatically; webhook is idempotent (deduplication by event.id)
- [ ] **INV-07**: Square integration — tech can process on-site card payment via Square Mobile Payments SDK from their phone; payment syncs to the canonical payment ledger
- [ ] **INV-08**: Invoice PDF generation with toggle to include work order (line items, completion notes, signature); PDF downloadable and email-attachable
- [ ] **INV-09**: Invoice can be emailed to customer with PDF attachment directly from the invoice view
- [ ] **INV-10**: "Invoice" button appears on the job detail action bar when job status is Completed; clicking it creates an invoice carrying all line items, customer, and contact details, and transitions the job to Invoiced — same outcome as "Close & Invoice" from the dispatch popup but initiated from the job detail page
- [ ] **INV-11**: After invoice creation, the job's Current Status row displays the linked invoice number and creation date as a clickable link to the invoice page; the invoice page sidebar shows: Invoice#, Invoice Date, Payment Terms, Sent By, Sent On, and Email Opened
- [ ] **INV-12**: Invoice email delivery is tracked via Resend webhooks; invoice sidebar shows Sent By, Sent On, and Email Opened (date/time); a "(log)" link opens a modal with the full timestamped email event log (send and open events); tracking applies to both manually sent and auto-triggered invoice emails
- [ ] **INV-13**: Deposits can be recorded against a job before an invoice exists; deposit entry requires: amount, payment method, Check/Reference#, Received By, Received On date, and memo; deposits are accessible as a quick action from the dispatch popup and from the job detail action bar; recorded deposits appear as DEPOSITS (−) on the resulting invoice and reduce TOTAL DUE
- [ ] **INV-14**: Every payment (manual or webhook-created) is a first-class record with a unique payment number and its own view page; the view page shows: payment#, From Customer, Transaction Details, an audit line ("Entered [datetime] by [user]"), and an invoice allocation table with clickable links to Invoice#, Customer, and Job# (Description column auto-populates as "For Job(s): [job#]"); an Edit Payment button allows post-submission corrections

### Catalog

- [ ] **CAT-01**: Products have: category, name, model, SKU, UPC, part number, unit price, unit cost, type, active flag, inventory item flag, sales description (customer-facing, appears on invoices), purchase description (internal, for ordering), primary/secondary/tertiary vendor each with a purchase price
- [ ] **CAT-02**: Services have: category, name, unit price, unit cost, description, active flag
- [ ] **CAT-03**: Catalog management page — filterable by category, name, price range, inventory item flag; sortable by name/price/cost; bulk CSV export
- [ ] **CAT-04**: Inline product/service creation from job/estimate line item add flow — "Create New Product" or "Create New Service" opens a modal, saves to catalog, and immediately adds as a line item
- [ ] **CAT-05**: Product categories are admin-configurable (Garage Doors, Openers, Hardware, Extension Springs, Torsion Springs, Operator Parts, Window Inserts, Misc., etc.)

### Communications & Notifications

- [ ] **COMM-01**: All outbound email sent via Resend from contact@infantinosgaragedoor.com with configurable business name in sender header
- [ ] **COMM-02**: Email settings panel — per-trigger enable/disable toggles: job confirmation, job notification to tech, estimate email, invoice email, payment receipt
- [ ] **COMM-03**: Payment receipt is automatically emailed to customer when Stripe webhook confirms payment (not manually sent)
- [ ] **COMM-04**: Job confirmation email is sent to customer when a job is created (if trigger is enabled)
- [ ] **COMM-05**: Tech notification email is sent when a job is assigned or modified (if trigger is enabled)
- [ ] **COMM-06**: Invoice email is sent to customer when an invoice is created (if trigger is enabled)
- [ ] **COMM-07**: SMS via Twilio — "On The Way" status transition triggers SMS to customer; appointment reminder SMS configurable per job
- [ ] **COMM-08**: SMS triggers are configurable per-type in the settings panel; phone number is A2P 10DLC registered
- [ ] **COMM-09**: PDF attachments included in all outbound job/estimate/invoice emails; work order PDF optionally included with invoice emails

### Reports

- [ ] **RPT-01**: All Sales — total revenue by period (this week / this month / last month / this year / custom range); breakdowns by Products, Services, Labor, Taxes
- [ ] **RPT-02**: Sales by Technician — revenue per tech by period, sortable
- [ ] **RPT-03**: Sales by Customer — top customers by spend, filterable by period
- [ ] **RPT-04**: Sales by Product/Service — catalog items ranked by revenue, filterable by category and period
- [ ] **RPT-05**: Day Sheet — jobs per tech for today, tomorrow, and next 14 days; printable
- [ ] **RPT-06**: Unpaid Invoices — outstanding balances by customer with aging; mirrors AR aging sidebar in the invoicing dashboard
- [ ] **RPT-07**: Job Activity — volume of jobs opened, completed, and created by period; status breakdowns
- [ ] **RPT-08**: Sales Tax — tax collected by period grouped by tax item; for filing
- [ ] **RPT-09**: All reports exportable as CSV and PDF

### Settings & Administration

- [ ] **SET-01**: Job categories — hierarchical structure (Commercial / Residential top level; sub-types: New Door, New Door + Operator, New Operator, Service/Repair, Springs, etc.); admin can add, edit, delete, reorder
- [ ] **SET-02**: Tags — admin can create, edit, and delete custom tags; tags apply to both jobs and estimates; appear in sidebar navigation with counts
- [ ] **SET-03**: Job and estimate templates — admin can create, edit, and delete templates with pre-filled line items and task lists; applied at job/estimate creation
- [ ] **SET-04**: User management — admin can add users by email, assign roles (Admin, Dispatcher, Technician), deactivate users
- [ ] **SET-05**: Email automation settings — per-trigger enable/disable toggles for all outbound email types; editable email body templates
- [ ] **SET-06**: Lookup lists — admin can add, edit, and remove referral sources, job sources, and other configurable dropdown values
- [ ] **SET-07**: Tax items — admin can create and configure tax rates (name, percentage); tax items are assigned per customer (taxable flag) and overridable per line item
- [ ] **SET-08**: Payment Methods settings panel — admin can add, rename, reorder, and deactivate custom payment methods (e.g., Cash, Check, Zelle, Venmo, ACH, Wire); system-linked methods (Credit Card/Stripe, On-Site Card/Square) are displayed but locked from edit/delete; active methods populate the Method dropdown on the Receive a Payment page and on deposit entry forms

### Data Migration

- [ ] **MIGR-01**: Admin can import customer list from CSV (mapped from Service Fusion export: name, account number, contacts, service locations)
- [ ] **MIGR-02**: Admin can import product/service catalog from CSV (mapped from Service Fusion export: category, name, model, SKU, prices, descriptions)
- [ ] **MIGR-03**: Admin can import job history from CSV for reference and reporting (read-only historical records; not editable as live jobs)

## v2 Requirements

### Catalog

- **CAT-06**: Inventory tracking — quantity on hand per product, low-stock alerts, stock adjustments, purchase order creation to replenish from vendors

### Jobs

- **JOB-V2-01**: Drive & Labor Times tab (full implementation) — time tracking per technician per job with drive time, on-site time, and billable hours calculation. Currently $0 in all SF jobs; v1 tab is a placeholder.
- **JOB-V2-02**: Recurring invoices — schedule an invoice to auto-generate and send on a defined recurring schedule

### Customer

- **CUST-V2-01**: Customer portal — customers can log in to a separate URL to view service history, open invoices, and pay online without calling the office

### Communications

- **COMM-V2-01**: Two-way SMS inbox — tech and customer can exchange messages through the system rather than via personal phones

## Out of Scope

| Feature | Reason |
|---------|--------|
| QuickBooks real-time sync | High integration complexity; CSV export is sufficient for accounting handoff in v1 |
| Native iOS/Android apps | PWA covers technician mobile needs; no App Store overhead required |
| Fleet management | Not applicable to current operations |
| Vendor management module | Vendor fields on product records are sufficient; dedicated purchasing workflow not needed in v1 |
| Service agreements / recurring contracts | JOB-08 repeating jobs covers the scheduling need; full contract lifecycle is a later SaaS feature |
| Payroll / hours worked reports | Handled outside the system; Drive & Labor tab is v2 |
| Sales commission tracking | Not used |
| Batch edit jobs | Never used in Service Fusion |
| Barcode scanning | Text search is sufficient for catalog lookup |
| Warehouse / multi-location inventory | Single-location catalog in v1; multi-warehouse is a future SaaS feature |
| Inventory stock levels report | Deferred with inventory tracking to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 0 | Pending |
| AUTH-02 | Phase 0 | Pending |
| AUTH-03 | Phase 0 | Pending |
| AUTH-04 | Phase 0 | Pending |
| AUTH-05 | Phase 0 | Pending |
| AUTH-06 | Phase 0 | Pending |
| TENANT-01 | Phase 0 | Pending |
| TENANT-02 | Phase 0 | Pending |
| CUST-01 | Phase 1 | Pending |
| CUST-02 | Phase 1 | Pending |
| CUST-03 | Phase 1 | Pending |
| CUST-04 | Phase 1 | Pending |
| CUST-05 | Phase 1 | Pending |
| CUST-06 | Phase 1 | Pending |
| CUST-07 | Phase 1 | Pending |
| CUST-08 | Phase 1 | Pending |
| CUST-09 | Phase 1 | Pending |
| CAT-01 | Phase 2 | Pending |
| CAT-02 | Phase 2 | Pending |
| CAT-03 | Phase 2 | Pending |
| CAT-04 | Phase 2 | Pending |
| CAT-05 | Phase 2 | Pending |
| SET-01 | Phase 2 | Pending |
| SET-02 | Phase 2 | Pending |
| SET-03 | Phase 2 | Pending |
| SET-04 | Phase 2 | Pending |
| SET-05 | Phase 2 | Pending |
| SET-06 | Phase 2 | Pending |
| SET-07 | Phase 2 | Pending |
| SET-08 | Phase 2 | Pending |
| JOB-01 | Phase 3 | Pending |
| JOB-02 | Phase 3 | Pending |
| JOB-03 | Phase 3 | Pending |
| JOB-04 | Phase 3 | Pending |
| JOB-05 | Phase 3 | Pending |
| JOB-06 | Phase 3 | Pending |
| JOB-07 | Phase 3 | Pending |
| JOB-08 | Phase 3 | Pending |
| JOB-09 | Phase 3 | Pending |
| JOB-10 | Phase 3 | Pending |
| JOB-11 | Phase 3 | Pending |
| JOB-12 | Phase 3 | Pending |
| JOB-13 | Phase 3 | Pending |
| JOB-14 | Phase 3 | Pending |
| DISP-01 | Phase 4 | Pending |
| DISP-02 | Phase 4 | Pending |
| DISP-03 | Phase 4 | Pending |
| DISP-04 | Phase 4 | Pending |
| DISP-05 | Phase 4 | Pending |
| DISP-06 | Phase 4 | Pending |
| DISP-07 | Phase 4 | Pending |
| TECH-01 | Phase 5 | Pending |
| TECH-02 | Phase 5 | Pending |
| TECH-03 | Phase 5 | Pending |
| TECH-04 | Phase 5 | Pending |
| TECH-05 | Phase 5 | Pending |
| TECH-06 | Phase 5 | Pending |
| TECH-07 | Phase 5 | Pending |
| TECH-08 | Phase 5 | Pending |
| EST-01 | Phase 6 | Pending |
| EST-02 | Phase 6 | Pending |
| EST-03 | Phase 6 | Pending |
| EST-04 | Phase 6 | Pending |
| EST-05 | Phase 6 | Pending |
| EST-06 | Phase 6 | Pending |
| EST-07 | Phase 6 | Pending |
| EST-08 | Phase 6 | Pending |
| EST-09 | Phase 6 | Pending |
| INV-01 | Phase 7 | Pending |
| INV-02 | Phase 7 | Pending |
| INV-03 | Phase 7 | Pending |
| INV-04 | Phase 7 | Pending |
| INV-05 | Phase 7 | Pending |
| INV-06 | Phase 7 | Pending |
| INV-07 | Phase 7 | Pending |
| INV-08 | Phase 7 | Pending |
| INV-09 | Phase 7 | Pending |
| INV-10 | Phase 7 | Pending |
| INV-11 | Phase 7 | Pending |
| INV-12 | Phase 7 | Pending |
| INV-13 | Phase 7 | Pending |
| INV-14 | Phase 7 | Pending |
| COMM-01 | Phase 8 | Pending |
| COMM-02 | Phase 8 | Pending |
| COMM-03 | Phase 8 | Pending |
| COMM-04 | Phase 8 | Pending |
| COMM-05 | Phase 8 | Pending |
| COMM-06 | Phase 8 | Pending |
| COMM-07 | Phase 8 | Pending |
| COMM-08 | Phase 8 | Pending |
| COMM-09 | Phase 8 | Pending |
| RPT-01 | Phase 9 | Pending |
| RPT-02 | Phase 9 | Pending |
| RPT-03 | Phase 9 | Pending |
| RPT-04 | Phase 9 | Pending |
| RPT-05 | Phase 9 | Pending |
| RPT-06 | Phase 9 | Pending |
| RPT-07 | Phase 9 | Pending |
| RPT-08 | Phase 9 | Pending |
| RPT-09 | Phase 9 | Pending |
| MIGR-01 | Phase 10 | Pending |
| MIGR-02 | Phase 10 | Pending |
| MIGR-03 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 103 total
- Mapped to phases: 103
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-10*
*Last updated: 2026-06-10 — added INV-10 through INV-14 (invoice button, job↔invoice linking, email tracking, deposits, payment view page), revised INV-04/INV-05 (Receive a Payment page, payment method fields), added SET-08 (configurable payment methods); 103 requirements total*
