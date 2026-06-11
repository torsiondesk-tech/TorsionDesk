---
phase: 0
reviewers: [claude-internal]
reviewed_at: "2026-06-10T00:00:00.000Z"
plans_reviewed:
  - 00-01-PLAN.md
  - 00-02-PLAN.md
  - 00-03-PLAN.md
  - 00-04-PLAN.md
  - 00-05-PLAN.md
note: >
  No external AI CLI reviewers were detected on this system (only `claude` is installed,
  which is skipped for independence). This is a self-review by the current Claude Code session
  acting as a critical second pass. It lacks the adversarial-model diversity the workflow
  intends — install Gemini CLI (`gemini`) and re-run `/gsd review 0` for a true cross-AI review.
---

# Phase 0 Plan Review — Internal Self-Review

> **Reviewer:** Claude Code (self-review, no external CLI available)
> **Plans reviewed:** 00-01 through 00-05
> **Context read:** PROJECT.md, RESEARCH.md, CONTEXT.md, VALIDATION.md, SKELETON.md, REQUIREMENTS.md

---

## Summary

The five Phase 0 plans are architecturally sound and notably thorough. The wave ordering (test scaffold → core spine → shell → settings → integration gate) is correct. The Nyquist TDD approach — writing failing tests in Wave 0 before any implementation exists — is the right discipline for a multi-tenant RLS foundation that would otherwise be impossible to validate retroactively. The threat models are detailed and specific. Dependency wiring is explicit and correct.

There is **one HIGH-severity bug** in the plan that will cause a runtime failure and needs to be fixed before execution: the `tenants.id` column type and the RLS policy cast. There are two MEDIUM-severity operational gaps around connection string management. Everything else is LOW or informational.

---

## Strengths

- **TDD discipline is enforced structurally.** Plan 01 must complete (five RED tests) before Plan 02 writes any implementation. This is not just a convention — it's encoded in the wave/depends_on chain. Future phases inherit this guard.
- **Threat model coverage is exceptional.** Threats T-00-01 through T-00-12 cover all meaningful attack surfaces: cross-tenant IDOR, GUC injection, forged webhook, service-role key leakage, PgBouncer prepared-statement misconfig, false-pass test environment. Each threat is tied to a concrete mitigation with a plan and task reference.
- **Correct tenancy mechanism selected.** The `SET LOCAL app.current_tenant_id` / `current_setting()` approach (D-18) is the right fit for Drizzle over direct Postgres. The alternative (passing raw Clerk JWT to PostgREST) would have required a fundamentally different Drizzle setup and introduced complexity without benefit.
- **Blocking checkpoints are appropriately gated.** Plan 02 Task 1 (Clerk + Supabase dashboard config) and Plan 05 Task 1 (TEST project + non-service-role credential) are human-verify checkpoints that correctly block autonomous execution. These cannot be automated and the plan doesn't try.
- **Clerk JWT v2 claim shape is documented and enforced.** The `o.id` / `o.rol` naming is called out in the research as the single highest-risk detail. All plan references use `o.id` consistently for the tenant key.
- **Package legitimacy audit is included.** The SUS verdict on vitest is documented and explained. This is the kind of rigor that prevents supply-chain issues from slipping in.
- **Connection string split is mentioned.** Plans note `:5432` (direct) for migrations and `:6543` (pooler, `prepare:false`) for runtime. This split is the correct pattern for Supabase + Drizzle.

---

## Concerns

### HIGH

**H-01 — `tenants.id` is typed as `uuid` but Clerk org IDs are NOT UUIDs**

Plan 02 artifact: `id (uuid, primary key — equals the Clerk org id o.id)`. The RLS policy: `id = current_setting('app.current_tenant_id', true)::uuid`.

Clerk org IDs look like `org_2NNzmNhHMsNbejVb1234` — they are opaque prefixed strings, not UUIDs. PostgreSQL will throw `ERROR: invalid input syntax for type uuid: "org_2NNzmNhHMsNbejVb1234"` the moment any request tries to set the GUC and evaluate the RLS policy.

**Fix required before execution:**
- Change `tenants.id` from `uuid` to `text` in `src/db/schema.ts`
- Change the RLS policy `using`/`withCheck` clauses from `...::uuid` to `...::text` (or just remove the cast — text comparison works natively)
- Update `src/db/with-tenant.ts` accordingly (the `set_config` value is already text, no change needed there)
- Update `tests/rls-cross-tenant.test.ts` to use real Clerk-style org id strings (`org_aaaa...`) instead of UUIDs in test fixtures

This is a silent failure mode: the scaffold builds fine (`pnpm build` passes), unit tests pass (they mock the DB), but the first real webhook or tenant GUC will crash PostgreSQL with a type error. It won't surface until Plan 05.

---

### MEDIUM

**M-01 — Missing `DIRECT_URL` / migration connection string is ambiguous**

Plan 02 creates `drizzle.config.ts` pointing at `DATABASE_URL`. Plan 04 Task 3 says to use the direct connection (`:5432`) for `drizzle-kit push`. But if `DATABASE_URL` in `.env.local` is the transaction pooler URL (`:6543`, which is what the Supabase dashboard gives you by default), the push will use the wrong port.

There is no explicit `DIRECT_URL` env var defined in `.env.local.example`.

**Fix:** Add `DIRECT_URL=` to `.env.local.example` with a comment saying it must be the direct connection (`:5432`, not the pooler). Update `drizzle.config.ts` to read from `DIRECT_URL` (or at minimum, Plan 04 Task 3 must document overriding with the direct string before running push).

---

**M-02 — `TEST_DATABASE_URL` skip-guard ambiguity between Wave 0 and Plan 05**

Plan 01 Task 2 says: "Guard the integration test with a skip-if-unset check on `TEST_DATABASE_URL` so it does not crash CI when the env var is absent, but it MUST run (not skip) once Wave 1 provides the modules and the env var is set."

Plan 05 Task 2 says: "Finalize `tests/rls-cross-tenant.test.ts` so it runs (not skips) against the real test project."

These two plans are in conflict: the Wave 0 version has a skip guard; Plan 05 wants it to run unconditionally. The intent is clear but the execution is ambiguous:

- If Plan 05 removes the skip guard, `pnpm vitest run` on a machine without `TEST_DATABASE_URL` will fail (not skip) — breaking local development without a test DB.
- If Plan 05 keeps the guard, `pnpm test` in CI without the env var gives a false green (skips the keystone test silently).

**Fix:** Plan 05 should explicitly state: keep the skip guard for local use, but add the test to a CI configuration that always sets `TEST_DATABASE_URL` — AND add a CI validation step that asserts the test did NOT skip (e.g., check vitest output for "skipped" and fail the CI run). Alternatively, use vitest's `skipIf` with a warning log so skips are visible.

---

**M-03 — `src/lib/profile.ts` / `src/app/onboarding/actions.ts` need `'use server'` directive**

Plan 02 and Plan 03 both refer to `saveProfile` and the onboarding action as "server actions" but neither explicitly says to add the `'use server'` directive. In Next.js 15 App Router, a function is only a server action if the file or function has `'use server'` at the top. Without it, the function is a regular module export — calling it from a client form will fail at runtime with a serialization error.

**Fix:** Both `src/lib/profile.ts` and `src/app/onboarding/actions.ts` must have `'use server'` at the top of the file (or on each exported async function). This is implied but should be explicit in the plan tasks.

---

### LOW

**L-01 — Sidebar must be a client component; the plan is implicit about this**

Plan 03 Task 3: "Create `src/components/shell/sidebar.tsx`… a dark sidebar [rendering nav items]." The sidebar must be a client component (`'use client'`) to handle active-route highlighting (which requires `usePathname()`). The plan says the layout passes the visible module set to the sidebar as props — this is the correct pattern — but doesn't explicitly say the sidebar uses `'use client'`. If it's accidentally written as a server component, `usePathname()` will throw.

**L-02 — Null `orgRole` during new-user sign-up flow**

Per RESEARCH Pitfall 6: the `o` claim (and thus `orgRole`) is only present when an org is active. During the sign-up flow, before the org is created or activated, `auth().orgRole` will be null/undefined.

Plan 03 Task 1 checks `orgRole === 'org:technician'` — if `orgRole` is null, this check passes (no redirect), but the user also has no active tenant. They'll proceed to the `/onboarding` route (which is intentionally unprotected), which is correct. The edge case is actually handled by the design (onboarding doesn't require a tenant GUC). This is documented as LOW because the behavior is correct even if the reasoning is implicit.

**L-03 — `pnpm create next-app@latest .` in an existing repo**

Plan 02 Task 2 runs `pnpm create next-app@latest .` in the project root, which already has `.planning/`, `CLAUDE.md`, and possibly a `package.json`. The `create-next-app` command will conflict on existing files. The plan should add a pre-step: run `create-next-app` in a temp directory, then copy/merge into the project root (preserving the existing `.planning/` structure). Or it should note that `create-next-app` will prompt before overwriting and the executor should accept merges.

**L-04 — Settings tab stubs: Phase N placeholders need real numbers**

Plan 04 Task 1: "every other tab renders an 'Available in Phase N' stub (greyed, with the phase noted)." The `N` is a placeholder — the plan doesn't specify which phase each stub becomes functional. Users will see this in the UI. Before execution, the executor should fill in the actual phase numbers from the ROADMAP:
- Job Categories → Phase 2
- Tags → Phase 2
- Templates → Phase 3/7
- Email → Phase 8
- SMS → Phase 8
- Payment Methods → Phase 7
- Tax Items → Phase 2
- Lookup Lists → Phase 2

**L-05 — No `DIRECT_URL` in `.env.test.example`**

Plan 01 creates `.env.test.example` documenting `TEST_DATABASE_URL`. Plan 05 requires the schema to be pushed to the TEST project first (separately from prod). But `drizzle.config.ts` points at `DATABASE_URL` (prod). There should be a documented process for pushing to the test project — either a `TEST_DATABASE_URL_DIRECT` variable or a separate drizzle config for test. This is an operational gap.

---

## Suggestions

1. **Fix H-01 now** — change `tenants.id` to `text` in the Plan 02 artifact and update the RLS policy casting before execution. This is a must-fix before running any plan.

2. **Add `DIRECT_URL` to `.env.local.example` and `drizzle.config.ts`** — the Drizzle docs for Supabase explicitly recommend this split. Add it to Plan 02 Task 2's env var documentation.

3. **Clarify the skip-guard in Plan 05** — explicitly state that the cross-tenant test skip guard is retained for local use, and that CI must set `TEST_DATABASE_URL` and assert the test did not skip.

4. **Add explicit `'use server'` to plan tasks** — Plan 02 Task 3 and Plan 03 Task 2 should explicitly call out the directive requirement for `profile.ts` and `onboarding/actions.ts`.

5. **Install Gemini CLI for adversarial review** — this self-review catches code-level issues well but may miss higher-level design blind spots. Run `gemini` CLI review once installed: the gap between what the reviewer knows (this architecture) and what Gemini knows independently is the value of cross-AI review.

---

## Risk Assessment

**Overall: MEDIUM**

The plans are high quality and the architecture is sound. The single HIGH-severity issue (UUID vs text for `tenants.id`) is a silent runtime failure that won't show up in `pnpm build` or unit tests — it will only surface at first real webhook call. This alone elevates the risk from LOW to MEDIUM, but it's a straightforward fix.

Everything else is implementation hygiene (server action directives, connection string management) that can be caught during execution. The TDD wave structure means failures surface early and the cross-tenant RLS test in Plan 05 is a strong correctness proof that would catch any remaining tenant isolation gaps.

**Blocker before execution: Fix H-01 (tenants.id must be text, not uuid).**

---

## Consensus Summary

N/A — single reviewer.

### Agreed Strengths (would be shared by multiple reviewers)
- Wave-ordered TDD: test scaffold before implementation is the correct discipline for RLS
- Threat models are specific and actionable, not boilerplate
- Clerk JWT v2 claim shape (`o.id`) is explicitly documented and consistently applied
- Blocking human-verify checkpoints are correctly identified and non-bypassable
- Fail-closed RLS (unset GUC = 0 rows) is a first-class success criterion, not an afterthought

### Top Concerns to Address Before Execution
1. **[MUST FIX]** `tenants.id` type: use `text`, not `uuid` (Plan 02) — Clerk org IDs are not UUIDs
2. **[SHOULD FIX]** Add `DIRECT_URL` env var for drizzle-kit migrations (Plans 02, 04)
3. **[SHOULD FIX]** Clarify cross-tenant test skip-guard behavior for CI vs local (Plans 01, 05)

### Next Step
Run `/gsd-execute-phase 0` after fixing H-01 in Plan 02. Or fix in-place with `/gsd-plan-phase 0 --patch` if that workflow is available.

---

*To get adversarial multi-model coverage: `npm install -g @google/gemini-cli` then re-run `/gsd review 0 --gemini`*
