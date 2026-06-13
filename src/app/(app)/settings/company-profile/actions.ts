'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { saveProfile, getProfile } from '@/lib/profile'
import { uploadLogo } from '@/lib/storage'

/**
 * Company Profile server actions (TENANT-02, D-11/D-12).
 *
 * `saveCompanyProfile` persists the full business profile (name, address, phone,
 * email) via `saveProfile` — which re-resolves the active org from the verified
 * Clerk session and runs inside `withTenant`, so RLS confines the write to this
 * tenant (T-00-11).
 *
 * `uploadCompanyLogo` uploads the file to tenant-scoped Supabase Storage via
 * `uploadLogo(orgId, file)` (service-role, server-only, T-00-04) and then persists
 * the returned object path on `tenants.logo_url` via `saveProfile`.
 *
 * Every action reads `orgId` from `auth()` up front and fails closed if there is
 * no active organization, so a write can never land on the wrong tenant.
 */

// Full profile (D-11). Name + phone required; address + email optional.
const companyProfileSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(255),
  phone: z.string().trim().min(1, 'Phone is required').max(50),
  address: z.string().trim().max(500).optional(),
  email: z
    .union([z.string().trim().max(255).email('Enter a valid email'), z.literal('')])
    .optional(),
})

export type ProfileActionState = { error?: string; success?: boolean }

/** Persist the full company profile for the active tenant. */
export async function saveCompanyProfile(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const parsed = companyProfileSchema.safeParse({
    companyName: formData.get('companyName'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  // Normalize empty optional strings to undefined so we don't store "".
  const { companyName, phone } = parsed.data
  const address = parsed.data.address || undefined
  const email = parsed.data.email || undefined

  await saveProfile({ companyName, phone, address, email })
  revalidatePath('/settings/company-profile')
  return { success: true }
}

export type LogoActionState = { error?: string; logoUrl?: string }

/** Upload the tenant logo to Storage and persist its path on the tenant row. */
export async function uploadCompanyLogo(
  _prevState: LogoActionState,
  formData: FormData,
): Promise<LogoActionState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please sign in to your workspace.' }
  }

  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image file to upload.' }
  }
  if (!file.type.startsWith('image/')) {
    return { error: 'The logo must be an image file.' }
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: 'Logo must be under 2 MB.' }
  }

  // Upload to tenant-scoped Storage (service-role, server-only), then persist the
  // returned path. We must re-send the existing required fields to saveProfile,
  // so read the current profile to satisfy the name/phone requirement.
  const path = await uploadLogo(orgId, file)

  const current = (await getProfile()) ?? {}
  const companyName = (current.companyName as string) || 'Company'
  const phone = (current.phone as string) || ''

  await saveProfile({
    companyName,
    phone,
    address: (current.address as string) || undefined,
    email: (current.email as string) || undefined,
    logoUrl: path,
  })

  revalidatePath('/settings/company-profile')
  return { logoUrl: path }
}
