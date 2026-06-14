'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  CalendarRange,
  Users,
  FileText,
  Package,
  Receipt,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { visibleModules, type ModuleKey } from '@/lib/roles'

/**
 * Dark, role-filtered app sidebar (D-07/D-08/D-10/D-16).
 *
 * Lists ALL nine modules in Service-Fusion terminology. In Phase 0 only Dashboard
 * and Settings are routable; every other module renders visible-but-disabled and
 * non-clickable (D-08 — the full shape of the app is visible from day 1).
 *
 * DEFENSE IN DEPTH (D-16): this component additionally HIDES any module the
 * current role cannot access (driven by `visibleModules(role)` from
 * `@/lib/roles`). This is the UX-only second layer — the middleware role gate
 * (Plan 03 Task 1) is the real enforcement. Never rely on this hiding alone.
 */
type NavItem = {
  key: ModuleKey
  label: string
  href: string
  icon: LucideIcon
  /** Built and routable in Phase 0. Others render disabled (D-08). */
  enabled: boolean
}

// The permanent nav structure. Order = display order. Phase 0 enables only
// Dashboard and Settings; later phases flip their own `enabled` to true.
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: true },
  { key: 'jobs', label: 'Jobs', href: '/jobs', icon: Briefcase, enabled: true },
  { key: 'dispatch', label: 'Dispatch', href: '/dispatch', icon: CalendarRange, enabled: false },
  { key: 'customers', label: 'Customers', href: '/customers', icon: Users, enabled: true },
  { key: 'estimates', label: 'Estimates', href: '/estimates', icon: FileText, enabled: false },
  { key: 'catalog', label: 'Catalog', href: '/catalog', icon: Package, enabled: true },
  { key: 'invoicing', label: 'Invoicing', href: '/invoicing', icon: Receipt, enabled: false },
  { key: 'reports', label: 'Reports', href: '/reports', icon: BarChart3, enabled: false },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Settings, enabled: true },
]

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()

  // Role gate (D-16): only keep modules this role may see. Settings is dropped
  // for non-admins here AND blocked by the middleware admin gate.
  const allowed = new Set<ModuleKey>(visibleModules(role))
  const items = NAV_ITEMS.filter((item) => allowed.has(item.key))

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col gap-2 bg-neutral-950 px-3 py-4 text-neutral-300">
      <div className="px-2 pb-2">
        <span className="text-lg font-bold tracking-tight text-white">TorsionDesk</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = item.enabled && pathname.startsWith(item.href)

          // Disabled (unbuilt) modules: visible but greyed and non-clickable (D-08).
          if (!item.enabled) {
            return (
              <span
                key={item.key}
                aria-disabled="true"
                title="Coming in a later phase"
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-600 select-none"
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </span>
            )
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                // Subtle (not neon) active state (D-10).
                isActive
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-300 hover:bg-neutral-900 hover:text-white',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
