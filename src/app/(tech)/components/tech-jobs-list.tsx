'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Briefcase, RefreshCw } from 'lucide-react'
import { useTechJobs } from '@/app/(tech)/lib/use-tech-data'
import { groupJobsByDay, splitGroupsByTime } from '@/app/(tech)/lib/group-jobs'
import { JobListCard } from './job-list-card'
import { hydrateTechData, TECH_DATA_UPDATED, TECH_DATA_UPDATE_FAILED } from '@/app/(tech)/lib/sync'
import { toISODate, parseCalendarDate, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createTechDb, type CachedJob } from '@/app/(tech)/lib/dexie'
import type { JobRow } from '@/lib/jobs/jobs'

interface TechJobsListProps {
  orgId: string
  userId: string
  initialRows: JobRow[]
}

function toJobRow(job: CachedJob): JobRow {
  return {
    id: job.id,
    jobNo: job.jobNo,
    customerId: job.customerId,
    contactId: job.contactId,
    serviceLocationId: job.serviceLocationId,
    customerName: job.customerName ?? '',
    description: job.description,
    addressLine1: job.addressLine1,
    city: job.city,
    state: job.state,
    postalCode: job.postalCode,
    contactPhone: job.contactPhone,
    contactEmail: job.contactEmail,
    contactFirstName: job.contactFirstName ?? null,
    contactLastName: job.contactLastName ?? null,
    category: null,
    priority: null,
    status: job.status,
    startDate: job.startDate ? parseCalendarDate(job.startDate) : null,
    arrivalWindowStart: job.arrivalWindowStart ? new Date(job.arrivalWindowStart) : null,
    arrivalWindowEnd: job.arrivalWindowEnd ? new Date(job.arrivalWindowEnd) : null,
    notesForTechs: job.notesForTechs,
    completionNotes: job.completionNotes,
    createdAt: null,
  }
}

function formatLastUpdated(at: number | null): string {
  if (!at) return ''
  const d = new Date(at)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function TechJobsList({ orgId, userId, initialRows }: TechJobsListProps) {
  const jobs = useTechJobs(orgId, userId)
  const today = toISODate(new Date())

  // Pre-seed Dexie with server-rendered rows on first visit so useLiveQuery
  // never sees an empty cache between Dexie init and hydration completing.
  useEffect(() => {
    if (!initialRows.length) return
    const db = createTechDb(orgId)
    const seed: CachedJob[] = initialRows.map((row) => ({
      id: row.id,
      tenantId: orgId,
      jobNo: row.jobNo,
      customerId: row.customerId,
      contactId: row.contactId,
      serviceLocationId: row.serviceLocationId,
      status: row.status,
      description: row.description,
      startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
      arrivalWindowStart: row.arrivalWindowStart?.toISOString() ?? null,
      arrivalWindowEnd: row.arrivalWindowEnd?.toISOString() ?? null,
      notesForTechs: row.notesForTechs,
      completionNotes: row.completionNotes,
      assigneeUserIds: [userId],
      customerName: row.customerName,
      addressLine1: row.addressLine1,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      contactFirstName: row.contactFirstName ?? null,
      contactLastName: row.contactLastName ?? null,
    }))
    db.open()
      .then(() => db.jobs.count())
      .then((n) => { if (n === 0) return db.jobs.bulkPut(seed) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, userId])
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await hydrateTechData(orgId, userId)
      setLastUpdatedAt(Date.now())
    } catch (err) {
      console.error('[tech-jobs-list] manual refresh failed', err)
      toast.error('Could not refresh jobs. Pull down or try again.')
    } finally {
      setRefreshing(false)
      setPullDistance(0)
    }
  }, [orgId, userId])

  // Listen for background hydration events so the timestamp stays honest.
  useEffect(() => {
    const onUpdate = () => setLastUpdatedAt(Date.now())
    const onFailed = () => {
      setRefreshing(false)
      setPullDistance(0)
    }
    window.addEventListener(TECH_DATA_UPDATED, onUpdate)
    window.addEventListener(TECH_DATA_UPDATE_FAILED, onFailed)
    return () => {
      window.removeEventListener(TECH_DATA_UPDATED, onUpdate)
      window.removeEventListener(TECH_DATA_UPDATE_FAILED, onFailed)
    }
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current
    if (!el) return
    // Only allow pull-to-refresh when scrolled to the top.
    if (el.scrollTop > 0) return
    touchStartY.current = e.touches[0]?.clientY ?? null
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current == null) return
    const y = e.touches[0]?.clientY ?? touchStartY.current
    const delta = Math.max(0, y - touchStartY.current)
    // Apply resistance so a small pull doesn't trigger refresh.
    setPullDistance(Math.min(delta * 0.4, 80))
  }, [])

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= 60 && !refreshing) {
      void doRefresh()
    }
    setPullDistance(0)
    touchStartY.current = null
  }, [pullDistance, refreshing, doRefresh])

  // While Dexie is initialising (undefined), fall back to server-rendered rows
  // so the list renders immediately without a loading spinner.
  // Server Date objects are at UTC midnight (PG driver convention); normalize to
  // local midnight via UTC extraction so groupJobsByDay's local-getter logic works.
  const rows = jobs !== undefined
    ? jobs.map(toJobRow)
    : initialRows.map(row => {
        // unstable_cache JSON-serializes Date objects to ISO strings.
        // Handle both Date and string defensively.
        const startRaw = row.startDate as Date | string | null
        const winStart = row.arrivalWindowStart as Date | string | null
        const winEnd = row.arrivalWindowEnd as Date | string | null
        return {
          ...row,
          startDate: startRaw
            ? parseCalendarDate(
                typeof startRaw === 'string'
                  ? startRaw.slice(0, 10)
                  : startRaw.toISOString().slice(0, 10)
              )
            : null,
          arrivalWindowStart: winStart
            ? typeof winStart === 'string' ? new Date(winStart) : winStart
            : null,
          arrivalWindowEnd: winEnd
            ? typeof winEnd === 'string' ? new Date(winEnd) : winEnd
            : null,
        }
      })
  const allGroups = groupJobsByDay(rows, today)
  const { upcoming, past } = splitGroupsByTime(allGroups, today)
  const activeGroups = tab === 'upcoming' ? upcoming : past

  const tabs = (
    <div className="flex rounded-lg bg-muted p-1">
      {(['upcoming', 'past'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          className={cn(
            'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
            tab === t
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t === 'upcoming' ? 'Upcoming' : 'Past'}
          {t === 'past' && past.length > 0 && (
            <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
              {past.reduce((n, g) => n + g.jobs.length, 0)}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  const emptyUpcoming = (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Briefcase className="size-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold">No jobs assigned</h1>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">
        You&apos;re all caught up. Pull down or tap refresh to check for new dispatches.
      </p>
    </div>
  )

  const emptyPast = (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Briefcase className="size-12 text-muted-foreground" aria-hidden="true" />
      <p className="mt-4 text-base text-muted-foreground">No past jobs found.</p>
    </div>
  )

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col">
        <span className="text-sm font-semibold">My Jobs</span>
        {lastUpdatedAt && (
          <span className="text-xs text-muted-foreground">
            Updated {formatLastUpdated(lastUpdatedAt)}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={doRefresh}
        disabled={refreshing}
        aria-label="Refresh jobs"
        className="inline-flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 disabled:opacity-50"
      >
        <RefreshCw className={cn('size-5', refreshing && 'animate-spin')} aria-hidden="true" />
      </button>
    </div>
  )

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="flex h-full flex-col gap-4 overflow-y-auto overscroll-y-none px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]"
    >
      {header}
      <PullIndicator distance={pullDistance} refreshing={refreshing} />
      {tabs}
      {activeGroups.length === 0 ? (
        tab === 'upcoming' ? emptyUpcoming : emptyPast
      ) : (
        <div className="flex flex-col gap-6">
          {activeGroups.map((group) => (
            <section key={group.date} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
              <div className="flex flex-col gap-3">
                {group.jobs.map((job) => (
                  <JobListCard key={job.id} job={job} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function PullIndicator({ distance, refreshing }: { distance: number; refreshing: boolean }) {
  if (!distance && !refreshing) return null
  const active = distance >= 60 || refreshing
  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all duration-150"
      style={{ height: Math.max(distance, refreshing ? 40 : 0) }}
    >
      <RefreshCw
        className={cn('size-5 text-muted-foreground transition-transform', active && 'rotate-180 animate-spin')}
        aria-hidden="true"
      />
      <span className="sr-only">{active ? 'Refreshing jobs…' : 'Pull to refresh'}</span>
    </div>
  )
}
