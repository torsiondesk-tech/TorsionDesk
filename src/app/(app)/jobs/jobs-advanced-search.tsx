'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { useQueryStates, parseAsString, parseAsInteger } from 'nuqs'
import { X } from 'lucide-react'
import { CustomerSearch } from '@/components/customer-search'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { statusLabel, STATUS_GROUPS } from '@/lib/jobs/transitions'
import { listTechnicians } from '@/app/(app)/dispatch/actions'
import type { Technician } from '@/app/(app)/dispatch/actions'
import type { JobCategoryRow } from '@/lib/categories'

const JOB_STATUSES = [
  ...STATUS_GROUPS.open,
  ...STATUS_GROUPS.in_progress,
  ...STATUS_GROUPS.closed,
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'emergency', label: 'Emergency' },
]

interface JobsAdvancedSearchProps {
  categories: JobCategoryRow[]
  defaultCustomerLabel?: string | null
}

export function JobsAdvancedSearch({
  categories,
  defaultCustomerLabel,
}: JobsAdvancedSearchProps) {
  const [isPending, startTransition] = useTransition()
  const [techs, setTechs] = useState<Technician[]>([])
  const [searchInput, setSearchInput] = useState('')

  const [
    { q, status, priority, category, from, to, tech, customer },
    setParams,
  ] = useQueryStates(
    {
      bucket: parseAsString.withDefault(''),
      q: parseAsString.withDefault(''),
      status: parseAsString.withDefault(''),
      priority: parseAsString.withDefault(''),
      category: parseAsString.withDefault(''),
      from: parseAsString.withDefault(''),
      to: parseAsString.withDefault(''),
      tech: parseAsString.withDefault(''),
      customer: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(0),
    },
    { shallow: false },
  )

  // Sync local search input with URL param on mount / external change
  useEffect(() => {
    setSearchInput(q)
  }, [q])

  // Load org technicians for assignee filter
  useEffect(() => {
    let cancelled = false
    listTechnicians()
      .then((list) => {
        if (!cancelled) setTechs(list)
      })
      .catch(() => {
        if (!cancelled) setTechs([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounce free-text search -> URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== q) {
        startTransition(() => {
          setParams({ q: searchInput || null, page: null })
        })
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput, q, setParams])

  const updateFilter = (key: string, value: string | null) => {
    startTransition(() => {
      setParams({ [key]: value || null, page: null })
    })
  }

  const clearFilters = () => {
    startTransition(() => {
      setParams({
        bucket: null,
        q: null,
        status: null,
        priority: null,
        category: null,
        from: null,
        to: null,
        tech: null,
        customer: null,
        page: null,
      })
    })
    setSearchInput('')
  }

  const hasFilters =
    q || status || priority || category || from || to || tech || customer

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Advanced Search</h2>
          <p className="text-xs text-muted-foreground">
            Narrow jobs by status, dates, assignee, customer, and more.
          </p>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={isPending}
          >
            <X className="mr-1 size-4" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Free-text search */}
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="advanced-search-q" className="text-xs">
            Search
          </Label>
          <Input
            id="advanced-search-q"
            placeholder="Job #, description, PO #, customer, or city…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
            className="h-8"
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select
            value={status || ''}
            onValueChange={(val) => updateFilter('status', val)}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any status</SelectItem>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <Label className="text-xs">Priority</Label>
          <Select
            value={priority || ''}
            onValueChange={(val) => updateFilter('priority', val)}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Any priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any priority</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select
            value={category || ''}
            onValueChange={(val) => updateFilter('category', val)}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Any category">
                {category
                  ? categories.find((c) => c.id === category)?.name ?? 'Any category'
                  : 'Any category'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {`${'  '.repeat(c.depth)}${c.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="space-y-1.5">
          <Label className="text-xs">From date</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => updateFilter('from', e.currentTarget.value)}
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To date</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => updateFilter('to', e.currentTarget.value)}
            className="h-8"
          />
        </div>

        {/* Assignee */}
        <div className="space-y-1.5">
          <Label className="text-xs">Assigned tech</Label>
          <Select
            value={tech || ''}
            onValueChange={(val) => updateFilter('tech', val)}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Any tech">
                {tech ? techs.find((t) => t.userId === tech)?.name ?? 'Any tech' : 'Any tech'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any tech</SelectItem>
              {techs.map((t) => (
                <SelectItem key={t.userId} value={t.userId}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Customer */}
        <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
          <Label className="text-xs">Customer</Label>
          <CustomerSearch
            key={customer || 'empty'}
            defaultValue={customer || undefined}
            defaultLabel={defaultCustomerLabel || undefined}
            onChange={(val) => updateFilter('customer', val)}
          />
        </div>
      </div>
    </div>
  )
}
