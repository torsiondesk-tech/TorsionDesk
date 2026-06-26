import { getProfile } from '@/lib/profile'
import { getLogoSignedUrl } from '@/lib/storage'
import { CompanyProfileForm } from './profile-form'

/**
 * Company Profile settings page (TENANT-02, D-11/D-12).
 *
 * Server component: reads the current profile for the active tenant via
 * `getProfile()` (which runs inside `withTenant`), then renders the client form
 * pre-filled with the stored values. The form owns the two server actions
 * (save profile + upload logo).
 */
export default async function CompanyProfilePage() {
  const profile = await getProfile()
  const logoSignedUrl = profile?.logoUrl ? await getLogoSignedUrl(profile.logoUrl) : null

  return (
    <CompanyProfileForm
      initial={{
        companyName: profile?.companyName ?? '',
        phone: profile?.phone ?? '',
        address: profile?.address ?? '',
        email: profile?.email ?? '',
        logoUrl: profile?.logoUrl ?? '',
        logoSignedUrl: logoSignedUrl ?? '',
        defaultPaymentTermsDays: profile?.defaultPaymentTermsDays ?? 0,
      }}
    />
  )
}
