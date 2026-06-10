---
phase: 0
slug: foundation-tenancy-auth-and-data-spine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | none — Wave 0 creates `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run <file>` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <touched-test-file>`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + cross-tenant RLS test must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 00-W0-01 | W0 | 0 | TENANT-01 | T-0-01 | Cross-tenant read returns 0 rows; unset GUC returns 0 rows (fail-closed) | integration | `pnpm vitest run tests/rls-cross-tenant.test.ts` | ❌ W0 | ⬜ pending |
| 00-W0-02 | W0 | 0 | TENANT-01 | T-0-02 | `withTenant` sets GUC inside transaction only | unit | `pnpm vitest run tests/with-tenant.test.ts` | ❌ W0 | ⬜ pending |
| 00-W0-03 | W0 | 0 | AUTH-06 | — | Role → visible-modules map returns correct set per role | unit | `pnpm vitest run tests/roles.test.ts` | ❌ W0 | ⬜ pending |
| 00-W0-04 | W0 | 0 | AUTH-01 | T-0-03 | `organization.created` webhook inserts `tenants` row idempotently | unit | `pnpm vitest run tests/webhook.test.ts` | ❌ W0 | ⬜ pending |
| 00-W0-05 | W0 | 0 | TENANT-02 | — | Business profile save/read round-trips under correct tenant | integration | `pnpm vitest run tests/profile.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework config (none exists; Wave 0 installs vitest and creates config)
- [ ] `tests/rls-cross-tenant.test.ts` — TENANT-01 cross-tenant isolation guard (success criterion #4)
- [ ] `tests/with-tenant.test.ts` — TENANT-01 `withTenant` unit test
- [ ] `tests/roles.test.ts` — AUTH-06 role-to-modules map
- [ ] `tests/webhook.test.ts` — AUTH-01/D-02 org provisioning unit test
- [ ] `tests/profile.test.ts` — TENANT-02 profile round-trip
- [ ] Supabase test project + `TEST_DATABASE_URL` env var (non-service-role connection for RLS tests)
- [ ] `pnpm add -D vitest` — install test runner

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Technician web login redirects to `/mobile-coming-soon` (no sidebar) | AUTH-06, D-14 | Route redirect requires real Clerk session; awkward to unit-test without full browser | 1. Create a test user with `org:technician` role. 2. Log in via `/sign-in`. 3. Confirm redirect to `/mobile-coming-soon`. 4. Confirm no sidebar rendered. |
| Non-admin blocked from `/settings` | AUTH-06, D-15 | Middleware role gate; requires real Clerk session + org role set | 1. Log in as Dispatcher role. 2. Navigate to `/settings`. 3. Confirm 403 or redirect. |
| Onboarding flow: signup → org creation → `/onboarding` → dashboard | AUTH-01, D-03, D-05 | Multi-step Clerk UI flow; E2E browser required | 1. Sign up fresh. 2. Verify org created in Clerk Dashboard. 3. Verify redirect to `/onboarding`. 4. Fill name + phone. 5. Confirm redirect to `/dashboard`. |
| Session persists across browser refresh | AUTH-04 | Browser state; Clerk-managed | 1. Log in. 2. Reload tab. 3. Confirm still authenticated. |
| Password reset via email link | AUTH-05 | Requires live email delivery | 1. Click "Forgot password" on `/sign-in`. 2. Check inbox for reset email. 3. Follow link and set new password. 4. Confirm login with new password. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
