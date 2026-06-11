'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { saveProfile } from '@/lib/profile'

/**
 * Onboarding server action (D-05/D-11, TENANT-02).
 *
 * Captures the two onboarding-minimum fields — company name + phone — validates
 * them (zod, ASVS V5), persists them via `saveProfile` (which resolves the active
 * org from the verified Clerk session and runs inside `withTenant`, so RLS
 * confines the write to this tenant), then redirects to the dashboard.
 *
 * We assert a signed-in org up front so a session that somehow reached
 * /onboarding without an active organization fails closed rather than writing to
 * the wrong tenant.
 */
const onboardingSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required'),
  phone: z.string().trim().min(1, 'Phone is required'),
})

export type OnboardingState = { error?: string }

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { orgId } = await auth()
  if (!orgId) {
    return { error: 'No active organization. Please finish creating your workspace.' }
  }

  const parsed = onboardingSchema.safeParse({
    companyName: formData.get('companyName'),
    phone: formData.get('phone'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  // saveProfile re-resolves the org from the session and runs inside withTenant.
  await saveProfile(parsed.data)

  redirect('/dashboard')
}
