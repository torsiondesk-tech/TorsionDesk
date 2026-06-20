'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { visibleModules, type ModuleKey } from '@/lib/roles'
import { NAV_ITEMS } from './nav-config'

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()

  const allowed = new Set<ModuleKey>(visibleModules(role))
  const items = NAV_ITEMS.filter((item) => allowed.has(item.key))

  return (
    <aside className="hidden lg:flex h-screen w-60 shrink-0 flex-col gap-2 bg-neutral-950 px-3 py-4 text-neutral-300">
      <div className="px-2 pb-2">
        <span className="text-lg font-bold tracking-tight text-white">TorsionDesk</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = item.enabled && pathname.startsWith(item.href)

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
