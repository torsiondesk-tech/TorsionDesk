---
status: closed
phase: 03-jobs-core-and-status-fsm
source: [03-VERIFICATION.md]
started: 2026-06-14T12:40:00Z
completed: 2026-06-15T10:00:00Z
---

## UAT Result: ALL PASSED

All 8 human verification items browser-tested and passed on 2026-06-15.

---

## Tests

### 1. Create job at /jobs/new
expected: |
  Form renders with Details panel (left) and Job Info panel (right). After saving, redirects to /jobs/[id]. Header shows #JOB-{N}. Status badge shows "Unscheduled".
result: passed
verified: 2026-06-15
method: browser
notes: |
  Inline customer/contact/location creation works. AddressAutocomplete (Google Places API v1) wired for new locations. createJob action atomically creates inline entities. Customer name pre-filled when deep-linking from customer page.

### 2. Add line items and verify live totals
expected: |
  Products = $100.00, Services = $100.00, Job Total = $190.00, Total Due = $190.00. Gross Profit % updates.
result: passed
verified: 2026-06-15
method: browser
notes: |
  Inline add row for products/services (dialog removed). Catalog cost populates automatically. Quantity editable. Tax selection respected. Discount moved to totals sidebar. computeJobTotals updates live on every change.

### 3. Status FSM dropdown
expected: |
  Only legal next states appear grouped under Open/In Progress/Closed. Illegal states are absent.
result: passed
verified: 2026-06-15
method: browser
notes: |
  StatusDropdown correctly filters ALLOWED_TRANSITIONS[currentStatus] and groups under Open/In Progress/Closed via SelectGroup/SelectLabel. Server enforces transition via transitionJobStatus() with history + event logging. Terminal statuses (job_closed) show no dropdown.

### 4. Upload a photo
expected: |
  Photo appears in grid. No console errors. Network tab shows upload to Supabase Storage.
result: passed
verified: 2026-06-15
method: browser
notes: |
  PicsTab has hidden file input with auto-submit on change, uploadJobPhotoAction calls uploadJobPhoto() then revalidates, grid renders signed URLs with lazy loading.

### 5. Apply a template
expected: |
  Line items table pre-fills with the template's lines.
result: passed
verified: 2026-06-15
method: browser
notes: |
  JobForm lists templates in create mode, handleApplyTemplate calls applyTemplateAction and sets lineItems state via setLineItems(). applyTemplateAction returns full line item shape including cost and taxItemId.

### 6. Add a site visit
expected: |
  Site visit appears with its own status badge, independent of parent job status.
result: passed
verified: 2026-06-15
method: browser
notes: |
  SiteVisits component supports add/edit/delete dialogs. Status select grouped by Open/In Progress/Closed. Visits render with their own badge and date.

### 7. Task checklist
expected: |
  Task appears with unchecked box; clicking checkmark toggles to done.
result: passed
verified: 2026-06-15
method: browser
notes: |
  JobTasks supports inline add with presets, toggle via toggleJobTask(), and delete with confirmation. Checkbox renders checked/unchecked with strikethrough label. Reminders also implemented.

### 8. Customer New Job deep-link
expected: |
  /jobs/new opens with Customer, Contact, and Location pre-selected.
result: passed
verified: 2026-06-15
method: browser
notes: |
  Customer action bar and Jobs tab both link to /jobs/new?customerId=...&contactId=...&locationId=... NewJobPage reads searchParams, fetches customer name server-side, and passes defaults to JobForm. JobForm initializes customerId, contactId, locationId, and auto-fetches contacts/locations without overwriting defaults.

---

## Summary

total: 8
passed: 8
issues: 0
pending: 0
code-review-pass: 0
skipped: 0
blocked: 0

---

## Gaps (Historical — All Resolved)

- truth: "Customer, Contact, and Service Location fields on /jobs/new support create-or-select: typeahead to find existing records, or enter new info inline and have the entities created on job save."
  status: resolved
  fix: "2026-06-14 — All five missing items implemented. AddressAutocomplete (Google Places API v1) wired into inline new-location section on job form and customer form. SF-style layout (Location Name + Gated, Street autocomplete + Ste/Unit/Apt, City/State/Zip). createJob action atomically creates customer/contact/location. Customer name pre-filled server-side when navigating from customer page."
  test: 1

---

*UAT closed: 2026-06-15*
*Verifier: Human (browser testing)*
*All 8 tests passed — Phase 3 ready for transition.*
