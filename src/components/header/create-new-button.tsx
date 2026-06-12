'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CreateNewButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} className="relative">
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="size-4" />
        Create New
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className={cn(
              'absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border bg-popover p-1 shadow-md',
              'fade-in-0 zoom-in-95 duration-100 animate-in'
            )}
          >
            <Link
              href="/customers/new"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              New Customer
            </Link>
            <span
              role="menuitem"
              aria-disabled="true"
              title="Available in a later release"
              className="flex cursor-not-allowed items-center rounded-md px-3 py-2 text-sm text-muted-foreground/50 select-none"
            >
              New Job
            </span>
            <span
              role="menuitem"
              aria-disabled="true"
              title="Available in a later release"
              className="flex cursor-not-allowed items-center rounded-md px-3 py-2 text-sm text-muted-foreground/50 select-none"
            >
              New Estimate
            </span>
          </div>
        </>
      )}
    </div>
  )
}
