# GarageOS — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-10)

**Core value:** A tech gets dispatched from the board, completes the job on their phone, and the customer has a paid invoice with a receipt in their inbox — without the owner touching anything twice.
**Current focus:** Phase 0 — Foundation: Tenancy, Auth, and Data Spine

## Current Phase

**Phase 0: Foundation — Tenancy, Auth, and Data Spine**
- Status: Not started
- Started: —
- Plan: Not created yet
- Goal: A team member can create a workspace, log in with a role, and is provably confined to their own tenant's data by RLS.
- Requirements: AUTH-01–06, TENANT-01, TENANT-02 (8 requirements)

## Progress

```
Phase 0  [          ] Not started  ← current
Phase 1  [          ] Not started
Phase 2  [          ] Not started
Phase 3  [          ] Not started
Phase 4  [          ] Not started  (parallel with 5)
Phase 5  [          ] Not started  (parallel with 4)
Phase 6  [          ] Not started
Phase 7  [          ] Not started
Phase 8  [          ] Not started
Phase 9  [          ] Not started
Phase 10 [          ] Not started
```

0 / 11 phases complete · 0 / 97 requirements delivered

## Completed Phases

(none)

## Key Decisions Made

(see .planning/PROJECT.md Key Decisions section)

Decisions to lock during Phase 0 (flagged by research):
- ORM final call: Drizzle vs Prisma + app-layer tenancy — decide before any table is created.
- Clerk native Supabase third-party auth wiring (JWT template deprecated April 1, 2025); RLS policies key on org_id, not auth.uid().
- PgBouncer / connection config for RLS-scoped roles.
- Cross-tenant CI test added as a permanent guard against RLS regressions.

## Blockers

(none)

## Session Continuity

**Last action:** Roadmap created (11 phases, 97 requirements, 100% coverage) — 2026-06-10.
**Next action:** `/gsd-plan-phase 0` to decompose Phase 0 into executable plans.
**Watch items:**
- Two owner-confirmation data questions resolved in REQUIREMENTS.md (spring specs + door color/model captured in CUST-04) — no longer open.
- Phase 0, Phase 5 (PWA), and Phase 7 (Invoicing) are flagged for deeper research before planning.
- Phases 4 and 5 are parallelizable once Phase 3 is complete.

---
*State initialized: 2026-06-10*
