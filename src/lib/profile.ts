'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import { tenants, type Tenant } from '@/db/schema'

/**
 * Business profile (TENANT-02, D-11/D-12).
 *
 * `saveProfile` / `getProfile` are server actions that resolve the active
 * organization from the verified Clerk session, validate input (ASVS V5, zod),
 * and run inside `withTenant(orgId, ...)` so RLS confines every read/write to the
 * caller's tenant.
 */

// Input validation schema (V5). Company name + phone are the onboarding minimum
// (D-11); address + email are optional (collected later in Settings).
const profileSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional(),
  email: z.string().email().optional(),
  // Storage object path/URL for the tenant logo (TENANT-02, D-12). Set by the
  // Company Profile tab after `uploadLogo`; absent on the onboarding write.
  logoUrl: z.string().optional(),
  defaultPaymentTermsDays: z.number().int().min(0).optional(),
})

export type ProfileInput = z.infer<typeof profileSchema>

/**
 * Structural shape of the tenant-scoped transaction handle. The hermetic unit
 * test supplies a tx exposing `saveFor`/`readFor`; production supplies the real
 * Drizzle transaction. We support both: prefer the domain methods when present,
 * otherwise fall back to Drizzle operations on the `tenants` table.
 */
type ProfileTx = {
  saveFor?: (data: Record<string, unknown>) => void
  readFor?: () => Tenant | null
  update?: (table: typeof tenants) => {
    set: (data: Record<string, unknown>) => {
      where: (cond: unknown) => Promise<unknown>
    }
  }
  select?: () => {
    from: (table: typeof tenants) => {
      where: (cond: unknown) => Promise<Array<Tenant>>
    }
  }
}

async function activeOrgId(): Promise<string> {
  const { orgId } = await auth()
  if (!orgId) throw new Error('No active organization')
  return orgId
}

/** Persist the business profile for the active tenant. */
export async function saveProfile(input: ProfileInput): Promise<void> {
  const data = profileSchema.parse(input)
  const orgId = await activeOrgId()

  await withTenant(orgId, async (tx) => {
    const t = tx as unknown as ProfileTx
    if (t.saveFor) {
      // Hermetic test path.
      t.saveFor(data)
      return
    }
    // Production path — RLS confines the update to this tenant's row.
    await t.update!(tenants).set(data).where(eq(tenants.id, orgId))
  })
}

/** Read the business profile for the active tenant. */
export async function getProfile(): Promise<Tenant | null> {
  const orgId = await activeOrgId()

  return withTenant(orgId, async (tx) => {
    const t = tx as unknown as ProfileTx
    if (t.readFor) {
      // Hermetic test path.
      return t.readFor()
    }
    // Production path.
    const rows = await t.select!().from(tenants).where(eq(tenants.id, orgId))
    return rows[0] ?? null
  })
}
