'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Briefcase, ClipboardList, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

const actions = [
  { href: '/tech/customers/new', label: 'New Customer', Icon: UserPlus, bg: 'bg-emerald-500' },
  { href: '/tech/estimates/new', label: 'New Estimate', Icon: ClipboardList, bg: 'bg-violet-500' },
  { href: '/tech/jobs/new', label: 'New Job', Icon: Briefcase, bg: 'bg-sky-500' },
]

export function CreateButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className="fixed right-4 z-50 flex flex-col items-end gap-3 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4rem + 0.875rem)' }}
      >
        {actions.map(({ href, label, Icon, bg }, i) => (
          <div
            key={href}
            className={cn(
              'flex items-center gap-3 transition-all duration-200',
              open
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-3 pointer-events-none',
            )}
            style={{ transitionDelay: open ? `${(actions.length - 1 - i) * 50}ms` : '0ms' }}
          >
            <span className="rounded-full bg-background px-3 py-1.5 text-sm font-medium shadow-lg border whitespace-nowrap">
              {label}
            </span>
            <Link
              href={href}
              onClick={() => setOpen(false)}
              aria-label={label}
              className={cn(
                'flex size-12 items-center justify-center rounded-full text-white shadow-md',
                'transition-transform duration-100 active:scale-90',
                bg,
              )}
            >
              <Icon className="size-5" />
            </Link>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Create new'}
          aria-expanded={open}
          className={cn(
            'flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground pointer-events-auto',
            'shadow-xl ring-4 ring-primary/20 transition-all duration-200 active:scale-90',
            open && 'rotate-45',
          )}
        >
          <Plus className="size-7" />
        </button>
      </div>
    </>
  )
}
