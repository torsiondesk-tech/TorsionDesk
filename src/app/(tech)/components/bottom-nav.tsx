'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, ClipboardList, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/tech/jobs', label: 'Jobs', Icon: Briefcase },
  { href: '/tech/estimates', label: 'Estimates', Icon: ClipboardList },
  { href: '/tech/invoices', label: 'Invoices', Icon: Receipt },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex h-16 border-t bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Technician navigation"
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname?.startsWith(href) ?? false
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-sm transition-opacity duration-75 active:opacity-50',
              active ? 'font-semibold text-primary' : 'text-muted-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
