'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Settings tab navigation (D-13).
 *
 * Lists ALL ten settings sections in their permanent order so the full shape of
 * the Settings area is visible from Phase 0. Only the first two — Company Profile
 * and Users — are functional; the remaining eight render visible-but-disabled
 * (non-clickable, greyed) with an "Available in Phase N" note so admins know
 * where each capability will land.
 *
 * This is a client component purely so the active tab can be highlighted via
 * `usePathname`. Access control for /settings is enforced server-side by the
 * middleware admin gate (Plan 03, D-15) — this nav is UX only.
 */
type SettingsTab = {
  label: string
  /** Present + routable in Phase 0. */
  href?: string
  /** Phase number where this tab becomes functional (for stub tabs). */
  phase?: number
}

// Permanent settings nav order (D-13). Company Profile + Users are functional;
// the rest are stubbed with the phase that will deliver them.
const TABS: SettingsTab[] = [
  { label: 'Company Profile', href: '/settings/company-profile' },
  { label: 'Users', href: '/settings/users' },
  { label: 'Job Categories', href: '/settings/job-categories' },
  { label: 'Product Categories', href: '/settings/product-categories' },
  { label: 'Tags', phase: 2 },
  { label: 'Templates', phase: 8 },
  { label: 'Email', phase: 8 },
  { label: 'SMS', phase: 8 },
  { label: 'Payment Methods', phase: 7 },
  { label: 'Tax Items', phase: 2 },
  { label: 'Lookup Lists', phase: 2 },
]

export function SettingsTabs() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Settings sections"
      className="flex w-56 shrink-0 flex-col gap-0.5"
    >
      {TABS.map((tab) => {
        // Functional tab — real link with an active state.
        if (tab.href) {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          )
        }

        // Stubbed tab — visible but disabled, with the phase noted (D-13).
        return (
          <span
            key={tab.label}
            aria-disabled="true"
            title={`Available in Phase ${tab.phase}`}
            className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground/50 select-none"
          >
            <span>{tab.label}</span>
            <span className="text-[10px] font-medium tracking-wide uppercase">
              Phase {tab.phase}
            </span>
          </span>
        )
      })}
    </nav>
  )
}
