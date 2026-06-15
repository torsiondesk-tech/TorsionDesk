# SECURITY.md — Phase 02: Catalog and Settings

**Audit date:** 2026-06-14
**ASVS Level:** 2
**Phase waves audited:** 02-02, 02-03, 02-04, 02-05, 02-06
**Result:** SECURED — 22/22 threats closed

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-02-01 | Information Disclosure | accept (test-only) | CLOSED | Auto-closed per constraint: test-wave assertion, no runtime guard in scope |
| T-02-SC | Tampering | accept | CLOSED | Auto-closed per constraint: no new packages installed; pnpm-only policy unchanged |
| T-02-02 | Info Disclosure / Tampering | mitigate | CLOSED | `schema.ts:441-448` (product_categories), `453-476` (job_categories), `481-500` (tax_items), `505-524` (job_sources), `529-556` (services), `561-601` (products) — all 6 tables have `pgPolicy(...tenant_isolation...).enableRLS()`; migration `0003_sturdy_masque.sql:11,22,33,61,76,87` confirms `ENABLE ROW LEVEL SECURITY` applied to every table |
| T-02-03 | Tampering | mitigate | CLOSED | `schema.ts:545-548` (services → product_categories composite FK), `589-592` (products → product_categories composite FK); migration `0003_sturdy_masque.sql:89-90` confirms composite `(tenant_id, category_id)` FK references `product_categories(tenant_id, id)` |
| T-02-04 | Tampering | mitigate | CLOSED | `drizzle/0003_sturdy_masque.sql` — full file reviewed; contains only 6 `CREATE TABLE` + `ENABLE ROW LEVEL SECURITY` + FK + policy statements. No `ALTER TABLE ... tags` present anywhere in the migration file |
| T-02-05 | Info Disclosure / Tampering | mitigate | CLOSED | `lib/catalog.ts:49-57` (`getProductById`): `withTenant` + `eq(products.tenantId, orgId)`; `lib/catalog.ts:82-135` (`listProducts`): `conditions` array seeds `eq(products.tenantId, orgId)` at line 83; `lib/catalog.ts:216-228` (`updateProduct`): `eq(products.tenantId, orgId)` in WHERE; `lib/catalog.ts:230-240` (`deleteProduct`): same pattern. All product read/write paths scoped to tenant. |
| T-02-06 | Tampering | mitigate | CLOSED | `lib/catalog.ts:94-98`: search term `%${opts.q}%` passed as Drizzle parameterized binding `sql\`... ILIKE ${term}\`` — `term` is a bound parameter, not concatenated SQL. Price filters use `gte(products.unitPrice, opts.minPrice)` / `lte(...)` — Drizzle column predicates, never string-concatenated |
| T-02-07 | Tampering | mitigate | CLOSED | `catalog/actions.ts:186-202` (`createProduct`): explicit tenant-scoped category guard with `eq(productCategories.tenantId, orgId)` + `eq(productCategories.id, data.categoryId)` before insert; `catalog/actions.ts:254-270` (`updateProduct`): same guard on update; `catalog/actions.ts:333-349` (`createService`): guard present; `catalog/actions.ts:387-403` (`updateService`): guard present. Guard covers all 4 write entry points. |
| T-02-08 | Tampering | mitigate | CLOSED | `catalog/actions.ts:467-475`: `esc()` helper applies `/^[=+\-@]/.test(s) ? "'" + s : s` before RFC-4180 quoting. Applied via `.map(esc)` on every field for both product (line 488-494) and service (line 499-504) exports |
| T-02-09 | Elevation of Privilege | mitigate | CLOSED | `catalog/actions.ts:152-154` (`createProduct`): `const { orgId } = await auth()` with early return on no-org; same pattern in `updateProduct:219-221`, `deleteProduct:287-290`, `createService:310-312`, `updateService:366-368`, `deleteService:420-422`, `exportCatalogCsv:462-463`, `createCatalogItemAction:452-455`. Every write and export action re-checks `orgId` via `auth()` |
| T-02-10 | Info Disclosure / Tampering | mitigate | CLOSED | `lib/catalog.ts:62-70` (`getServiceById`): `withTenant` + `eq(services.tenantId, orgId)`; `lib/catalog.ts:145-186` (`listServices`): seeds `eq(services.tenantId, orgId)` at line 146; `lib/catalog.ts:255-266` (`updateService`): WHERE includes `eq(services.tenantId, orgId)`; `lib/catalog.ts:269-279` (`deleteService`): same. All service paths tenant-scoped. |
| T-02-11 | Tampering | mitigate | CLOSED | `lib/catalog.ts:283-346` (`createCatalogItem`): tenant-scoped category verification at lines 296-308 — `eq(productCategories.tenantId, orgId)` + `eq(productCategories.id, input.categoryId)` before any insert. Comment `// Cross-tenant category guard (T-02-11)` at line 295. This is the lib-level guard shared by the modal RPC path and any future callers. |
| T-02-12 | Tampering | mitigate | CLOSED | `catalog/actions.ts:496-504`: services CSV export also calls `.map(esc)` on every field, reusing the same `esc()` function verified for T-02-08 |
| T-02-13 | Elevation of Privilege | mitigate | CLOSED | `catalog/actions.ts:452-455` (`createCatalogItemAction`): `const { orgId } = await auth()` + early throw on no-org. This is the modal RPC action entry point. |
| T-02-14 | Info Disclosure / Tampering | mitigate | CLOSED | `lib/categories.ts:17-53` (`listJobCategories`): `eq(jobCategories.tenantId, orgId)` in WHERE; `lib/categories.ts:106-143` (`updateJobCategory`): `and(eq(jobCategories.tenantId, orgId), eq(jobCategories.id, id))`; `lib/categories.ts:165-175` (`listProductCategories`): `eq(productCategories.tenantId, orgId)`; all category helpers use `withTenant` + explicit tenant eq guard |
| T-02-15 | Tampering | mitigate | CLOSED | `lib/categories.ts:62-77` (`createJobCategory`): parentId cross-tenant guard — verifies `eq(jobCategories.tenantId, orgId)` + `eq(jobCategories.id, parentId)` before insert, throws `'Invalid parent category: cross-tenant access denied'` on mismatch; `lib/categories.ts:115-129` (`updateJobCategory`): same guard on update |
| T-02-16 | Elevation of Privilege | mitigate | CLOSED | `middleware.ts:29,47-49`: `isSettings` matches `/settings(.*)`, and `auth.protect({ role: 'org:admin' })` is called server-side for every settings request. This is enforced before any route handler executes. |
| T-02-17 | Tampering | mitigate | CLOSED | `settings/job-categories/actions.ts:18-25`: `z.string().trim().min(1, 'Name is required').max(255)` on `name`; Drizzle parameterized bindings in all `lib/categories.ts` queries — no string concatenation into SQL |
| T-02-18 | Info Disclosure / Tampering | mitigate | CLOSED | `lib/settings.ts:22-43` (`createTag`): `withTenant` + `eq(tags.tenantId, orgId)` in all queries; `lib/settings.ts:119-132` (`createTaxItem`): `withTenant` + `eq(taxItems.tenantId, orgId)`; `lib/settings.ts:170-191` (`createJobSource`): `withTenant` + `eq(jobSources.tenantId, orgId)`. All settings helpers are inside `withTenant` with explicit tenant eq guard. |
| T-02-19 | Tampering | mitigate | CLOSED | Tax rate: `settings/tax-items/actions.ts:18-31` — `z.string().refine(n >= 0 && n <= 100, ...)` blocks values outside 0–100. Tag color: `settings/tags/actions.ts:22-37` — `z.enum(PRESET_COLORS, ...)` with 7 hardcoded hex values; any value outside the enum is rejected at the action layer before reaching the DB |
| T-02-20 | Tampering | mitigate | CLOSED | `settings/tags/tag-row.tsx:301-310`: delete dialog renders `deleting.usageCount > 0` branch showing "used on N record(s)" warning before the destructive button is accessible. `settings/tags/actions.ts:112-114`: `deleteTagAction` also re-reads `usageCount` via `getTagUsageCount(orgId, id)` at delete time (defensive re-check). UI confirms cascade impact before delete is executed. |
| T-02-21 | Elevation of Privilege | mitigate | CLOSED | Same as T-02-16 — `middleware.ts:47-49` enforces `org:admin` role for all `/settings(.*)` routes server-side. Tags, tax items, and lookup lists all live under `/settings/`. |
| T-02-22 | Tampering | mitigate | CLOSED | `settings/lookup-lists/actions.ts:21-23`: `lookupSchema` applies `z.string().trim().min(1).max(255)` to lookup names; Drizzle parameterized bindings in `lib/settings.ts` throughout — no SQL string concatenation |

---

## Accepted Risks Log

| Threat ID | Accepted Risk Description | Rationale |
|-----------|--------------------------|-----------|
| T-02-01 | Cross-tenant isolation verified only in test wave, not by a dedicated runtime guard in this wave | Disposition was `accept` at plan time; test-wave assertions provide the coverage; RLS is the runtime guard |
| T-02-SC | No supply-chain scan for new packages | No new packages installed in Phase 02; pnpm-only policy and lockfile unchanged |

---

## Unregistered Threat Flags

None. All threat flags declared in the SUMMARY.md files (`T-02-08`, `T-02-07`, `T-02-11`) map directly to registered threat IDs in the register.

---

## Notes

- The cross-tenant category guard for products/services is present at **two** layers: the action layer (`catalog/actions.ts`) for all four form-submission paths (create/update product, create/update service), and the lib layer (`lib/catalog.ts:createCatalogItem`) for the modal RPC path. Both layers independently verify the category belongs to the calling tenant.
- The `tags.color` field is protected at the action layer by `z.enum(PRESET_COLORS)` — no free hex string can reach the database from any exposed Server Action. The database column itself remains `text`, which is an accepted design choice (T-02-19 is fully mitigated at the action boundary).
- The `deleteTagAction` action in `settings/tags/actions.ts` does not block deletion when usageCount > 0 — it deletes unconditionally after reading the count. This matches the declared mitigation (warn via UI confirm dialog, cascade is intentional per schema FK `onDelete: 'cascade'` on `customer_tags`). No gap exists relative to the declared disposition.
