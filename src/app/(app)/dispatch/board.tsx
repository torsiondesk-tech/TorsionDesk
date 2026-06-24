'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { updateJobAssignment, unassignJob, getJobPopupData } from './actions'
import type { WeekJob, WeekEstimate, Technician, PoolCounts, PopupData } from './actions'
import { toISODate, parseCalendarDate, getMonday } from '@/lib/utils'
import { WeekNavigator } from './components/week-navigator'
import { WeekGrid } from './grid/week-grid'
import { JobBlock } from './grid/job-block'
import { JobPool } from './pool/job-pool'
import { PoolCardContent } from './pool/pool-card'
import { DispatchPopup } from './popup/dispatch-popup'
import { MobileDispatch } from './mobile-view'
import { useRealtimeSync } from './hooks/use-realtime-sync'
import { StatusColorProvider, type StatusColorMap } from './contexts/status-color-context'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

/** Next.js serializes Date props to ISO strings when passing Server → Client.
 *  Re-hydrate them so downstream code can safely call .toISOString()/.getTime().
 */
function parseDate(d: unknown): Date | null {
  if (!d) return null
  if (d instanceof Date) return d
  const parsed = new Date(d as string)
  return isNaN(parsed.getTime()) ? null : parsed
}

/** Grid JobBlocks prefix the raw job id with the cell date so every cell
 *  instance is uniquely addressable in dnd-kit.
 */
function stripDraggableId(id: string): string {
  const idx = id.lastIndexOf(':')
  return idx > 0 ? id.slice(0, idx) : id
}
function extractCellDate(id: string): string | null {
  const idx = id.lastIndexOf(':')
  return idx > 0 ? id.slice(idx + 1) : null
}

function parseWeekJob(job: WeekJob): WeekJob {
  return {
    ...job,
    // startDate / endDate are calendar dates (not wall-clock instants) — preserve
    // the day exactly as it was scheduled, regardless of viewer timezone.
    startDate: parseCalendarDate(job.startDate),
    endDate: parseCalendarDate(job.endDate),
    arrivalWindowStart: parseDate(job.arrivalWindowStart),
    arrivalWindowEnd: parseDate(job.arrivalWindowEnd),
  }
}

function parseWeekEstimate(estimate: WeekEstimate): WeekEstimate {
  const rawDate = parseDate(estimate.startDate)
  return {
    ...estimate,
    // onSiteDate arrives from the server as a UTC instant (timestamp column stored
    // at UTC midnight). Extract the UTC calendar date then build a local midnight
    // Date so toISODate() returns the correct day in US timezones. Using parseDate
    // directly would shift the day one day back (UTC midnight = previous evening locally).
    startDate: rawDate ? parseCalendarDate(rawDate.toISOString().slice(0, 10)) : null,
    endDate: null,
    arrivalWindowStart: parseDate(estimate.arrivalWindowStart),
    arrivalWindowEnd: parseDate(estimate.arrivalWindowEnd),
  }
}

interface DispatchBoardProps {
  technicians: Technician[]
  jobs: WeekJob[]
  estimates: WeekEstimate[]
  poolJobs: WeekJob[]
  counts: PoolCounts
  weekStart: string
  weekEnd: string
  colorMap: StatusColorMap
}

export function DispatchBoard({
  technicians,
  jobs,
  estimates,
  poolJobs,
  counts,
  weekStart,
  weekEnd,
  colorMap,
}: DispatchBoardProps) {
  const [localJobs, setLocalJobs] = useState<WeekJob[]>(() => jobs.map(parseWeekJob))
  const [revertJobs, setRevertJobs] = useState<WeekJob[]>(() => jobs.map(parseWeekJob))
  const [localEstimates, setLocalEstimates] = useState<WeekEstimate[]>(() => estimates.map(parseWeekEstimate))
  const [localPoolJobs, setLocalPoolJobs] = useState<WeekJob[]>(() => poolJobs.map(parseWeekJob))
  const [revertPoolJobs, setRevertPoolJobs] = useState<WeekJob[]>(() => poolJobs.map(parseWeekJob))
  const [activeJob, setActiveJob] = useState<WeekJob | null>(null)
  const [activeFromPool, setActiveFromPool] = useState(false)
  const [popupJob, setPopupJob] = useState<WeekJob | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupData, setPopupData] = useState<PopupData | null>(null)
  const [popupLoading, setPopupLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { orgId } = useAuth()

  // DnD sensors: require 8px movement before drag starts so clean clicks open the popup.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  )

  // Realtime cross-tab/cross-user sync + 30s polling fallback
  const handleRealtimeRefresh = useCallback(() => router.refresh(), [router])
  useRealtimeSync(orgId, handleRealtimeRefresh)

  // Listen for realtime refresh events and reload server data
  useEffect(() => {
    const handler = () => router.refresh()
    window.addEventListener('dispatch:refresh', handler)
    return () => window.removeEventListener('dispatch:refresh', handler)
  }, [router])

  // If the page was loaded without an explicit weekStart, the server defaulted
  // to its own UTC calendar day. Snap the URL to the viewer's local Monday so
  // the board shows the week that actually contains the user's today.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get('weekStart')) {
      const localMonday = toISODate(getMonday(new Date()))
      router.replace(`?weekStart=${localMonday}`, { scroll: false })
    }
  }, [router])

  const openPopup = useCallback(
    (job: WeekJob) => {
      setPopupJob(job)
      setPopupOpen(true)
      setPopupData(null)
      setPopupLoading(true)

      if (orgId) {
        startTransition(async () => {
          try {
            const data = await getJobPopupData(job.id, orgId)
            setPopupData(data)
          } catch {
            setPopupData(null)
          } finally {
            setPopupLoading(false)
          }
        })
      }
    },
    [orgId],
  )

  const closePopup = useCallback(() => {
    setPopupOpen(false)
    setPopupData(null)
    setTimeout(() => setPopupJob(null), 200)
  }, [])

  // Sync when server data changes (week navigation, refresh)
  useEffect(() => {
    setLocalJobs(jobs.map(parseWeekJob))
    setRevertJobs(jobs.map(parseWeekJob))
    setLocalEstimates(estimates.map(parseWeekEstimate))
    setLocalPoolJobs(poolJobs.map(parseWeekJob))
    setRevertPoolJobs(poolJobs.map(parseWeekJob))
  }, [jobs, estimates, poolJobs])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const rawId = stripDraggableId(event.active.id as string)
      const job =
        localJobs.find((j) => j.id === rawId) ??
        localPoolJobs.find((j) => j.id === rawId)
      if (job) {
        setActiveJob(job)
        setActiveFromPool(event.active.data.current?.type === 'pool-job')
      }
    },
    [localJobs, localPoolJobs],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveJob(null)
      setActiveFromPool(false)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const rawJobId = stripDraggableId(active.id as string)
      const target = over.id as string
      const isPoolJob = active.data.current?.type === 'pool-job'

      // Snapshot for rollback
      const previousJobs = localJobs
      const previousPool = localPoolJobs
      setRevertJobs(previousJobs)
      setRevertPoolJobs(previousPool)

      // ── Drop on pool → unassign ──
      if (target === 'job-pool') {
        if (isPoolJob) return // Pool → pool is a no-op

        const job = localJobs.find((j) => j.id === rawJobId)
        if (!job) return

        const unassigned: WeekJob = { ...job, techIds: [], startDate: null, endDate: null }
        setLocalJobs((prev) => prev.filter((j) => j.id !== rawJobId))
        setLocalPoolJobs((prev) => [unassigned, ...prev])

        startTransition(async () => {
          const result = await unassignJob({ jobId: rawJobId })
          if (result.error) {
            setLocalJobs(previousJobs)
            setLocalPoolJobs(previousPool)
            toast.error(result.error)
          } else {
            router.refresh()
          }
        })
        return
      }

      // ── Drop on grid cell → assign / reassign ──
      const [techId, date] = target.split(':')
      if (!techId || !date) return

      const job = isPoolJob
        ? localPoolJobs.find((j) => j.id === rawJobId)
        : localJobs.find((j) => j.id === rawJobId)
      if (!job) return

      const cellDate = extractCellDate(active.id as string)
      const hasSpan =
        !!job.endDate && !!job.startDate && toISODate(job.endDate) !== toISODate(job.startDate)
      const isGridMultiDay = !isPoolJob && !!cellDate && hasSpan

      let moved: WeekJob
      let startDateStr = date
      let endDateStr: string | undefined

      if (isGridMultiDay) {
        const draggedDate = new Date(`${cellDate}T00:00:00`)
        const targetDate = new Date(`${date}T00:00:00`)
        const offsetDays = Math.round((targetDate.getTime() - draggedDate.getTime()) / 86_400_000)

        const startStr = toISODate(job.startDate!)
        const endStr = toISODate(job.endDate!)

        if (cellDate === startStr) {
          // Dragging the FIRST day → change start date only (keep end fixed).
          const newStart = new Date(job.startDate!)
          newStart.setDate(newStart.getDate() + offsetDays)
          moved = {
            ...job,
            techIds: [techId],
            startDate: newStart,
            endDate: job.endDate,
          }
          startDateStr = toISODate(newStart)
          endDateStr = endStr
        } else if (cellDate === endStr) {
          // Dragging the LAST day → change end date only (keep start fixed).
          const newEnd = new Date(job.endDate!)
          newEnd.setDate(newEnd.getDate() + offsetDays)
          moved = {
            ...job,
            techIds: [techId],
            startDate: job.startDate,
            endDate: newEnd,
          }
          startDateStr = startStr
          endDateStr = toISODate(newEnd)
        } else {
          // Dragging a MIDDLE day → shift the whole block rigidly.
          const newStart = new Date(job.startDate!)
          newStart.setDate(newStart.getDate() + offsetDays)

          const newEnd = new Date(job.endDate!)
          newEnd.setDate(newEnd.getDate() + offsetDays)

          moved = {
            ...job,
            techIds: [techId],
            startDate: newStart,
            endDate: newEnd,
          }
          startDateStr = toISODate(newStart)
          endDateStr = toISODate(newEnd)
        }
      } else {
        // Pool or single-day: target date becomes start date.
        moved = {
          ...job,
          techIds: [techId],
          startDate: new Date(`${date}T00:00:00`),
          endDate: null,
        }
        endDateStr = undefined
      }

      if (isPoolJob) {
        setLocalPoolJobs((prev) => prev.filter((j) => j.id !== rawJobId))
        setLocalJobs((prev) => [...prev, moved])
      } else {
        setLocalJobs((prev) => prev.map((j) => (j.id === rawJobId ? moved : j)))
      }

      startTransition(async () => {
        const result = await updateJobAssignment({
          jobId: rawJobId,
          techUserId: techId,
          date: startDateStr,
          endDate: endDateStr,
        })
        if (result.error) {
          setLocalJobs(previousJobs)
          setLocalPoolJobs(previousPool)
          toast.error(result.error)
        } else {
          router.refresh()
        }
      })
    },
    [localJobs, localPoolJobs, startTransition],
  )

  const weekDates: Date[] = []
  const start = new Date(`${weekStart}T00:00:00`)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    weekDates.push(d)
  }

  return (
    <>
      <StatusColorProvider colors={colorMap}>

        {/* ── Mobile layout (< lg): tap-friendly list, no drag-and-drop ── */}
        <div className="flex flex-col gap-4 animate-in fade-in-0 duration-300 lg:hidden">
          <div className="shrink-0">
            <h1 className="text-2xl font-semibold tracking-tight">Dispatch</h1>
            <p className="text-sm text-muted-foreground">Tap a job to view details and assign.</p>
            <div className="mt-2">
              <WeekNavigator weekStart={weekStart} />
            </div>
          </div>
          <MobileDispatch
            technicians={technicians}
            jobs={localJobs}
            poolJobs={localPoolJobs}
            counts={counts}
            weekDates={weekDates}
            onJobClick={openPopup}
          />
        </div>

        {/* ── Desktop layout (lg+): full drag-and-drop week grid ── */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="hidden lg:flex flex-col h-full gap-4 animate-in fade-in-0 duration-300">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Dispatch Board</h1>
                <p className="text-sm text-muted-foreground">
                  Drag jobs onto technician days to assign.
                </p>
              </div>
              <WeekNavigator weekStart={weekStart} />
            </div>

            <div className="flex-1 min-h-0">
              <WeekGrid
                technicians={technicians}
                jobs={localJobs}
                estimates={localEstimates}
                weekDates={weekDates}
                isLoading={isPending}
                onJobClick={openPopup}
              />
            </div>

            <JobPool jobs={localPoolJobs} counts={counts} onJobClick={openPopup} />
          </div>

          <DragOverlay>
            {activeJob ? (
              activeFromPool ? (
                <PoolCardContent job={activeJob} isOverlay />
              ) : (
                <JobBlock job={activeJob} isOverlay />
              )
            ) : null}
          </DragOverlay>
        </DndContext>

      </StatusColorProvider>
      <DispatchPopup
        job={popupJob}
        techs={technicians}
        open={popupOpen}
        onClose={closePopup}
        popupData={popupData}
      />
      <Toaster />
    </>
  )
}
