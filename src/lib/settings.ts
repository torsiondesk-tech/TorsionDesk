import { eq, and, count, sql } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  tags,
  customerTags,
  taxItems,
  jobSources,
  referralSources,
  statusColors,
  estimateStatusColors,
  salesReps,
} from '@/db/schema'
import type { JobStatusValue } from '@/lib/jobs/transitions'
import type { EstimateStatusValue } from '@/lib/estimates/status'
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

// ── Status Colors (per-tenant dispatch card customization) ───────────────────

/** Distinct default palette for each of the 15 job statuses. */
const DEFAULT_STATUS_COLORS: Record<
  JobStatusValue,
  { bgColor: string; textColor: string; borderColor: string }
> = {
  unscheduled:           { bgColor: '#e2e8f0', textColor: '#334155', borderColor: '#cbd5e1' },
  scheduled:               { bgColor: '#fde68a', textColor: '#78350f', borderColor: '#fcd34d' },
  dispatched:              { bgColor: '#bfdbfe', textColor: '#1e3a8a', borderColor: '#93c5fd' },
  delayed:                 { bgColor: '#fed7aa', textColor: '#7c2d12', borderColor: '#fdba74' },
  on_the_way:              { bgColor: '#c7d2fe', textColor: '#312e81', borderColor: '#a5b4fc' },
  on_site:                 { bgColor: '#bbf7d0', textColor: '#14532d', borderColor: '#86efac' },
  started:                 { bgColor: '#fbcfe8', textColor: '#831843', borderColor: '#f9a8d4' },
  paused:                  { bgColor: '#e5e7eb', textColor: '#374151', borderColor: '#d1d5db' },
  resumed:                 { bgColor: '#bae6fd', textColor: '#0c4a6e', borderColor: '#7dd3fc' },
  partially_completed:     { bgColor: '#fef08a', textColor: '#713f12', borderColor: '#fde047' },
  completed:               { bgColor: '#a7f3d0', textColor: '#064e3b', borderColor: '#6ee7b7' },
  invoiced:                { bgColor: '#99f6e4', textColor: '#134e4a', borderColor: '#5eead4' },
  paid_in_full:            { bgColor: '#d9f99d', textColor: '#365314', borderColor: '#bef264' },
  job_closed:              { bgColor: '#e7e5e4', textColor: '#44403c', borderColor: '#d6d3d1' },
  cancelled:               { bgColor: '#fecaca', textColor: '#7f1d1d', borderColor: '#fca5a5' },
}

export type StatusColorEntry = {
  id: string
  status: JobStatusValue
  bgColor: string
  textColor: string
  borderColor: string
}

/** List all status colors for the tenant, seeding defaults if none exist yet. */
export async function listStatusColors(orgId: string): Promise<StatusColorEntry[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: statusColors.id,
        status: statusColors.status,
        bgColor: statusColors.bgColor,
        textColor: statusColors.textColor,
        borderColor: statusColors.borderColor,
      })
      .from(statusColors)
      .where(eq(statusColors.tenantId, orgId))
      .orderBy(statusColors.status)

    if (rows.length === 0) {
      // Seed defaults for this tenant
      const entries = Object.entries(DEFAULT_STATUS_COLORS).map(([status, colors]) => ({
        tenantId: orgId,
        status: status as JobStatusValue,
        ...colors,
      }))

      await tx.insert(statusColors).values(entries)

      const seeded = await tx
        .select({
          id: statusColors.id,
          status: statusColors.status,
          bgColor: statusColors.bgColor,
          textColor: statusColors.textColor,
          borderColor: statusColors.borderColor,
        })
        .from(statusColors)
        .where(eq(statusColors.tenantId, orgId))
        .orderBy(statusColors.status)

      return seeded
    }

    return rows
  })
}

/** Update a single status color row. */
export async function updateStatusColor(
  orgId: string,
  id: string,
  input: { bgColor: string; textColor: string; borderColor: string },
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(statusColors)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(statusColors.tenantId, orgId), eq(statusColors.id, id)))
  })
}

// ── Estimate Status Colors (per-tenant estimate card customization) ───────────

const DEFAULT_ESTIMATE_STATUS_COLORS: Record<
  EstimateStatusValue,
  { bgColor: string; textColor: string; borderColor: string }
> = {
  estimate_requested: { bgColor: '#d1d5db', textColor: '#1f2937', borderColor: '#9ca3af' },
  estimate_provided:  { bgColor: '#bfdbfe', textColor: '#1e3a8a', borderColor: '#60a5fa' },
  estimate_accepted:  { bgColor: '#99f6e4', textColor: '#134e4a', borderColor: '#2dd4bf' },
  estimate_won:       { bgColor: '#bbf7d0', textColor: '#14532d', borderColor: '#4ade80' },
  estimate_lost:      { bgColor: '#fecaca', textColor: '#7f1d1d', borderColor: '#f87171' },
}

export type EstimateStatusColorEntry = {
  id: string
  status: EstimateStatusValue
  bgColor: string
  textColor: string
  borderColor: string
}

export async function listEstimateStatusColors(orgId: string): Promise<EstimateStatusColorEntry[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: estimateStatusColors.id,
        status: estimateStatusColors.status,
        bgColor: estimateStatusColors.bgColor,
        textColor: estimateStatusColors.textColor,
        borderColor: estimateStatusColors.borderColor,
      })
      .from(estimateStatusColors)
      .where(eq(estimateStatusColors.tenantId, orgId))
      .orderBy(estimateStatusColors.status)

    if (rows.length === 0) {
      const entries = Object.entries(DEFAULT_ESTIMATE_STATUS_COLORS).map(([status, colors]) => ({
        tenantId: orgId,
        status: status as EstimateStatusValue,
        ...colors,
      }))

      await tx.insert(estimateStatusColors).values(entries)

      const seeded = await tx
        .select({
          id: estimateStatusColors.id,
          status: estimateStatusColors.status,
          bgColor: estimateStatusColors.bgColor,
          textColor: estimateStatusColors.textColor,
          borderColor: estimateStatusColors.borderColor,
        })
        .from(estimateStatusColors)
        .where(eq(estimateStatusColors.tenantId, orgId))
        .orderBy(estimateStatusColors.status)

      return seeded
    }

    return rows
  })
}

export async function updateEstimateStatusColor(
  orgId: string,
  id: string,
  input: { bgColor: string; textColor: string; borderColor: string },
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(estimateStatusColors)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(estimateStatusColors.tenantId, orgId), eq(estimateStatusColors.id, id)))
  })
}

// ── Sales Reps (lookup list for estimates/jobs Agent / Rep) ───────────────────

export async function createSalesRep(
  orgId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return withTenant(orgId, async (tx) => {
    const existing = await tx
      .select({ id: salesReps.id, name: salesReps.name })
      .from(salesReps)
      .where(and(eq(salesReps.tenantId, orgId), eq(salesReps.name, name)))
      .limit(1)

    if (existing.length > 0) return existing[0]

    const inserted = await tx
      .insert(salesReps)
      .values({ tenantId: orgId, name })
      .returning({ id: salesReps.id, name: salesReps.name })

    return inserted[0] ?? { id: '', name: '' }
  })
}

export async function listSalesReps(
  orgId: string,
): Promise<Array<{ id: string; name: string }>> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: salesReps.id, name: salesReps.name })
      .from(salesReps)
      .where(eq(salesReps.tenantId, orgId))
      .orderBy(salesReps.name)
  })
}

export async function updateSalesRep(
  orgId: string,
  id: string,
  name: string,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .update(salesReps)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(salesReps.tenantId, orgId), eq(salesReps.id, id)))
  })
}

export async function deleteSalesRep(orgId: string, id: string): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await tx
      .delete(salesReps)
      .where(and(eq(salesReps.tenantId, orgId), eq(salesReps.id, id)))
  })
}
