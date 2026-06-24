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
        <span className="hidden sm:inline">Create New</span>
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
            <Link
              href="/jobs/new"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              New Job
            </Link>
            <Link
              href="/estimates/new"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              New Estimate
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
