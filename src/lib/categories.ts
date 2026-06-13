import { eq, and, sql } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import { jobCategories, productCategories } from '@/db/schema'

// ── Job Categories (hierarchical) ────────────────────────────────────────────

export type JobCategoryRow = {
  id: string
  name: string
  parentId: string | null
  depth: number
}

export async function listJobCategories(
  orgId: string,
): Promise<JobCategoryRow[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: jobCategories.id,
        name: jobCategories.name,
        parentId: jobCategories.parentId,
      })
      .from(jobCategories)
      .where(eq(jobCategories.tenantId, orgId))
      .orderBy(jobCategories.name)

    // Build parent->children map and compute depth for visual indent
    const byParent = new Map<string | null, typeof rows>()
    for (const row of rows) {
      const key = row.parentId ?? null
      const list = byParent.get(key) ?? []
      list.push(row)
      byParent.set(key, list)
    }

    const result: JobCategoryRow[] = []
    const walk = (parentId: string | null, depth: number) => {
      const children = byParent.get(parentId) ?? []
      for (const child of children) {
        result.push({
          id: child.id,
          name: child.name,
          parentId: child.parentId ?? null,
          depth,
        })
        walk(child.id, depth + 1)
      }
    }
    walk(null, 0)
    return result
  })
}

export async function createJobCategory(
  orgId: string,
  input: { name: string; parentId?: string | null },
): Promise<{ id: string }> {
  return withTenant(orgId, async (tx) => {
    const { name, parentId } = input

    // Verify parentId belongs to this tenant (cross-tenant guard)
    if (parentId) {
      const parentCheck = await tx
        .select({ id: jobCategories.id })
        .from(jobCategories)
        .where(
          and(
            eq(jobCategories.tenantId, orgId),
            eq(jobCategories.id, parentId),
          ),
        )
        .limit(1)
      if (parentCheck.length === 0) {
        throw new Error('Invalid parent category: cross-tenant access denied')
      }
    }

    const inserted = await tx
      .insert(jobCategories)
      .values({
        tenantId: orgId,
        name,
        parentId: parentId ?? null,
      })
      .onConflictDoNothing({
        target: [jobCategories.tenantId, jobCategories.name],
      })
      .returning({ id: jobCategories.id })

    if (inserted.length > 0) return inserted[0]

    // Duplicate — fetch existing.
    const rows = await tx
      .select({ id: jobCategories.id })
      .from(jobCategories)
      .where(
        and(
          eq(jobCategories.tenantId, orgId),
          eq(jobCategories.name, name),
        ),
      )
      .limit(1)

    return rows[0] ?? { id: '' }
  })
}

export async function updateJobCategory(
  orgId: string,
  id: string,
  input: { name: string; parentId?: string | null },
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    const { name, parentId } = input

    // Verify parentId belongs to this tenant (cross-tenant guard)
    if (parentId) {
      const parentCheck = await tx
        .select({ id: jobCategories.id })
        .from(jobCategories)
        .where(
          and(
            eq(jobCategories.tenantId, orgId),
            eq(jobCategories.id, parentId),
          ),
        )
        .limit(1)
      if (parentCheck.length === 0) {
        throw new Error('Invalid parent category: cross-tenant access denied')
      }
    }

    await tx
      .update(jobCategories)
      .set({
        name,
        parentId: parentId ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobCategories.tenantId, orgId),
          eq(jobCategories.id, id),
        ),
      )
  })
}

export async function deleteJobCategory(
  orgId: string,
  id: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(jobCategories)
      .where(
        and(
          eq(jobCategories.tenantId, orgId),
          eq(jobCategories.id, id),
        ),
      )
  })
}

// ── Product Categories (flat) ──────────────────────────────────────────────

export async function listProductCategories(
  orgId: string,
): Promise<Array<{ id: string; name: string }>> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: productCategories.id, name: productCategories.name })
      .from(productCategories)
      .where(eq(productCategories.tenantId, orgId))
      .orderBy(productCategories.name)
  })
}

export async function createProductCategory(
  orgId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return withTenant(orgId, async (tx) => {
    const inserted = await tx
      .insert(productCategories)
      .values({ tenantId: orgId, name })
      .onConflictDoNothing({
        target: [productCategories.tenantId, productCategories.name],
      })
      .returning({ id: productCategories.id, name: productCategories.name })

    if (inserted.length > 0) return inserted[0]

    // Duplicate — fetch existing.
    const rows = await tx
      .select({ id: productCategories.id, name: productCategories.name })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.tenantId, orgId),
          eq(productCategories.name, name),
        ),
      )
      .limit(1)

    return rows[0] ?? { id: '', name }
  })
}

export async function updateProductCategory(
  orgId: string,
  id: string,
  name: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(productCategories)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(productCategories.tenantId, orgId),
          eq(productCategories.id, id),
        ),
      )
  })
}

export async function deleteProductCategory(
  orgId: string,
  id: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(productCategories)
      .where(
        and(
          eq(productCategories.tenantId, orgId),
          eq(productCategories.id, id),
        ),
      )
  })
}
