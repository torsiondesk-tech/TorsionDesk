---
status: testing
phase: 03-jobs-core-and-status-fsm
source: [03-VERIFICATION.md]
started: 2026-06-14T12:40:00Z
updated: 2026-06-14T12:40:00Z
---

## Current Test

number: 1
name: Create job at /jobs/new
expected: |
  Form renders with Details panel (left) and Job Info panel (right). After saving, redirects to /jobs/[id]. Header shows #JOB-{N}. Status badge shows "Unscheduled".
awaiting: user response

## Tests

### 1. Create job at /jobs/new
expected: Form renders with Details panel (left) and Job Info panel (right). After saving, redirects to /jobs/[id]. Header shows #JOB-{N}. Status badge shows "Unscheduled".
result: [pending]

### 2. Add line items and verify live totals
expected: Products = $100.00, Services = $100.00, Job Total = $190.00, Total Due = $190.00. Gross Profit % updates.
result: [pending]

### 3. Status FSM dropdown
expected: Only legal next states appear grouped under Open/In Progress/Closed. Illegal states are absent.
result: [pending]

### 4. Upload a photo
expected: Photo appears in grid. No console errors. Network tab shows upload to Supabase Storage.
result: [pending]

### 5. Apply a template
expected: Line items table pre-fills with the template's lines.
result: [pending]

### 6. Add a site visit
expected: Site visit appears with its own status badge, independent of parent job status.
result: [pending]

### 7. Task checklist
expected: Task appears with unchecked box; clicking checkmark toggles to done.
result: [pending]

### 8. Customer New Job deep-link
expected: /jobs/new opens with Customer, Contact, and Location pre-selected.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

(none)
