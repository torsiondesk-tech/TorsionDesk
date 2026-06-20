'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { visibleModules, type ModuleKey } from '@/lib/roles'
import { NAV_ITEMS } from './nav-config'

export function MobileNav({ role }: { role: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close drawer on navigation
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const allowed = new Set<ModuleKey>(visibleModules(role))
  const items = NAV_ITEMS.filter((item) => allowed.has(item.key))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="size-5" />
          </Button>
        }
      />

      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-64 bg-neutral-950 text-neutral-300 border-neutral-800 p-0"
      >
        <div className="flex flex-col gap-2 px-3 py-4 h-full">
          <SheetTitle className="px-2 pb-2 text-lg font-bold tracking-tight text-white">
            TorsionDesk
          </SheetTitle>

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
        </div>
      </SheetContent>
    </Sheet>
  )
}
