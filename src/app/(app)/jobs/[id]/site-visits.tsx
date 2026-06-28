'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimeWindowPicker } from '@/components/ui/time-window-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  addSiteVisit,
  updateSiteVisit,
  deleteSiteVisit,
} from '../actions'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'
import { STATUS_GROUPS } from '@/lib/jobs/transitions'

export interface SiteVisit {
  id: string
  status: string | null
  visitDate: Date | null
  arrivalWindowStart: Date | null
  arrivalWindowEnd: Date | null
  notes: string | null
}

interface SiteVisitsProps {
  jobId: string
  visits: SiteVisit[]
}

function toDateInputValue(d: Date | string | null): string {
  if (!d) return ''
  const iso = typeof d === 'string' ? d : d.toISOString()
  return iso.slice(0, 10)
}

function toTimeInputValue(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  const h = String(date.getUTCHours()).padStart(2, '0')
  const m = String(date.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

const ALL_STATUSES = [
  ...STATUS_GROUPS.open,
  ...STATUS_GROUPS.in_progress,
  ...STATUS_GROUPS.closed,
]

export function SiteVisits({ jobId, visits: initialVisits }: SiteVisitsProps) {
  const router = useRouter()
  const [visits, setVisits] = useState<SiteVisit[]>(initialVisits)
  const [isAdding, setIsAdding] = useState(false)
  const [editing, setEditing] = useState<SiteVisit | null>(null)
  const [deleting, setDeleting] = useState<SiteVisit | null>(null)
  const [saving, setSaving] = useState(false)

  // Inline form state
  const [addDate, setAddDate] = useState('')
  const [addStart, setAddStart] = useState('')
  const [addEnd, setAddEnd] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  const addTimeError = addStart && addEnd && addEnd <= addStart
    ? 'End time must be later than start time.'
    : null
  const editTimeError = editStart && editEnd && editEnd <= editStart
    ? 'End time must be later than start time.'
    : null

  // Sync from props
  if (
    initialVisits.length !== visits.length ||
    initialVisits.some((v, i) => v.id !== visits[i]?.id)
  ) {
    setVisits(initialVisits)
  }

  const resetAdd = useCallback(() => {
    setIsAdding(false)
    setAddDate('')
    setAddStart('')
    setAddEnd('')
  }, [])

  const startEditing = useCallback((visit: SiteVisit) => {
    setEditing(visit)
    setEditDate(toDateInputValue(visit.visitDate))
    setEditStart(toTimeInputValue(visit.arrivalWindowStart))
    setEditEnd(toTimeInputValue(visit.arrivalWindowEnd))
  }, [])

  const resetEdit = useCallback(() => {
    setEditing(null)
    setEditDate('')
    setEditStart('')
    setEditEnd('')
  }, [])

  const handleAdd = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (addTimeError) return
      setSaving(true)
      const fd = new FormData(e.currentTarget)
      const result = await addSiteVisit(jobId, {
        status: (fd.get('status') as string) || undefined,
        visitDate: (fd.get('visitDate') as string) || null,
        arrivalWindowStart: (fd.get('arrivalWindowStart') as string) || null,
        arrivalWindowEnd: (fd.get('arrivalWindowEnd') as string) || null,
        notes: (fd.get('notes') as string) || undefined,
      })
      setSaving(false)
      if (result.success) {
        resetAdd()
        router.refresh()
      }
    },
    [jobId, router, addTimeError, resetAdd],
  )

  const handleUpdate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!editing || editTimeError) return
      setSaving(true)
      const fd = new FormData(e.currentTarget)
      const result = await updateSiteVisit(editing.id, jobId, {
        status: (fd.get('status') as string) || undefined,
        visitDate: (fd.get('visitDate') as string) || null,
        arrivalWindowStart: (fd.get('arrivalWindowStart') as string) || null,
        arrivalWindowEnd: (fd.get('arrivalWindowEnd') as string) || null,
        notes: (fd.get('notes') as string) || undefined,
      })
      setSaving(false)
      if (result.success) {
        resetEdit()
        router.refresh()
      }
    },
    [editing, jobId, router, editTimeError, resetEdit],
  )

  const handleDelete = useCallback(
    async (visitId: string) => {
      const result = await deleteSiteVisit(visitId, jobId)
      if (result.success) {
        setDeleting(null)
        router.refresh()
      }
    },
    [jobId, router],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Additional Site Visits</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="mr-1 size-3" /> Add Visit
        </Button>
      </div>

      {/* Inline Add Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border bg-card p-4">
          <VisitFormFields
            date={addDate}
            start={addStart}
            end={addEnd}
            onDateChange={setAddDate}
            onStartChange={setAddStart}
            onEndChange={setAddEnd}
            timeError={addTimeError}
          />
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={saving || !!addTimeError}>
              <Check className="mr-1 size-3.5" />
              {saving ? 'Saving…' : 'Add Visit'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetAdd}>
              <X className="mr-1 size-3.5" /> Cancel
            </Button>
          </div>
        </form>
      )}

      {visits.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground">No additional site visits.</p>
      ) : (
        <div className="space-y-2">
          {visits.map((visit) =>
            editing?.id === visit.id ? (
              <form
                key={visit.id}
                onSubmit={handleUpdate}
                className="space-y-3 rounded-lg border bg-card p-4"
              >
                <VisitFormFields
                  initial={visit}
                  date={editDate}
                  start={editStart}
                  end={editEnd}
                  onDateChange={setEditDate}
                  onStartChange={setEditStart}
                  onEndChange={setEditEnd}
                  timeError={editTimeError}
                />
                <div className="flex items-center gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={saving || !!editTimeError}>
                    <Check className="mr-1 size-3.5" />
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={resetEdit}>
                    <X className="mr-1 size-3.5" /> Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div
                key={visit.id}
                className="flex items-start justify-between rounded-lg border bg-card p-3"
              >
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    {visit.status ? (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {visit.status
                          .split('_')
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No status</span>
                    )}
                    {visit.visitDate && (
                      <span className="text-muted-foreground">
                        {toDateInputValue(visit.visitDate)}
                      </span>
                    )}
                  </div>
                  {visit.arrivalWindowStart && (
                    <div className="text-xs text-muted-foreground">
                      Window: {toTimeInputValue(visit.arrivalWindowStart)} —{' '}
                      {toTimeInputValue(visit.arrivalWindowEnd)}
                    </div>
                  )}
                  {visit.notes && (
                    <div className="text-xs text-muted-foreground">{visit.notes}</div>
                  )}
                </div>
                <div className="inline-flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit visit"
                    onClick={() => startEditing(visit)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete visit"
                    onClick={() => setDeleting(visit)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this site visit?</DialogTitle>
            <DialogDescription>
              {deleting ? (
                <>
                  This visit on{' '}
                  {deleting.visitDate ? toDateInputValue(deleting.visitDate) : 'this date'}
                  {' '}will be removed. This can&apos;t be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) handleDelete(deleting.id)
              }}
            >
              Delete Visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VisitFormFields({
  initial,
  date,
  start,
  end,
  onDateChange,
  onStartChange,
  onEndChange,
  timeError,
}: {
  initial?: SiteVisit
  date: string
  start: string
  end: string
  onDateChange: (v: string) => void
  onStartChange: (v: string) => void
  onEndChange: (v: string) => void
  timeError: string | null
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={initial ? 'edit-visit-status' : 'visit-status'}>Status</Label>
        <select
          id={initial ? 'edit-visit-status' : 'visit-status'}
          name="status"
          defaultValue={initial?.status ?? ''}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Select status…</option>
          <optgroup label="Open">
            {STATUS_GROUPS.open.map((s) => (
              <option key={s} value={s}>
                {s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            ))}
          </optgroup>
          <optgroup label="In Progress">
            {STATUS_GROUPS.in_progress.map((s) => (
              <option key={s} value={s}>
                {s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            ))}
          </optgroup>
          <optgroup label="Closed">
            {STATUS_GROUPS.closed.map((s) => (
              <option key={s} value={s}>
                {s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={initial ? 'edit-visit-date' : 'visit-date'}>Visit Date</Label>
        <Input
          id={initial ? 'edit-visit-date' : 'visit-date'}
          name="visitDate"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium leading-none">Arrival Time Window</p>
        <TimeWindowPicker
          startValue={start}
          endValue={end}
          onStartChange={onStartChange}
          onEndChange={onEndChange}
          startName="arrivalWindowStart"
          endName="arrivalWindowEnd"
          startId={initial ? 'edit-arrivalWindowStart' : 'arrivalWindowStart'}
          endId={initial ? 'edit-arrivalWindowEnd' : 'arrivalWindowEnd'}
          error={timeError}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={initial ? 'edit-visit-notes' : 'visit-notes'}>Notes</Label>
        <textarea
          id={initial ? 'edit-visit-notes' : 'visit-notes'}
          name="notes"
          defaultValue={initial?.notes ?? ''}
          placeholder="Optional notes…"
          rows={2}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
    </>
  )
}
