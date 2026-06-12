'use server'

import { eq, and } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import { tags, referralSources } from '@/db/schema'

async function activeOrgId(): Promise<string> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No active organization')
  return orgId
}

export async function createTag(
  orgId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return withTenant(orgId, async (tx) => {
    // Try insert; if unique constraint hits, select existing.
    const inserted = await tx
      .insert(tags)
      .values({ tenantId: orgId, name })
      .returning({ id: tags.id, name: tags.name })

    if (inserted.length > 0) return inserted[0]

    // Duplicate — fetch existing.
    const rows = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.tenantId, orgId), eq(tags.name, name)))
      .limit(1)

    return rows[0] ?? { id: '', name }
  })
}

export async function createReferralSource(
  orgId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return withTenant(orgId, async (tx) => {
    const inserted = await tx
      .insert(referralSources)
      .values({ tenantId: orgId, name })
      .returning({ id: referralSources.id, name: referralSources.name })

    if (inserted.length > 0) return inserted[0]

    const rows = await tx
      .select({ id: referralSources.id, name: referralSources.name })
      .from(referralSources)
      .where(and(eq(referralSources.tenantId, orgId), eq(referralSources.name, name)))
      .limit(1)

    return rows[0] ?? { id: '', name }
  })
}

export async function listTags(orgId: string): Promise<Array<{ id: string; name: string }>> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.tenantId, orgId))
      .orderBy(tags.name)
  })
}

export async function listReferralSources(
  orgId: string,
): Promise<Array<{ id: string; name: string }>> {
  return withTenant(orgId, async (tx) => {
    return tx
      .select({ id: referralSources.id, name: referralSources.name })
      .from(referralSources)
      .where(eq(referralSources.tenantId, orgId))
      .orderBy(referralSources.name)
  })
}
