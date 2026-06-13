import { eq, and, count, sql } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  tags,
  customerTags,
  taxItems,
  jobSources,
  referralSources,
} from '@/db/schema'
import {
  createReferralSource as _createReferralSource,
  listReferralSources as _listReferralSources,
} from '@/lib/tags'

// ── Tags (SET-02) ────────────────────────────────────────────────────────────

export async function createTag(
  orgId: string,
  input: { name: string; color: string },
): Promise<{ id: string; name: string; color: string }> {
  const { name, color } = input
  return withTenant(orgId, async (tx) => {
    // Check for duplicate first — avoids Drizzle onConflictDoNothing+returning bug
    const existing = await tx
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tags)
      .where(and(eq(tags.tenantId, orgId), eq(tags.name, name)))
      .limit(1)

    if (existing.length > 0) {
      return { id: existing[0].id, name: existing[0].name, color: existing[0].color ?? '' }
    }

    const inserted = await tx
      .insert(tags)
      .values({ tenantId: orgId, name, color })
      .returning({ id: tags.id, name: tags.name, color: tags.color })

    return inserted[0]
      ? { id: inserted[0].id, name: inserted[0].name, color: inserted[0].color ?? '' }
      : { id: '', name: '', color: '' }
  })
}

export async function updateTag(
  orgId: string,
  id: string,
  input: { name: string; color: string },
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(tags)
      .set({ name: input.name, color: input.color, updatedAt: new Date() })
      .where(and(eq(tags.tenantId, orgId), eq(tags.id, id)))
  })
}

export async function deleteTag(orgId: string, id: string): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(tags)
      .where(and(eq(tags.tenantId, orgId), eq(tags.id, id)))
  })
}

export async function getTagUsageCount(
  orgId: string,
  id: string,
): Promise<number> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({ count: count(customerTags.id) })
      .from(customerTags)
      .where(and(eq(customerTags.tenantId, orgId), eq(customerTags.tagId, id)))
    return rows[0]?.count ?? 0
  })
}

export type TagWithUsage = {
  id: string
  name: string
  color: string
  usageCount: number
}

export async function listTagsWithUsage(
  orgId: string,
): Promise<TagWithUsage[]> {
  return withTenant(orgId, async (tx) => {
    // Aggregate usage counts per tag
    const usageRows = await tx
      .select({ tagId: customerTags.tagId, count: count(customerTags.id) })
      .from(customerTags)
      .where(eq(customerTags.tenantId, orgId))
      .groupBy(customerTags.tagId)

    const usageMap = new Map<string, number>()
    for (const row of usageRows) {
      if (row.tagId) usageMap.set(row.tagId, row.count)
    }

    const tagRows = await tx
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tags)
      .where(eq(tags.tenantId, orgId))
      .orderBy(tags.name)

    return tagRows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color ?? '',
      usageCount: usageMap.get(t.id) ?? 0,
    }))
  })
}

// ── Tax Items (SET-07) ───────────────────────────────────────────────────────

export async function createTaxItem(
  orgId: string,
  input: { name: string; rate: string },
): Promise<{ id: string; name: string; rate: string }> {
  const { name, rate } = input
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .insert(taxItems)
      .values({ tenantId: orgId, name, rate })
      .returning({ id: taxItems.id, name: taxItems.name, rate: taxItems.rate })
    const row = rows[0]
    return row ? { id: row.id, name: row.name, rate: row.rate ?? '0' } : { id: '', name: '', rate: '0' }
  })
}

export async function listTaxItems(
  orgId: string,
): Promise<Array<{ id: string; name: string; rate: string }>> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({ id: taxItems.id, name: taxItems.name, rate: taxItems.rate })
      .from(taxItems)
      .where(eq(taxItems.tenantId, orgId))
      .orderBy(taxItems.name)
    return rows.map((r) => ({ id: r.id, name: r.name, rate: r.rate ?? '0' }))
  })
}

export async function updateTaxItem(
  orgId: string,
  id: string,
  input: { name: string; rate: string },
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(taxItems)
      .set({ name: input.name, rate: input.rate, updatedAt: new Date() })
      .where(and(eq(taxItems.tenantId, orgId), eq(taxItems.id, id)))
  })
}

export async function deleteTaxItem(orgId: string, id: string): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(taxItems)
      .where(and(eq(taxItems.tenantId, orgId), eq(taxItems.id, id)))
  })
}

// ── Job Sources (SET-06) ───────────────────────────────────────────────────

export async function createJobSource(
  orgId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return withTenant(orgId, async (tx) => {
    // Check for duplicate first — avoids Drizzle onConflictDoNothing+returning bug
    const existing = await tx
      .select({ id: jobSources.id, name: jobSources.name })
      .from(jobSources)
      .where(and(eq(jobSources.tenantId, orgId), eq(jobSources.name, name)))
      .limit(1)

    if (existing.length > 0) return existing[0]

    const inserted = await tx
      .insert(jobSources)
      .values({ tenantId: orgId, name })
      .returning({ id: jobSources.id, name: jobSources.name })

    return inserted[0] ?? { id: '', name: '' }
  })
}

export async function listJobSources(
  orgId: string,
): Promise<Array<{ id: string; name: string }>> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: jobSources.id, name: jobSources.name })
      .from(jobSources)
      .where(eq(jobSources.tenantId, orgId))
      .orderBy(jobSources.name)
  })
}

export async function updateJobSource(
  orgId: string,
  id: string,
  name: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(jobSources)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(jobSources.tenantId, orgId), eq(jobSources.id, id)))
  })
}

export async function deleteJobSource(
  orgId: string,
  id: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(jobSources)
      .where(and(eq(jobSources.tenantId, orgId), eq(jobSources.id, id)))
  })
}

// ── Referral Sources (SET-06) ────────────────────────────────────────────────
// Re-export the existing helpers from lib/tags.ts so tests and pages import
// from a single settings module.

export const createReferralSource = _createReferralSource
export const listReferralSources = _listReferralSources

export async function updateReferralSource(
  orgId: string,
  id: string,
  name: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(referralSources)
      .set({ name })
      .where(and(eq(referralSources.tenantId, orgId), eq(referralSources.id, id)))
  })
}

export async function deleteReferralSource(
  orgId: string,
  id: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(referralSources)
      .where(and(eq(referralSources.tenantId, orgId), eq(referralSources.id, id)))
  })
}
