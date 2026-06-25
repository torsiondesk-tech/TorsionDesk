'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import {
  X,
  Eye,
  Pencil,
  DollarSign,
  FileCheck,
  Ban,
  Mail,
  Printer,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  FileText,
  Tag,
  Briefcase,
  CreditCard,
  Receipt,
  ShieldCheck,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  ClipboardList,
  Route,
  Check,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TimeWindowPicker } from '@/components/ui/time-window-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import type { ParsedAddress } from '@/lib/places-actions'
import { cn, formatPhone, toISODate } from '@/lib/utils'
import {
  ALLOWED_TRANSITIONS,
  STATUS_GROUPS,
  statusLabel,
  type JobStatusValue,
} from '@/lib/jobs/transitions'
import {
  transitionJobStatusAction,
  updateJobDescription,
  updateJobPONumber,
  updateJobNotesForTechs,
  updateJobEstimatedDuration,
  updateJobDates,
  updateJobArrivalWindow,
  updateJobAssignees,
  updateJobServiceLocation,
  createServiceLocationForJob,
} from '@/app/(app)/dispatch/actions'
import { createInvoiceFromJobAction } from '@/app/(app)/invoices/actions'
import { toast } from 'sonner'
import type {
  WeekJob,
  Technician,
  PopupData,
  CustomerLocation,
} from '@/app/(app)/dispatch/actions'

interface DispatchPopupProps {
  job: WeekJob | null
  techs: Technician[]
  open: boolean
  onClose: () => void
  popupData?: PopupData | null
}

/* ── Status pill colours ── */
function statusPillClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-purple-600 text-white'
    case 'paid_in_full':
      return 'bg-green-600 text-white'
    case 'invoiced':
      return 'bg-teal-600 text-white'
    case 'cancelled':
      return 'bg-red-600 text-white'
    case 'job_closed':
      return 'bg-slate-600 text-white'
    default:
      return 'bg-blue-600 text-white'
  }
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusPillClass(status),
      )}
    >
      {statusLabel(status)}
    </span>
  )
}

/* ── Location label helpers ── */
function isRedundantLocationName(
  name: string | null,
  addressLine1: string | null,
  city: string | null,
): boolean {
  if (!name || !addressLine1) return true
  const n = name.trim().toLowerCase().replace(/,\s*/g, ',')
  const a1 = addressLine1.trim().toLowerCase()
  const a1City = [addressLine1, city].filter(Boolean).join(', ').toLowerCase().replace(/,\s*/g, ',')
  return n === a1 || n === a1City || n.startsWith(a1 + ',')
}

function buildLocationLabel(loc: CustomerLocation): string {
  const cityStateZip = [loc.city, loc.state, loc.postalCode].filter(Boolean).join(' ')
  const addrFull = loc.addressLine1
    ? `${loc.addressLine1}${cityStateZip ? `, ${cityStateZip}` : ''}`
    : cityStateZip
  const hasName = !isRedundantLocationName(loc.name, loc.addressLine1, loc.city ?? null)
  if (hasName) return addrFull ? `${loc.name} — ${addrFull}` : (loc.name ?? loc.id)
  return addrFull || loc.id
}

function buildFullAddress(loc: CustomerLocation): string {
  return [loc.addressLine1, loc.addressLine2, loc.city, loc.state, loc.postalCode]
    .filter(Boolean)
    .join(', ')
}

/* ── Formatting helpers ── */
function formatBillingType(type: string | null): string {
  if (!type) return 'Not Set'
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function fmtTime24(d: Date | string | null): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  const h = String(date.getUTCHours()).padStart(2, '0')
  const m = String(date.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function fmtTime12(d: Date | string | null): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
}

function formatWindow(start: Date | string | null, end: Date | string | null): string {
  const s = fmtTime12(start)
  const e = fmtTime12(end)
  if (!s && !e) return '—'
  return s && e ? `${s} to ${e}` : s || e
}

/* ── Sidebar action button ── */
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

/* ── Status dropdown ── */
function StatusSelect({ jobId, currentStatus }: { jobId: string; currentStatus: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const legal = ALLOWED_TRANSITIONS[status as JobStatusValue] ?? []
  const openLegal = legal.filter((s) =>
    (STATUS_GROUPS.open as readonly string[]).includes(s),
  )
  const inProgressLegal = legal.filter((s) =>
    (STATUS_GROUPS.in_progress as readonly string[]).includes(s),
  )
  const closedLegal = legal.filter((s) =>
    (STATUS_GROUPS.closed as readonly string[]).includes(s),
  )

  const handleChange = (nextStatus: string | null) => {
    if (!nextStatus || nextStatus === status) return
    setError(null)
    startTransition(async () => {
      const result = await transitionJobStatusAction({ jobId, toStatus: nextStatus })
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
      {legal.length > 0 && (
        <Select value="" onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="w-full h-8 text-xs mt-1">
            <SelectValue placeholder="Change status…" />
          </SelectTrigger>
          <SelectContent>
            {openLegal.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Open</SelectLabel>
                {openLegal.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                ))}
              </SelectGroup>
            )}
            {inProgressLegal.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wide">In Progress</SelectLabel>
                {inProgressLegal.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                ))}
              </SelectGroup>
            )}
            {closedLegal.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Closed</SelectLabel>
                {closedLegal.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

/* ── Inline editable row component ── */
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

export function DispatchPopup({ job, techs, open, onClose, popupData }: DispatchPopupProps) {
  const router = useRouter()
  const { orgId } = useAuth()

  // ── Local copies of props (synced via effect) ──
  const [localJob, setLocalJob] = useState<WeekJob | null>(job)
  const [localPopupData, setLocalPopupData] = useState<PopupData | null>(popupData ?? null)

  useEffect(() => {
    setLocalJob(job)
    setLocalPopupData(popupData ?? null)
  }, [job, popupData])

  // ── Inline editing states ──
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationMode, setLocationMode] = useState<'select' | 'new'>('select')
  const [draftLocation, setDraftLocation] = useState(popupData?.serviceLocationId ?? '')
  const [newLocName, setNewLocName] = useState('')
  const [newLocGated, setNewLocGated] = useState(false)
  const [newLocAddr, setNewLocAddr] = useState({
    addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '',
    lat: null as string | null, lng: null as string | null,
  })
  const [newLocError, setNewLocError] = useState<string | null>(null)
  const [savingLocation, startSaveLocation] = useTransition()

  const [editingDesc, setEditingDesc] = useState(false)
  const [draftDesc, setDraftDesc] = useState(job?.description ?? '')
  const [savingDesc, startSaveDesc] = useTransition()

  const [editingPO, setEditingPO] = useState(false)
  const [draftPO, setDraftPO] = useState(popupData?.poNumber ?? '')
  const [savingPO, startSavePO] = useTransition()

  const [editingDates, setEditingDates] = useState(false)
  const [draftStartDate, setDraftStartDate] = useState(
    job?.startDate ? toISODate(job.startDate) : '',
  )
  const [draftEndDate, setDraftEndDate] = useState(
    popupData?.endDate ? toISODate(popupData.endDate) : '',
  )
  const [isMultiDay, setIsMultiDay] = useState(!!popupData?.endDate)
  const [savingDates, startSaveDates] = useTransition()

  const [editingDuration, setEditingDuration] = useState(false)
  const [draftDuration, setDraftDuration] = useState(
    popupData?.estimatedDuration?.toString() ?? '',
  )
  const [savingDuration, startSaveDuration] = useTransition()

  const [editingWindow, setEditingWindow] = useState(false)
  const [draftWindowStart, setDraftWindowStart] = useState(fmtTime24(job?.arrivalWindowStart ?? null))
  const [draftWindowEnd, setDraftWindowEnd] = useState(fmtTime24(job?.arrivalWindowEnd ?? null))
  const [savingWindow, startSaveWindow] = useTransition()

  const [editingTechs, setEditingTechs] = useState(false)
  const [draftTechIds, setDraftTechIds] = useState<string[]>(job?.techIds ?? [])
  const [savingTechs, startSaveTechs] = useTransition()

  const [editingNotes, setEditingNotes] = useState(false)
  const [draftNotes, setDraftNotes] = useState(popupData?.notesForTechs ?? '')
  const [savingNotes, startSaveNotes] = useTransition()

  // ── Safe null return AFTER all hooks ──
  if (!job || !localJob) return null

  const techNames =
    localJob.techIds
      .map((id) => techs.find((t) => t.userId === id)?.name ?? 'Technician')
      .join(', ') || 'Unassigned'

  const isCancelled = localJob.status === 'cancelled'
  const isClosed = ['invoiced', 'paid_in_full', 'job_closed'].includes(localJob.status)
  const editHref = `/jobs/${localJob.id}`

  const refresh = () => router.refresh()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden flex flex-col max-h-[90dvh] sm:max-w-2xl lg:max-w-5xl" showCloseButton={false}>
        {/* ── Header bar ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 shrink-0">
          <DialogTitle className="text-sm font-semibold">
            Detailed Job View (#{localJob.jobNo})
          </DialogTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* ── Left sidebar: actions — desktop only ── */}
          <div className="hidden sm:flex sm:flex-col w-[150px] border-r bg-muted/20 p-2 space-y-1 shrink-0">
            <ActionButton icon={Route} label="Dispatch" disabled />
            <ActionButton icon={Eye} label="View Details" onClick={() => router.push(editHref)} />
            <ActionButton icon={Pencil} label="Make Changes" onClick={() => router.push(`${editHref}?edit=true`)} />
            <ActionButton
              icon={DollarSign}
              label="Deposits"
              disabled={isClosed || isCancelled}
              onClick={() => router.push(`/payments/new?jobId=${localJob.id}&type=deposit${localPopupData?.customerId ? `&customerId=${localPopupData.customerId}` : ''}`)}
            />
            <ActionButton
              icon={FileCheck}
              label="Close & Invoice"
              disabled={isClosed || isCancelled || localJob.status !== 'completed'}
              onClick={async () => {
                if (!orgId) {
                  toast.error('No active organization.')
                  return
                }
                const result = await createInvoiceFromJobAction(orgId, localJob.id)
                if (result.error) {
                  toast.error(result.error)
                  return
                }
                toast.success(`Invoice #INV-${result.invoiceNo} created.`)
                router.push(`/invoices/${result.invoiceId}`)
                router.refresh()
              }}
            />
            <ActionButton icon={Ban} label="Cancel This Job" disabled />
            <ActionButton icon={Mail} label="Email" disabled />
            <ActionButton icon={Printer} label="Print" disabled />
            <ActionButton icon={ArrowLeft} label="Exit" onClick={onClose} />
          </div>

          {/* ── Main content ── */}
          <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── Customer Info Card ── */}
            <div className="rounded-lg border bg-background overflow-hidden">
              <div className="p-3 border-b bg-muted/20">
                <div className="font-semibold text-sm">{localJob.customerName}&apos;s Current</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Status:</span>
                  <StatusPill status={localJob.status} />
                </div>
              </div>
              <div className="divide-y divide-border/50">
                <InlineRow icon={User} label="Customer" value={localJob.customerName} />
                <InlineRow
                  icon={Phone}
                  label="Primary Contact"
                  value={localPopupData?.contactName || localJob.customerName}
                  subLines={
                    [
                      localPopupData?.customerPhone && `${formatPhone(localPopupData.customerPhone)} (Mobile)`,
                      localPopupData?.contactEmail,
                    ].filter(Boolean) as React.ReactNode[]
                  }
                />

                {/* Service Location */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <MapPin className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Service Location</div>
                    {editingLocation ? (
                      <div className="mt-1 space-y-2">
                        {locationMode === 'select' ? (
                          <>
                            <Select
                              value={draftLocation}
                              onValueChange={(v) => {
                                if (v === '__new__') {
                                  setLocationMode('new')
                                  setNewLocName('')
                                  setNewLocGated(false)
                                  setNewLocAddr({ addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', lat: null, lng: null })
                                  setNewLocError(null)
                                } else {
                                  setDraftLocation(v ?? '')
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs w-full">
                                <SelectValue placeholder="Select location…">
                                  {(() => {
                                    if (!draftLocation) return null
                                    const loc = localPopupData?.customerLocations.find(l => l.id === draftLocation)
                                    return loc ? buildLocationLabel(loc) : null
                                  })()}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="min-w-[300px]">
                                {(localPopupData?.customerLocations ?? []).map((loc) => {
                                  const hasName = !isRedundantLocationName(loc.name, loc.addressLine1 ?? null, loc.city ?? null)
                                  const addrLine = [loc.addressLine1, loc.city, loc.state].filter(Boolean).join(', ')
                                  return (
                                    <SelectItem key={loc.id} value={loc.id}>
                                      <span className="flex flex-col whitespace-normal leading-snug py-0.5">
                                        {hasName && (
                                          <span className="font-medium">{loc.name}{loc.isPrimary ? ' ★' : ''}</span>
                                        )}
                                        <span className={hasName ? 'text-xs text-muted-foreground' : ''}>
                                          {addrLine || loc.id}{!hasName && loc.isPrimary ? ' ★' : ''}
                                        </span>
                                      </span>
                                    </SelectItem>
                                  )
                                })}
                                <SelectItem value="__new__" className="text-blue-600 font-medium">
                                  + Add new address…
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={savingLocation}
                                onClick={() => {
                                  startSaveLocation(async () => {
                                    const r = await updateJobServiceLocation({
                                      jobId: localJob.id,
                                      serviceLocationId: draftLocation || null,
                                    })
                                    if (r.success) {
                                      const loc = localPopupData?.customerLocations.find(l => l.id === draftLocation)
                                      setLocalPopupData((prev) =>
                                        prev ? {
                                          ...prev,
                                          serviceLocationId: draftLocation || null,
                                          fullAddress: loc ? buildFullAddress(loc) : prev.fullAddress,
                                        } : prev,
                                      )
                                      setEditingLocation(false)
                                      refresh()
                                    }
                                  })
                                }}
                              >
                                <Check className="size-3 mr-1" /> Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={savingLocation}
                                onClick={() => {
                                  setDraftLocation(localPopupData?.serviceLocationId ?? '')
                                  setEditingLocation(false)
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </>
                        ) : (
                          /* ── New address form ── */
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Location Name (optional)</Label>
                              <Input
                                value={newLocName}
                                onChange={(e) => setNewLocName(e.target.value)}
                                placeholder="e.g. Main House, Warehouse…"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Street Address</Label>
                              <AddressAutocomplete
                                defaultValue={newLocAddr.addressLine1}
                                onAddressSelect={(parsed: ParsedAddress) =>
                                  setNewLocAddr((a) => ({
                                    ...a,
                                    addressLine1: parsed.addressLine1,
                                    city: parsed.city,
                                    state: parsed.state,
                                    postalCode: parsed.postalCode,
                                    lat: parsed.latitude,
                                    lng: parsed.longitude,
                                  }))
                                }
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Unit / Suite</Label>
                                <Input
                                  value={newLocAddr.addressLine2}
                                  onChange={(e) => setNewLocAddr((a) => ({ ...a, addressLine2: e.target.value }))}
                                  placeholder="Apt, Suite…"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">City</Label>
                                <Input
                                  value={newLocAddr.city}
                                  onChange={(e) => setNewLocAddr((a) => ({ ...a, city: e.target.value }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">State</Label>
                                <Input
                                  value={newLocAddr.state}
                                  onChange={(e) => setNewLocAddr((a) => ({ ...a, state: e.target.value }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Zip</Label>
                                <Input
                                  value={newLocAddr.postalCode}
                                  onChange={(e) => setNewLocAddr((a) => ({ ...a, postalCode: e.target.value }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <Checkbox
                                checked={newLocGated}
                                onCheckedChange={(v) => setNewLocGated(v === true)}
                              />
                              Gated Property
                            </label>
                            {newLocError && (
                              <p role="alert" className="text-xs text-destructive">{newLocError}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={savingLocation || !newLocAddr.addressLine1}
                                onClick={() => {
                                  if (!newLocAddr.addressLine1) {
                                    setNewLocError('Street address is required')
                                    return
                                  }
                                  if (!localPopupData?.customerId) return
                                  setNewLocError(null)
                                  startSaveLocation(async () => {
                                    const r = await createServiceLocationForJob({
                                      jobId: localJob.id,
                                      customerId: localPopupData.customerId!,
                                      name: newLocName.trim() || null,
                                      addressLine1: newLocAddr.addressLine1,
                                      addressLine2: newLocAddr.addressLine2 || null,
                                      city: newLocAddr.city || null,
                                      state: newLocAddr.state || null,
                                      postalCode: newLocAddr.postalCode || null,
                                      gated: newLocGated,
                                      latitude: newLocAddr.lat,
                                      longitude: newLocAddr.lng,
                                    })
                                    if (r.error) {
                                      setNewLocError(r.error)
                                      return
                                    }
                                    const newLoc: CustomerLocation = {
                                      id: r.id,
                                      name: newLocName.trim() || null,
                                      addressLine1: newLocAddr.addressLine1,
                                      addressLine2: newLocAddr.addressLine2 || null,
                                      city: newLocAddr.city || null,
                                      state: newLocAddr.state || null,
                                      postalCode: newLocAddr.postalCode || null,
                                      gated: newLocGated,
                                      isPrimary: false,
                                    }
                                    setLocalPopupData((prev) =>
                                      prev ? {
                                        ...prev,
                                        serviceLocationId: r.id,
                                        fullAddress: buildFullAddress(newLoc),
                                        customerLocations: [...prev.customerLocations, newLoc],
                                      } : prev,
                                    )
                                    setDraftLocation(r.id)
                                    setLocationMode('select')
                                    setEditingLocation(false)
                                    refresh()
                                  })
                                }}
                              >
                                <Check className="size-3 mr-1" /> Save & Assign
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={savingLocation}
                                onClick={() => {
                                  setLocationMode('select')
                                  setNewLocError(null)
                                }}
                              >
                                Back
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium">
                          {(() => {
                            const addr = localPopupData?.fullAddress || localJob.address
                            if (!addr) return <span className="text-muted-foreground/60">Not Set</span>
                            return (
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {addr}
                              </a>
                            )
                          })()}
                        </div>
                        <button
                          onClick={() => {
                            setDraftLocation(localPopupData?.serviceLocationId ?? '')
                            setLocationMode('select')
                            setEditingLocation(true)
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [edit]
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Job Description */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <FileText className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Job Description</div>
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
                                const r = await updateJobDescription({
                                  jobId: localJob.id,
                                  description: draftDesc || null,
                                })
                                if (r.success) {
                                  setLocalJob((j) => ({ ...j!, description: draftDesc || null }))
                                  setEditingDesc(false)
                                  refresh()
                                }
                              })
                            }}
                          >
                            <Check className="size-3 mr-1" /> Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingDesc}
                            onClick={() => {
                              setDraftDesc(localJob.description ?? '')
                              setEditingDesc(false)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium">{localJob.description || <span className="text-muted-foreground/60">Not Set</span>}</div>
                        <button
                          onClick={() => {
                            setDraftDesc(localJob.description ?? '')
                            setEditingDesc(true)
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [edit]
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* PO # */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <Tag className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">PO #</div>
                    {editingPO ? (
                      <div className="mt-1 space-y-2">
                        <Input
                          value={draftPO}
                          onChange={(e) => setDraftPO(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingPO}
                            onClick={() => {
                              startSavePO(async () => {
                                const r = await updateJobPONumber({
                                  jobId: localJob.id,
                                  poNumber: draftPO || null,
                                })
                                if (r.success) {
                                  setLocalPopupData((prev) =>
                                    prev ? { ...prev, poNumber: draftPO || null } : prev,
                                  )
                                  setEditingPO(false)
                                  refresh()
                                }
                              })
                            }}
                          >
                            <Check className="size-3 mr-1" /> Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingPO}
                            onClick={() => {
                              setDraftPO(localPopupData?.poNumber ?? '')
                              setEditingPO(false)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium">{localPopupData?.poNumber || <span className="text-muted-foreground/60">Not Set</span>}</div>
                        <button
                          onClick={() => {
                            setDraftPO(localPopupData?.poNumber ?? '')
                            setEditingPO(true)
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [edit]
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Map placeholder — hidden on mobile (Phase 8) ── */}
            <div className="hidden sm:block rounded-lg border bg-muted min-h-[200px] relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-sm text-muted-foreground">
                  <MapPin className="mx-auto size-8 mb-2 opacity-40" />
                  <p>Map integration</p>
                  <p className="text-xs">(Phase 8)</p>
                </div>
              </div>
            </div>

            {/* ── Billing section ── */}
            <div className="rounded-lg border bg-background overflow-hidden">
              <div className="p-3 border-b bg-muted/20">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing</div>
              </div>
              <div className="divide-y divide-border/50">
                <InlineRow
                  icon={CreditCard}
                  label="Paid By"
                  value={formatBillingType(localPopupData?.billingType ?? null)}
                />
                <InlineRow icon={Receipt} label="Check/Ref#" value={null} />
                <InlineRow icon={ShieldCheck} label="Terms" value={null} />
                <InlineRow
                  icon={Briefcase}
                  label="Status"
                  value={<StatusPill status={localJob.status} />}
                />
              </div>
            </div>

            {/* ── Job Details panel ── */}
            <div className="rounded-lg border bg-background overflow-hidden">
              <div className="p-3 border-b bg-muted/20">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job Details</div>
              </div>
              <div className="divide-y divide-border/50">
                {/* Current Status */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <Calendar className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Current Status</div>
                    <StatusSelect jobId={localJob.id} currentStatus={localJob.status} />
                  </div>
                </div>

                {/* Start & End Dates */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <Calendar className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Start & End Dates</div>
                    {editingDates ? (
                      <div className="mt-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={draftStartDate}
                            onChange={(e) => setDraftStartDate(e.target.value)}
                            className="h-8 text-xs w-[140px]"
                          />
                          {isMultiDay && (
                            <>
                              <span className="text-xs text-muted-foreground">–</span>
                              <Input
                                type="date"
                                value={draftEndDate}
                                onChange={(e) => setDraftEndDate(e.target.value)}
                                className="h-8 text-xs w-[140px]"
                              />
                            </>
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={isMultiDay}
                            onCheckedChange={(checked) => setIsMultiDay(checked === true)}
                          />
                          Multi-day job
                        </label>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingDates}
                            onClick={() => {
                              startSaveDates(async () => {
                                const r = await updateJobDates({
                                  jobId: localJob.id,
                                  startDate: draftStartDate || null,
                                  endDate: isMultiDay ? (draftEndDate || null) : null,
                                })
                                if (r.success) {
                                  setLocalJob((j) => ({
                                    ...j!,
                                    startDate: draftStartDate
                                      ? new Date(`${draftStartDate}T00:00:00`)
                                      : null,
                                  }))
                                  setLocalPopupData((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          endDate: isMultiDay && draftEndDate
                                            ? new Date(`${draftEndDate}T00:00:00`)
                                            : null,
                                        }
                                      : prev,
                                  )
                                  setEditingDates(false)
                                  refresh()
                                }
                              })
                            }}
                          >
                            <Check className="size-3 mr-1" /> Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingDates}
                            onClick={() => {
                              setDraftStartDate(
                                localJob.startDate ? toISODate(localJob.startDate) : '',
                              )
                              setDraftEndDate(
                                localPopupData?.endDate ? toISODate(localPopupData.endDate) : '',
                              )
                              setIsMultiDay(!!localPopupData?.endDate)
                              setEditingDates(false)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium">
                          {localPopupData?.endDate
                            ? `${fmtDate(localJob.startDate)} – ${fmtDate(localPopupData.endDate)}`
                            : fmtDate(localJob.startDate)}
                        </div>
                        <button
                          onClick={() => {
                            setDraftStartDate(
                              localJob.startDate ? toISODate(localJob.startDate) : '',
                            )
                            setDraftEndDate(
                              localPopupData?.endDate ? toISODate(localPopupData.endDate) : '',
                            )
                            setIsMultiDay(!!localPopupData?.endDate)
                            setEditingDates(true)
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [edit]
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Estimated Duration */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <Clock className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Estimated Duration</div>
                    {editingDuration ? (
                      <div className="mt-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={draftDuration}
                            onChange={(e) => setDraftDuration(e.target.value)}
                            className="h-8 text-xs w-[100px]"
                            min={0}
                          />
                          <span className="text-xs text-muted-foreground">hours</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingDuration}
                            onClick={() => {
                              startSaveDuration(async () => {
                                const val = draftDuration ? Number(draftDuration) : null
                                const r = await updateJobEstimatedDuration({
                                  jobId: localJob.id,
                                  estimatedDuration: val,
                                })
                                if (r.success) {
                                  setLocalPopupData((prev) =>
                                    prev ? { ...prev, estimatedDuration: val } : prev,
                                  )
                                  setEditingDuration(false)
                                  refresh()
                                }
                              })
                            }}
                          >
                            <Check className="size-3 mr-1" /> Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingDuration}
                            onClick={() => {
                              setDraftDuration(
                                localPopupData?.estimatedDuration?.toString() ?? '',
                              )
                              setEditingDuration(false)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium">
                          {localPopupData?.estimatedDuration
                            ? `${localPopupData.estimatedDuration}h`
                            : <span className="text-muted-foreground/60">Not Set</span>}
                        </div>
                        <button
                          onClick={() => {
                            setDraftDuration(
                              localPopupData?.estimatedDuration?.toString() ?? '',
                            )
                            setEditingDuration(true)
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [edit]
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Arrival Time Window */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <Clock className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Arrival Time Window</div>
                    {editingWindow ? (
                      <div className="mt-1 space-y-2">
                        <TimeWindowPicker
                          startValue={draftWindowStart}
                          endValue={draftWindowEnd}
                          onStartChange={setDraftWindowStart}
                          onEndChange={setDraftWindowEnd}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingWindow}
                            onClick={() => {
                              startSaveWindow(async () => {
                                const r = await updateJobArrivalWindow({
                                  jobId: localJob.id,
                                  arrivalWindowStart: draftWindowStart || null,
                                  arrivalWindowEnd: draftWindowEnd || null,
                                })
                                if (r.success) {
                                  const toDateTime = (t: string | null) =>
                                    t ? new Date(`1970-01-01T${t}:00Z`) : null
                                  setLocalJob((j) => ({
                                    ...j!,
                                    arrivalWindowStart: toDateTime(draftWindowStart),
                                    arrivalWindowEnd: toDateTime(draftWindowEnd),
                                  }))
                                  setEditingWindow(false)
                                  refresh()
                                }
                              })
                            }}
                          >
                            <Check className="size-3 mr-1" /> Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingWindow}
                            onClick={() => {
                              setDraftWindowStart(fmtTime24(localJob.arrivalWindowStart))
                              setDraftWindowEnd(fmtTime24(localJob.arrivalWindowEnd))
                              setEditingWindow(false)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium">
                          {formatWindow(localJob.arrivalWindowStart, localJob.arrivalWindowEnd)}
                        </div>
                        <button
                          onClick={() => {
                            setDraftWindowStart(fmtTime24(localJob.arrivalWindowStart))
                            setDraftWindowEnd(fmtTime24(localJob.arrivalWindowEnd))
                            setEditingWindow(true)
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [edit]
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Assigned Techs */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <Users className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Assigned Techs</div>
                    {editingTechs ? (
                      <div className="mt-1 space-y-2">
                        <div className="space-y-1">
                          {techs.map((t) => (
                            <label
                              key={t.userId}
                              className="flex items-center gap-2 text-xs cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={draftTechIds.includes(t.userId)}
                                onChange={() => {
                                  setDraftTechIds((prev) =>
                                    prev.includes(t.userId)
                                      ? prev.filter((id) => id !== t.userId)
                                      : [...prev, t.userId],
                                  )
                                }}
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
                                const r = await updateJobAssignees({
                                  jobId: localJob.id,
                                  techUserIds: draftTechIds,
                                })
                                if (r.success) {
                                  setLocalJob((j) => ({ ...j!, techIds: draftTechIds }))
                                  setEditingTechs(false)
                                  refresh()
                                }
                              })
                            }}
                          >
                            <Check className="size-3 mr-1" /> Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingTechs}
                            onClick={() => {
                              setDraftTechIds(localJob.techIds)
                              setEditingTechs(false)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium">{techNames}</div>
                        <button
                          onClick={() => {
                            setDraftTechIds(localJob.techIds)
                            setEditingTechs(true)
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [edit]
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Notes For Techs */}
                <div className="flex items-start gap-3 px-3 py-2">
                  <AlertTriangle className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">Notes For Techs</div>
                    {editingNotes ? (
                      <div className="mt-1 space-y-2">
                        <Textarea
                          value={draftNotes}
                          onChange={(e) => setDraftNotes(e.target.value)}
                          className="min-h-[60px] text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingNotes}
                            onClick={() => {
                              startSaveNotes(async () => {
                                const r = await updateJobNotesForTechs({
                                  jobId: localJob.id,
                                  notesForTechs: draftNotes || null,
                                })
                                if (r.success) {
                                  setLocalPopupData((prev) =>
                                    prev ? { ...prev, notesForTechs: draftNotes || null } : prev,
                                  )
                                  setEditingNotes(false)
                                  refresh()
                                }
                              })
                            }}
                          >
                            <Check className="size-3 mr-1" /> Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={savingNotes}
                            onClick={() => {
                              setDraftNotes(localPopupData?.notesForTechs ?? '')
                              setEditingNotes(false)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium">
                          {localPopupData?.notesForTechs || <span className="text-muted-foreground/60">Not Set</span>}
                        </div>
                        <button
                          onClick={() => {
                            setDraftNotes(localPopupData?.notesForTechs ?? '')
                            setEditingNotes(true)
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [edit]
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <InlineRow icon={ClipboardList} label="Additional Site Visits" value="( 0 )" />
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* ── Mobile action bar — bottom strip, hidden on sm+ ── */}
        <div className="flex sm:hidden items-center gap-2 p-2 border-t shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center gap-1.5 text-xs"
            onClick={() => router.push(editHref)}
          >
            <Eye className="size-3.5" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center gap-1.5 text-xs"
            onClick={() => router.push(`${editHref}?edit=true`)}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onClose}
          >
            <ArrowLeft className="size-3.5" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
