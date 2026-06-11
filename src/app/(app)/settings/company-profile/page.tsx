import { getProfile } from '@/lib/profile'
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
  const profile = (await getProfile()) ?? {}

  return (
    <CompanyProfileForm
      initial={{
        companyName: (profile.companyName as string) ?? '',
        phone: (profile.phone as string) ?? '',
        address: (profile.address as string) ?? '',
        email: (profile.email as string) ?? '',
        logoUrl: (profile.logoUrl as string) ?? '',
      }}
    />
  )
}
