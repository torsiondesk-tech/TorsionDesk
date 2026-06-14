'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toDateTimeLocalValue(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
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

  // Sync from props
  if (
    initialVisits.length !== visits.length ||
    initialVisits.some((v, i) => v.id !== visits[i]?.id)
  ) {
    setVisits(initialVisits)
  }

  const handleAdd = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
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
        setIsAdding(false)
        router.refresh()
      }
    },
    [jobId, router],
  )

  const handleUpdate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!editing) return
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
        setEditing(null)
        router.refresh()
      }
    },
    [editing, jobId, router],
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

      {visits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No additional site visits.</p>
      ) : (
        <div className="space-y-2">
          {visits.map((visit) => (
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
                    Window: {toDateTimeLocalValue(visit.arrivalWindowStart)} —{' '}
                    {toDateTimeLocalValue(visit.arrivalWindowEnd)}
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
                  onClick={() => setEditing(visit)}
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
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Site Visit</DialogTitle>
            <DialogDescription>
              Schedule an additional site visit with its own status and window.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <VisitFormFields />
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Add Visit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Site Visit</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-3">
              <VisitFormFields initial={editing} />
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

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

function VisitFormFields({ initial }: { initial?: SiteVisit }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="visit-status">Status</Label>
        <select
          id="visit-status"
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
        <Label htmlFor="visit-date">Visit Date</Label>
        <Input
          id="visit-date"
          name="visitDate"
          type="date"
          defaultValue={toDateInputValue(initial?.visitDate ?? null)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="visit-window-start">Window Start</Label>
          <Input
            id="visit-window-start"
            name="arrivalWindowStart"
            type="datetime-local"
            defaultValue={toDateTimeLocalValue(initial?.arrivalWindowStart ?? null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="visit-window-end">Window End</Label>
          <Input
            id="visit-window-end"
            name="arrivalWindowEnd"
            type="datetime-local"
            defaultValue={toDateTimeLocalValue(initial?.arrivalWindowEnd ?? null)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="visit-notes">Notes</Label>
        <textarea
          id="visit-notes"
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
