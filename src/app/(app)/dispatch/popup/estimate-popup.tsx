'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Eye,
  Pencil,
  Send,
  FileCheck,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  FileText,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  DollarSign,
  Check,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { cn, formatPhone, toISODate } from '@/lib/utils'
import { estimateStatusLabel } from '@/lib/estimates/status'
import {
  updateEstimateStatus,
  updateEstimateDescription,
  updateEstimateNotesForTechs,
  updateEstimateOnSiteDate,
  updateEstimateArrivalWindow,
  updateEstimateAssigneesAction,
} from '@/app/(app)/dispatch/actions'
import type {
  WeekEstimate,
  Technician,
  EstimatePopupData,
} from '@/app/(app)/dispatch/actions'

// ── Allowed transitions map (mirrors server-side) ────────────────────────────
const ALLOWED: Record<string, { value: string; label: string }[]> = {
  estimate_requested: [
    { value: 'estimate_provided',  label: 'Provided' },
    { value: 'estimate_accepted',  label: 'Accepted' },
    { value: 'estimate_won',       label: 'Won' },
    { value: 'estimate_lost',      label: 'Lost' },
  ],
  estimate_provided: [
    { value: 'estimate_accepted',  label: 'Accepted' },
    { value: 'estimate_won',       label: 'Won' },
    { value: 'estimate_lost',      label: 'Lost' },
  ],
  estimate_accepted: [
    { value: 'estimate_won',       label: 'Won' },
    { value: 'estimate_lost',      label: 'Lost' },
  ],
  estimate_won:  [],
  estimate_lost: [],
}

// ── Status pill ──────────────────────────────────────────────────────────────
function statusPillClass(status: string): string {
  switch (status) {
    case 'estimate_won':      return 'bg-green-600 text-white'
    case 'estimate_lost':     return 'bg-red-600 text-white'
    case 'estimate_accepted': return 'bg-teal-600 text-white'
    case 'estimate_provided': return 'bg-blue-600 text-white'
    default:                  return 'bg-slate-500 text-white'
  }
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusPillClass(status))}>
      {estimateStatusLabel(status)}
    </span>
  )
}

// ── Formatting helpers ───────────────────────────────────────────────────────
function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime24(d: Date | string | null): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function fmtTime12(d: Date | string | null): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatWindow(start: Date | string | null, end: Date | string | null): string {
  const s = fmtTime12(start)
  const e = fmtTime12(end)
  if (!s && !e) return '—'
  return s && e ? `${s} to ${e}` : s || e
}

function fmtCurrency(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

// ── Sidebar action button ────────────────────────────────────────────────────
function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = 'outline',
}: {
  icon: React.ElementType
  label: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'outline' | 'default' | 'destructive'
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      className="w-full justify-start gap-2 text-xs h-8 px-2"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </Button>
  )
}

// ── Read-only info row ───────────────────────────────────────────────────────
function InlineRow({
  icon: Icon,
  label,
  value,
  subLines,
  children,
}: {
  icon: React.ElementType
  label: string
  value?: React.ReactNode
  subLines?: React.ReactNode[]
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <Icon className="mt-0.5 size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {children ?? (
          <>
            <div className="text-sm font-medium">
              {value ?? <span className="text-muted-foreground/60">Not Set</span>}
            </div>
            {subLines?.map((line, i) => (
              <div key={i} className="text-xs text-muted-foreground">{line}</div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Status dropdown ──────────────────────────────────────────────────────────
function StatusSelect({ estimateId, currentStatus }: { estimateId: string; currentStatus: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const options = ALLOWED[status] ?? []

  const handleChange = (nextStatus: string | null) => {
    if (!nextStatus || nextStatus === status) return
    setError(null)
    startTransition(async () => {
      const result = await updateEstimateStatus({ estimateId, toStatus: nextStatus })
      if (result.error) {
        setError(result.error)
      } else {
        setStatus(nextStatus)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5 items-start">
      <StatusPill status={status} />
      {options.length > 0 && (
        <Select value="" onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="w-full h-8 text-xs mt-1">
            <SelectValue placeholder="Change status…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Change to</SelectLabel>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
interface EstimatePopupProps {
  estimate: WeekEstimate | null
  techs: Technician[]
  open: boolean
  onClose: () => void
  popupData?: EstimatePopupData | null
}

export function EstimatePopup({ estimate, techs, open, onClose, popupData }: EstimatePopupProps) {
  const router = useRouter()

  const [localEstimate, setLocalEstimate] = useState<WeekEstimate | null>(estimate)
  const [localPopupData, setLocalPopupData] = useState<EstimatePopupData | null>(popupData ?? null)

  useEffect(() => {
    setLocalEstimate(estimate)
    setLocalPopupData(popupData ?? null)
  }, [estimate, popupData])

  // ── Editing state ──
  const [editingDesc, setEditingDesc] = useState(false)
  const [draftDesc, setDraftDesc] = useState(estimate?.description ?? '')
  const [savingDesc, startSaveDesc] = useTransition()

  const [editingNotes, setEditingNotes] = useState(false)
  const [draftNotes, setDraftNotes] = useState(popupData?.notesForTechs ?? '')
  const [savingNotes, startSaveNotes] = useTransition()

  const [editingDate, setEditingDate] = useState(false)
  const [draftDate, setDraftDate] = useState(
    estimate?.startDate ? toISODate(estimate.startDate) : '',
  )
  const [savingDate, startSaveDate] = useTransition()

  const [editingWindow, setEditingWindow] = useState(false)
  const [draftWindowStart, setDraftWindowStart] = useState(fmtTime24(estimate?.arrivalWindowStart ?? null))
  const [draftWindowEnd, setDraftWindowEnd] = useState(fmtTime24(estimate?.arrivalWindowEnd ?? null))
  const [savingWindow, startSaveWindow] = useTransition()

  const [editingTechs, setEditingTechs] = useState(false)
  const [draftTechIds, setDraftTechIds] = useState<string[]>(estimate?.techIds ?? [])
  const [savingTechs, startSaveTechs] = useTransition()

  // Safe null guard AFTER all hooks
  if (!estimate || !localEstimate) return null

  const isTerminal = ['estimate_won', 'estimate_lost'].includes(localEstimate.status)
  const editHref = `/estimates/${localEstimate.id}`

  const techNames =
    localEstimate.techIds.map((id) => techs.find((t) => t.userId === id)?.name ?? 'Tech').join(', ') ||
    'Unassigned'

  const refresh = () => router.refresh()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden flex flex-col max-h-[90dvh] sm:max-w-2xl lg:max-w-5xl"
        showCloseButton={false}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-amber-50/60 shrink-0">
          <DialogTitle className="text-sm font-semibold">
            Estimate Detail (EST-{localEstimate.estimateNo})
          </DialogTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* ── Left sidebar (desktop) ── */}
          <div className="hidden sm:flex sm:flex-col w-[150px] border-r bg-muted/20 p-2 space-y-1 shrink-0">
            <ActionButton icon={Eye} label="View Details" onClick={() => router.push(editHref)} />
            <ActionButton icon={Pencil} label="Make Changes" onClick={() => router.push(`${editHref}?edit=true`)} />
            <ActionButton icon={Send} label="Send Estimate" disabled />
            <ActionButton icon={FileCheck} label="Convert to Job" disabled={isTerminal} onClick={() => router.push(`${editHref}?convert=true`)} />
            <ActionButton
              icon={ThumbsUp}
              label="Mark Won"
              disabled={isTerminal || !ALLOWED[localEstimate.status]?.some((o) => o.value === 'estimate_won')}
              onClick={async () => {
                const r = await updateEstimateStatus({ estimateId: estimate.id, toStatus: 'estimate_won' })
                if (!r.error) { setLocalEstimate((e) => e ? { ...e, status: 'estimate_won' } : e); refresh() }
              }}
            />
            <ActionButton
              icon={ThumbsDown}
              label="Mark Lost"
              disabled={isTerminal || !ALLOWED[localEstimate.status]?.some((o) => o.value === 'estimate_lost')}
              onClick={async () => {
                const r = await updateEstimateStatus({ estimateId: estimate.id, toStatus: 'estimate_lost' })
                if (!r.error) { setLocalEstimate((e) => e ? { ...e, status: 'estimate_lost' } : e); refresh() }
              }}
            />
            <ActionButton icon={ArrowLeft} label="Exit" onClick={onClose} />
          </div>

          {/* ── Main content ── */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* ── Customer info card ── */}
              <div className="rounded-lg border bg-background overflow-hidden">
                <div className="p-3 border-b bg-muted/20">
                  <div className="font-semibold text-sm">{localEstimate.customerName}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Status:</span>
                    <StatusPill status={localEstimate.status} />
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  <InlineRow icon={User} label="Customer" value={localEstimate.customerName} />
                  <InlineRow
                    icon={Phone}
                    label="Primary Contact"
                    value={localPopupData?.contactName || localEstimate.customerName}
                    subLines={[
                      localPopupData?.customerPhone && `${formatPhone(localPopupData.customerPhone)} (Mobile)`,
                      localPopupData?.contactEmail,
                    ].filter(Boolean) as React.ReactNode[]}
                  />
                  <InlineRow
                    icon={MapPin}
                    label="Service Address"
                    value={localPopupData?.fullAddress || localEstimate.address || undefined}
                  />

                  {/* Description */}
                  <div className="flex items-start gap-3 px-3 py-2">
                    <FileText className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">Description</div>
                      {editingDesc ? (
                        <div className="mt-1 space-y-2">
                          <Textarea
                            value={draftDesc}
                            onChange={(e) => setDraftDesc(e.target.value)}
                            className="min-h-[60px] text-xs"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={savingDesc}
                              onClick={() => {
                                startSaveDesc(async () => {
                                  const r = await updateEstimateDescription({ estimateId: estimate.id, description: draftDesc || null })
                                  if (r.success) {
                                    setLocalEstimate((e) => e ? { ...e, description: draftDesc || null } : e)
                                    setEditingDesc(false)
                                    refresh()
                                  }
                                })
                              }}
                            >
                              <Check className="size-3 mr-1" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={savingDesc} onClick={() => { setDraftDesc(localEstimate.description ?? ''); setEditingDesc(false) }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium">{localEstimate.description || <span className="text-muted-foreground/60">Not Set</span>}</div>
                          <button onClick={() => { setDraftDesc(localEstimate.description ?? ''); setEditingDesc(true) }} className="text-xs text-blue-600 hover:underline">[edit]</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <InlineRow
                    icon={DollarSign}
                    label="Estimate Total"
                    value={fmtCurrency(localPopupData?.totalAmount ?? null)}
                  />
                </div>
              </div>

              {/* ── Map placeholder ── */}
              <div className="hidden sm:block rounded-lg border bg-muted min-h-[200px] relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-sm text-muted-foreground">
                    <MapPin className="mx-auto size-8 mb-2 opacity-40" />
                    <p>Map integration</p>
                    <p className="text-xs">(Phase 8)</p>
                  </div>
                </div>
              </div>

              {/* ── Estimate details card ── */}
              <div className="rounded-lg border bg-background overflow-hidden">
                <div className="p-3 border-b bg-muted/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimate Details</div>
                </div>
                <div className="divide-y divide-border/50">

                  {/* Status */}
                  <div className="flex items-start gap-3 px-3 py-2">
                    <Calendar className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">Current Status</div>
                      <StatusSelect estimateId={localEstimate.id} currentStatus={localEstimate.status} />
                    </div>
                  </div>

                  {/* On-site date */}
                  <div className="flex items-start gap-3 px-3 py-2">
                    <Calendar className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">On-Site Date</div>
                      {editingDate ? (
                        <div className="mt-1 space-y-2">
                          <Input
                            type="date"
                            value={draftDate}
                            onChange={(e) => setDraftDate(e.target.value)}
                            className="h-8 text-xs w-[140px]"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={savingDate}
                              onClick={() => {
                                startSaveDate(async () => {
                                  const r = await updateEstimateOnSiteDate({ estimateId: estimate.id, date: draftDate || null })
                                  if (r.success) {
                                    setLocalEstimate((e) => e ? { ...e, startDate: draftDate ? new Date(`${draftDate}T00:00:00`) : null } : e)
                                    setEditingDate(false)
                                    refresh()
                                  }
                                })
                              }}
                            >
                              <Check className="size-3 mr-1" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={savingDate} onClick={() => { setDraftDate(localEstimate.startDate ? toISODate(localEstimate.startDate) : ''); setEditingDate(false) }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium">{fmtDate(localEstimate.startDate)}</div>
                          <button onClick={() => { setDraftDate(localEstimate.startDate ? toISODate(localEstimate.startDate) : ''); setEditingDate(true) }} className="text-xs text-blue-600 hover:underline">[edit]</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Arrival window */}
                  <div className="flex items-start gap-3 px-3 py-2">
                    <Clock className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">Arrival Time Window</div>
                      {editingWindow ? (
                        <div className="mt-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Input type="time" value={draftWindowStart} onChange={(e) => setDraftWindowStart(e.target.value)} className="h-8 text-xs w-[100px]" />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input type="time" value={draftWindowEnd} onChange={(e) => setDraftWindowEnd(e.target.value)} className="h-8 text-xs w-[100px]" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={savingWindow}
                              onClick={() => {
                                startSaveWindow(async () => {
                                  const r = await updateEstimateArrivalWindow({
                                    estimateId: estimate.id,
                                    arrivalWindowStart: draftWindowStart || null,
                                    arrivalWindowEnd: draftWindowEnd || null,
                                  })
                                  if (r.success) {
                                    const toDateTime = (t: string | null) => {
                                      if (!t) return null
                                      const [h, m] = t.split(':').map(Number)
                                      const d = new Date(); d.setHours(h, m, 0, 0); return d
                                    }
                                    setLocalEstimate((e) => e ? { ...e, arrivalWindowStart: toDateTime(draftWindowStart), arrivalWindowEnd: toDateTime(draftWindowEnd) } : e)
                                    setEditingWindow(false)
                                    refresh()
                                  }
                                })
                              }}
                            >
                              <Check className="size-3 mr-1" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={savingWindow} onClick={() => { setDraftWindowStart(fmtTime24(localEstimate.arrivalWindowStart)); setDraftWindowEnd(fmtTime24(localEstimate.arrivalWindowEnd)); setEditingWindow(false) }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium">{formatWindow(localEstimate.arrivalWindowStart, localEstimate.arrivalWindowEnd)}</div>
                          <button onClick={() => { setDraftWindowStart(fmtTime24(localEstimate.arrivalWindowStart)); setDraftWindowEnd(fmtTime24(localEstimate.arrivalWindowEnd)); setEditingWindow(true) }} className="text-xs text-blue-600 hover:underline">[edit]</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Assigned techs */}
                  <div className="flex items-start gap-3 px-3 py-2">
                    <Users className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">Assigned Tech</div>
                      {editingTechs ? (
                        <div className="mt-1 space-y-2">
                          <div className="space-y-1">
                            {techs.map((t) => (
                              <label key={t.userId} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={draftTechIds.includes(t.userId)}
                                  onChange={() =>
                                    setDraftTechIds((prev) =>
                                      prev.includes(t.userId) ? prev.filter((id) => id !== t.userId) : [...prev, t.userId],
                                    )
                                  }
                                  className="size-3.5"
                                />
                                {t.name}
                              </label>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={savingTechs}
                              onClick={() => {
                                startSaveTechs(async () => {
                                  const r = await updateEstimateAssigneesAction({ estimateId: estimate.id, techUserIds: draftTechIds })
                                  if (r.success) {
                                    setLocalEstimate((e) => e ? { ...e, techIds: draftTechIds } : e)
                                    setEditingTechs(false)
                                    refresh()
                                  }
                                })
                              }}
                            >
                              <Check className="size-3 mr-1" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={savingTechs} onClick={() => { setDraftTechIds(localEstimate.techIds); setEditingTechs(false) }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium">{techNames}</div>
                          <button onClick={() => { setDraftTechIds(localEstimate.techIds); setEditingTechs(true) }} className="text-xs text-blue-600 hover:underline">[edit]</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes for techs */}
                  <div className="flex items-start gap-3 px-3 py-2">
                    <AlertTriangle className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">Notes For Techs</div>
                      {editingNotes ? (
                        <div className="mt-1 space-y-2">
                          <Textarea value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} className="min-h-[60px] text-xs" />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={savingNotes}
                              onClick={() => {
                                startSaveNotes(async () => {
                                  const r = await updateEstimateNotesForTechs({ estimateId: estimate.id, notesForTechs: draftNotes || null })
                                  if (r.success) {
                                    setLocalPopupData((p) => p ? { ...p, notesForTechs: draftNotes || null } : p)
                                    setEditingNotes(false)
                                    refresh()
                                  }
                                })
                              }}
                            >
                              <Check className="size-3 mr-1" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={savingNotes} onClick={() => { setDraftNotes(localPopupData?.notesForTechs ?? ''); setEditingNotes(false) }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium">{localPopupData?.notesForTechs || <span className="text-muted-foreground/60">Not Set</span>}</div>
                          <button onClick={() => { setDraftNotes(localPopupData?.notesForTechs ?? ''); setEditingNotes(true) }} className="text-xs text-blue-600 hover:underline">[edit]</button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile bottom bar ── */}
        <div className="flex sm:hidden items-center gap-2 p-2 border-t shrink-0">
          <Button variant="outline" size="sm" className="flex-1 justify-center gap-1.5 text-xs" onClick={() => router.push(editHref)}>
            <Eye className="size-3.5" /> View
          </Button>
          <Button variant="outline" size="sm" className="flex-1 justify-center gap-1.5 text-xs" onClick={() => router.push(`${editHref}?edit=true`)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onClose}>
            <ArrowLeft className="size-3.5" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
