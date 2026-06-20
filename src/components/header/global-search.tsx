'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Briefcase,
  User,
  Phone,
  Mail,
  MapPin,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { globalSearchAction } from './global-search-actions'

/* ------------------------------------------------------------------ */
//  Types & helpers
/* ------------------------------------------------------------------ */

type SearchResult = Awaited<ReturnType<typeof globalSearchAction>>[number]

const TYPE_ICONS = {
  job: Briefcase,
  customer: User,
  contact: User,
  phone: Phone,
  email: Mail,
  location: MapPin,
  equipment: Wrench,
} as const

const TYPE_LABELS: Record<string, string> = {
  job: 'Jobs',
  customer: 'Customers',
  contact: 'Contacts',
  phone: 'Phone Numbers',
  email: 'Emails',
  location: 'Addresses',
  equipment: 'Equipment',
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-transparent font-semibold text-primary underline decoration-primary/30"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
//  Component
/* ------------------------------------------------------------------ */

export function GlobalSearch() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedRef = useRef<HTMLDivElement | null>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isPending, startTransition] = useTransition()

  /* ---- derive groups & flat list ----------------------------------- */
  const { groups, flatItems } = React.useMemo(() => {
    const groupKeys = Array.from(new Set(results.map((r) => r.type)))
    const groups = groupKeys.map((type) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      items: results.filter((r) => r.type === type),
    }))
    const flatItems = groups.flatMap((g) => g.items)
    return { groups, flatItems }
  }, [results])

  /* ---- debounce ---------------------------------------------------- */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  /* ---- fetch ------------------------------------------------------- */
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([])
      setSelectedIndex(-1)
      return
    }
    startTransition(async () => {
      try {
        const data = await globalSearchAction(debouncedQuery)
        setResults(data)
        setSelectedIndex(data.length > 0 ? 0 : -1)
      } catch {
        setResults([])
        setSelectedIndex(-1)
      }
    })
  }, [debouncedQuery])

  /* ---- scroll selected into view ----------------------------------- */
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedIndex])

  /* ---- click outside to close -------------------------------------- */
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  /* ---- global shortcuts (/ and Cmd+K) ------------------------------ */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (
        (e.key === '/' && !isTyping) ||
        (e.key === 'k' && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  /* ---- keyboard navigation ----------------------------------------- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (selectedIndex >= 0 && flatItems[selectedIndex]) {
          router.push(flatItems[selectedIndex].href)
          setOpen(false)
          setQuery('')
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        inputRef.current?.blur()
      } else if (e.key === 'Home') {
        e.preventDefault()
        setSelectedIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setSelectedIndex(Math.max(flatItems.length - 1, 0))
      }
    },
    [open, flatItems, selectedIndex, router],
  )

  const navigate = useCallback(
    (href: string) => {
      router.push(href)
      setOpen(false)
      setQuery('')
    },
    [router],
  )

  /* ---- pre-compute global indices ---------------------------------- */
  const indexMap = React.useMemo(() => {
    const map = new Map<string, number>()
    flatItems.forEach((item, i) => map.set(`${item.type}-${item.id}`, i))
    return map
  }, [flatItems])

  /* ---- render ------------------------------------------------------ */
  return (
    <div ref={containerRef} className="relative hidden md:block">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search anything..."
          className={cn(
            'h-9 w-64 rounded-lg border border-input bg-muted/50 py-1 pl-9 pr-10 text-sm shadow-sm transition-colors',
            'placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring',
            'md:w-80 lg:w-96',
          )}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? 'global-search-results' : undefined}
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden rounded border bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground md:inline-block">
          /
        </kbd>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          id="global-search-results"
          role="listbox"
          className={cn(
            'absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-popover p-1 shadow-lg md:w-96 lg:w-[28rem]',
            'fade-in-0 zoom-in-95 animate-in duration-100',
          )}
        >
          {isPending ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {debouncedQuery.trim().length >= 2
                ? 'No results found.'
                : 'Type to search jobs, customers, contacts, and more.'}
            </div>
          ) : (
            <div className="max-h-[min(60vh,420px)] overflow-y-auto py-1">
              {groups.map((group) => (
                <div key={group.type} role="group" aria-label={group.label}>
                  <div className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const flatIdx = indexMap.get(`${item.type}-${item.id}`)!
                    const isSelected = flatIdx === selectedIndex
                    const key = `${item.type}-${item.id}`
                    const Icon =
                      TYPE_ICONS[item.type as keyof typeof TYPE_ICONS]
                    return (
                      <div
                        key={key}
                        ref={(el) => {
                          if (isSelected) selectedRef.current = el
                        }}
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors',
                          isSelected &&
                            'bg-accent text-accent-foreground',
                        )}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                        onClick={() => navigate(item.href)}
                      >
                        {Icon && (
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            <Highlight
                              text={item.title}
                              query={debouncedQuery}
                            />
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            <Highlight
                              text={item.subtitle}
                              query={debouncedQuery}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
