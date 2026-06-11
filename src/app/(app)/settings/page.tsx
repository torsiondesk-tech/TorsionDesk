import { redirect } from 'next/navigation'

/**
 * /settings index — redirect to the first functional tab (Company Profile).
 *
 * The sidebar Settings link points at /settings; landing here we forward to the
 * default section so an admin never sees an empty Settings root.
 */
export default function SettingsIndexPage() {
  redirect('/settings/company-profile')
}
