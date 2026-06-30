'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CustomerSearch } from '@/components/customer-search'
import { TagSelect, type TagOption } from '@/components/tag-select'
import { TechSelect } from '@/components/tech-select'
import {
  GroupedLineItems,
  type LineItemGroup,
  type LineItemRow,
} from '@/components/line-items/grouped-line-items'
import { StarPicker } from '@/components/line-items/star-picker'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { TimeWindowPicker } from '@/components/ui/time-window-picker'
import { LocationPickerFields } from '@/components/location-picker-fields'
import { ContactPickerFields } from '@/components/contact-picker-fields'
import { useLocationPicker } from '@/hooks/use-location-picker'
import { useContactPicker } from '@/hooks/use-contact-picker'
import {
  createOfficeEstimateAction,
  updateEstimateAction,
  convertEstimateToJobAction,
  sendEstimateAction,
  applyEstimateTemplateAction,
  getCustomerContacts,
  getCustomerLocations,
} from '../actions'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import { EstimateStatusDropdown } from './estimate-status-dropdown'
import { computeEstimateTotals } from '@/lib/estimates/totals'
import { toISODate, capitalizeWords } from '@/lib/utils'
import { toast } from 'sonner'
import { FileDown, Mail, Send, Loader2, UserPlus, Plus } from 'lucide-react'
import { ContactEditor, type ContactEditorValue, emptyContact } from '@/components/contact-editor'
import type { EstimateTemplate } from '@/lib/estimates/templates'
import type { getEstimateAction } from '../actions'

interface ReferenceData {
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  referralSources: Array<{ id: string; name: string }>
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  availableTags: TagOption[]
  productCategories: Array<{ id: string; name: string }>
  orgMembers: Array<{ id: string; label: string; role: string | null }>
  salesReps: Array<{ id: string; name: string }>
}

interface EstimateFormProps {
  mode: 'create' | 'edit'
  orgId: string
  userId: string
  estimateId?: string
  initial?: Awaited<ReturnType<typeof getEstimateAction>> & { customerName?: string | null }
  referenceData: ReferenceData
  estimateTemplates: EstimateTemplate[]
  role?: string | null
  onSuccess?: () => void
}

const ESTIMATE_STATUSES = [
  'estimate_requested',
  'estimate_provided',
  'estimate_accepted',
  'estimate_won',
  'estimate_lost',
]

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  if (typeof d === 'string') return d.slice(0, 10)
  const isUtcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  return isUtcMidnight ? d.toISOString().slice(0, 10) : toISODate(d)
}

function toTimeInputValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  const h = String(date.getUTCHours()).padStart(2, '0')
  const m = String(date.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function formatMoney(n: number): string {
  return `$${(n / 100).toFixed(2)}`
}

export function EstimateForm({
  mode,
  orgId,
  estimateId,
  initial,
  referenceData,
  estimateTemplates,
  role,
  onSuccess,
}: EstimateFormProps) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [converting, setConverting] = React.useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = React.useState(false)

  // ── Customer create-or-select mode ──
  const [customerMode, setCustomerMode] = React.useState<'existing' | 'new'>(mode === 'create' ? 'existing' : 'existing')
  const [newCustomerName, setNewCustomerName] = React.useState('')
  const [newContactData, setNewContactData] = React.useState<ContactEditorValue>(emptyContact())
  const [newLocationName, setNewLocationName] = React.useState('')
  const [newLocationAddress1, setNewLocationAddress1] = React.useState('')
  const [newLocationAddress2, setNewLocationAddress2] = React.useState('')
  const [newLocationCity, setNewLocationCity] = React.useState('')
  const [newLocationState, setNewLocationState] = React.useState('')
  const [newLocationPostalCode, setNewLocationPostalCode] = React.useState('')
  const [newLocationGated, setNewLocationGated] = React.useState(false)
  const prevCustomerIdRef = React.useRef<string | null>(initial?.estimate.customerId ?? null)

  // ── Core form state ──
  const [customerId, setCustomerId] = React.useState<string | null>(initial?.estimate.customerId ?? null)
  const [customerName, setCustomerName] = React.useState<string>(initial?.customerName ?? '')
  const [categoryId, setCategoryId] = React.useState<string | null>(initial?.estimate.categoryId ?? null)
  const [description, setDescription] = React.useState(initial?.estimate.description ?? '')
  const [poNumber, setPoNumber] = React.useState(initial?.estimate.poNumber ?? '')
  const [opportunityRating, setOpportunityRating] = React.useState<number | null>(initial?.estimate.opportunityRating ?? null)
  const [status, setStatus] = React.useState(initial?.estimate.status ?? 'estimate_requested')
  const [referralSourceId, setReferralSourceId] = React.useState<string | null>(initial?.estimate.referralSourceId ?? null)
  const [requestedOn, setRequestedOn] = React.useState(
    initial?.estimate.requestedOn
      ? toDateInputValue(initial.estimate.requestedOn)
      : mode === 'create'
        ? toISODate(new Date())
        : toDateInputValue(initial?.estimate.createdAt),
  )
  const [expiryDate, setExpiryDate] = React.useState(toDateInputValue(initial?.estimate.expiryDate))
  const [followUpDate, setFollowUpDate] = React.useState(toDateInputValue(initial?.estimate.followUpDate))
  const [onSiteDate, setOnSiteDate] = React.useState(toDateInputValue(initial?.estimate.onSiteDate))
  const [arrivalWindowStart, setArrivalWindowStart] = React.useState(toTimeInputValue(initial?.estimate.arrivalWindowStart))
  const [arrivalWindowEnd, setArrivalWindowEnd] = React.useState(toTimeInputValue(initial?.estimate.arrivalWindowEnd))
  const [notesForTechs, setNotesForTechs] = React.useState(initial?.estimate.notesForTechs ?? '')
  const [notes, setNotes] = React.useState(initial?.estimate.notes ?? '')
  const [internalNotes, setInternalNotes] = React.useState(initial?.estimate.internalNotes ?? '')
  const [assignedAgentId, setAssignedAgentId] = React.useState<string | null>(initial?.estimate.assignedAgentId ?? null)
  const [tagIds, setTagIds] = React.useState<string[]>(initial?.tagIds ?? [])
  const [assigneeUserIds, setAssigneeUserIds] = React.useState<string[]>(initial?.assigneeUserIds ?? [])

  // ── Picker hooks (location + contact for existing-customer path) ──
  const [contactMode, setContactMode] = React.useState<'existing' | 'new'>('existing')
  const autoSelectRef = React.useRef(false)

  const locationPicker = useLocationPicker({
    customerId,
    initialLocationId: initial?.estimate.serviceLocationId,
    initialPrimaryLocationId: null,
  })

  const contactPicker = useContactPicker({
    customerId,
    contactMode,
    initialContact: initial?.contact
      ? {
          id: initial.contact.id,
          firstName: initial.contact.firstName,
          lastName: initial.contact.lastName ?? '',
          jobTitle: initial.contact.jobTitle ?? '',
          phones:
            initial.contact.phones.length > 0
              ? initial.contact.phones.map((p) => ({
                  id: p.id,
                  number: p.number,
                  ext: (p as { ext?: string | null }).ext ?? '',
                  type: p.type,
                  isPrimary: p.isPrimary ?? false,
                }))
              : [{ number: '', ext: '', type: 'cell', isPrimary: true }],
          emails:
            initial.contact.emails.length > 0
              ? initial.contact.emails.map((e) => ({
                  id: e.id,
                  address: e.address,
                  type: e.type,
                  isPrimary: e.isPrimary ?? false,
                }))
              : [{ address: '', type: 'work', isPrimary: true }],
          smsConsent: initial.contact.smsConsent ?? false,
          billingContact: initial.contact.billingContact ?? false,
          bookingContact: initial.contact.bookingContact ?? false,
        }
      : null,
    initialPrimaryContactId: null,
  })

  // Seed contactId from initial on mount
  React.useEffect(() => {
    if (initial?.estimate.contactId) contactPicker.setContactId(initial.estimate.contactId)
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch contacts and locations when customer changes; push data into pickers via hydrate
  React.useEffect(() => {
    if (!customerId) {
      contactPicker.hydrate([], null)
      locationPicker.hydrate([], null)
      prevCustomerIdRef.current = customerId
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [{ contacts: c, primaryContactId: pcId }, { locations: l, primaryLocationId: plId }] = await Promise.all([
          getCustomerContacts(customerId),
          getCustomerLocations(customerId),
        ])
        if (cancelled) return
        contactPicker.hydrate(c, pcId)
        locationPicker.hydrate(l, plId)
        if (autoSelectRef.current) {
          const autoContact = pcId ? c.find((x) => x.id === pcId) : c[0]
          if (autoContact) contactPicker.setContactId(autoContact.id)
          const autoLocation = plId ? l.find((x) => x.id === plId) : l[0]
          if (autoLocation) locationPicker.setLocationId(autoLocation.id)
          autoSelectRef.current = false
        }
      } catch (err) {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : 'Could not load customer details.')
      }
    })()
    prevCustomerIdRef.current = customerId
    return () => {
      cancelled = true
    }
  // contactPicker and locationPicker are stable hook refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const handleCustomerChange = React.useCallback((id: string | null) => {
    if (id) {
      autoSelectRef.current = true
      setCustomerMode('existing')
      setCustomerId(id)
      setContactMode('existing')
      setCustomerName('')
      contactPicker.resetForCustomerChange()
      locationPicker.resetForCustomerChange()
    } else {
      setCustomerId(null)
      setContactMode('existing')
      contactPicker.resetForCustomerChange()
      locationPicker.resetForCustomerChange()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateNewCustomer = React.useCallback((name: string) => {
    setCustomerMode('new')
    setNewCustomerName(capitalizeWords(name))
    setCustomerId(null)
    setContactMode('new')
    setNewContactData(emptyContact())
    setNewLocationName('')
    setNewLocationAddress1('')
    setNewLocationAddress2('')
    setNewLocationCity('')
    setNewLocationState('')
    setNewLocationPostalCode('')
    setNewLocationGated(false)
    contactPicker.resetForCustomerChange()
    locationPicker.resetForCustomerChange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClearNewCustomer = React.useCallback(() => {
    setCustomerMode('existing')
    setNewCustomerName('')
    setCustomerId(null)
    setContactMode('existing')
    setNewContactData(emptyContact())
    setNewLocationName('')
    setNewLocationAddress1('')
    setNewLocationAddress2('')
    setNewLocationCity('')
    setNewLocationState('')
    setNewLocationPostalCode('')
    setNewLocationGated(false)
    contactPicker.resetForCustomerChange()
    locationPicker.resetForCustomerChange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Line items & groups ──
  const initialGroups: LineItemGroup[] =
    initial?.groups.map((g) => ({ id: g.id, name: g.name, sortOrder: g.sortOrder ?? 0 })) ?? []
  const initialItems: LineItemRow[] =
    initial?.lineItems.map((li) => ({
      id: li.id,
      type: (li.type ?? 'service') as LineItemRow['type'],
      refId: li.refId,
      title: li.title ?? null,
      description: li.description ?? '',
      qty: String(li.qty ?? '1'),
      rate: String(li.rate ?? '0'),
      cost: String(li.cost ?? '0'),
      taxItemId: li.taxItemId,
      groupId: li.groupId ?? null,
    })) ?? []

  const [groups, setGroups] = React.useState<LineItemGroup[]>(initialGroups)
  const [lineItems, setLineItems] = React.useState<LineItemRow[]>(initialItems)

  // ── Template application ──
  const [selectedTemplateId, setSelectedTemplateId] = React.useState('')
  const [applyingTemplate, setApplyingTemplate] = React.useState(false)

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return
    setApplyingTemplate(true)
    try {
      const result = await applyEstimateTemplateAction(orgId, selectedTemplateId)
      if (result.groups.length > 0) {
        const groupIdMap = new Map<string, string>()
        const nextGroups: LineItemGroup[] = result.groups.map((g) => {
          const newId = crypto.randomUUID()
          groupIdMap.set(g.id, newId)
          return { id: newId, name: g.name, sortOrder: g.sortOrder }
        })
        setGroups(nextGroups)
        setLineItems(
          result.lineItems.map((li) => ({
            id: crypto.randomUUID(),
            type: li.type,
            refId: li.refId,
            title: li.title,
            description: li.description,
            qty: li.qty,
            rate: li.rate,
            cost: li.cost,
            taxItemId: li.taxItemId,
            groupId: li.groupId ? groupIdMap.get(li.groupId) ?? null : null,
          })),
        )
      } else {
        setGroups([])
        setLineItems(
          result.lineItems.map((li) => ({
            id: crypto.randomUUID(),
            type: li.type,
            refId: li.refId,
            title: li.title,
            description: li.description,
            qty: li.qty,
            rate: li.rate,
            cost: li.cost,
            taxItemId: li.taxItemId,
            groupId: null,
          })),
        )
      }
      toast.success('Template applied')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not apply template')
    } finally {
      setApplyingTemplate(false)
    }
  }

  // ── Totals ──
  const totals = React.useMemo(
    () =>
      computeEstimateTotals(
        lineItems.map((li) => ({
          type: li.type,
          qty: li.qty,
          rate: li.rate,
          cost: li.cost,
          taxRate: null,
          groupId: li.groupId ?? null,
        })),
        groups,
      ),
    [lineItems, groups],
  )

  // ── Save ──
  const buildPayload = () => ({
    customerId: customerMode === 'existing' ? (customerId ?? '') : '',
    newCustomerName: customerMode === 'new' ? newCustomerName : '',
    newContactJson: customerMode === 'new' ? JSON.stringify(newContactData) : '',
    // contactUpdate includes phone normalization and filtering via the hook's toPayloadFields()
    contactUpdate: customerMode === 'new' ? '' : contactPicker.toPayloadFields().contactUpdate,
    newLocationName: customerMode === 'new' ? newLocationName : '',
    newLocationAddress1: customerMode === 'new' ? newLocationAddress1 : '',
    newLocationAddress2: customerMode === 'new' ? newLocationAddress2 : '',
    newLocationCity: customerMode === 'new' ? newLocationCity : '',
    newLocationState: customerMode === 'new' ? newLocationState : '',
    newLocationPostalCode: customerMode === 'new' ? newLocationPostalCode : '',
    newLocationGated: customerMode === 'new' ? newLocationGated : false,
    contactId: customerMode === 'new' ? null : (contactPicker.contactId ?? null),
    serviceLocationId: customerMode === 'new' ? null : (locationPicker.locationId ?? null),
    status,
    categoryId,
    description,
    poNumber,
    opportunityRating,
    referralSourceId,
    expiryDate,
    followUpDate,
    onSiteDate,
    arrivalWindowStart,
    arrivalWindowEnd,
    notesForTechs,
    notes,
    internalNotes,
    assignedAgentId,
    requestedOn,
    tagIds,
    assigneeUserIds,
    lineItems: JSON.stringify(lineItems),
    groups: JSON.stringify(groups),
  })

  const handleSave = async () => {
    if (customerMode === 'new' && !newCustomerName.trim()) {
      toast.error('Customer name is required.')
      return
    }
    if (customerMode === 'existing' && !customerId) {
      toast.error('Customer is required.')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (mode === 'create') {
        const result = await createOfficeEstimateAction(orgId, payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Estimate created')
        router.push(`/estimates/${result.id}`)
      } else {
        if (!estimateId) return
        const result = await updateEstimateAction(orgId, estimateId, payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Estimate saved')
        router.refresh()
        onSuccess?.()
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Convert to job ──
  const handleConvert = async () => {
    if (!estimateId) return
    setConverting(true)
    try {
      const result = await convertEstimateToJobAction(orgId, estimateId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Converted to job')
      router.push(`/jobs/${result.jobId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not convert estimate.')
    } finally {
      setConverting(false)
      setConvertDialogOpen(false)
    }
  }

  // ── Email stub ──
  const handleEmail = async () => {
    if (!estimateId) {
      toast('Email sending arrives in a later release. The estimate PDF is ready to download.')
      return
    }
    try {
      await sendEstimateAction(orgId, estimateId)
      toast('Email sending arrives in a later release. The estimate PDF is ready to download.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send estimate.')
    }
  }

  const isLost = status === 'estimate_lost'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {mode === 'create' && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              New Estimate
            </h1>
            <p className="text-sm text-muted-foreground">
              {customerName || 'Select a customer to begin'}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {mode === 'edit' && estimateId && (
            <>
              <Link href={`/api/estimates/${estimateId}/pdf`} target="_blank" passHref>
                <Button variant="outline" size="sm" type="button">
                  <FileDown className="mr-1 size-4" />
                  Download PDF
                </Button>
              </Link>
              <Button variant="outline" size="sm" type="button" onClick={handleEmail}>
                <Mail className="mr-1 size-4" />
                Email Estimate
              </Button>
              <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
                <DialogTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="outline"
                      size="sm"
                      disabled={isLost}
                      type="button"
                    >
                      <Send className="mr-1 size-4" />
                      Convert to Job
                    </Button>
                  )}
                />
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Convert to Job?</DialogTitle>
                    <DialogDescription className="space-y-2">
                      <p>
                        This creates a new job from this estimate, copies the line items and groups, and marks the estimate as Won.
                      </p>
                      {initial?.convertedJobs && initial.convertedJobs.length > 0 && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          <strong>
                            This estimate is already converted to{' '}
                            {initial.convertedJobs.map((j, i) => `${i > 0 ? ', ' : ''}Job #${`JOB-${j.jobNo}`}`).join('')}
                            .
                          </strong>
                          <br />
                          Clicking Convert again will create another duplicate job. Use this only if you intentionally need another job from the same estimate.
                        </div>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConvert}
                      disabled={converting}
                      variant={initial?.convertedJobs && initial.convertedJobs.length > 0 ? 'destructive' : 'default'}
                    >
                      {converting && <Loader2 className="mr-1 size-4 animate-spin" />}
                      {initial?.convertedJobs && initial.convertedJobs.length > 0 ? 'Convert Anyway' : 'Convert'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
            Save Estimate
          </Button>
        </div>
      </div>

      {/* Template selector (edit only, or create too) */}
      {estimateTemplates.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border p-3">
          <Select value={selectedTemplateId} onValueChange={(v) => setSelectedTemplateId(v ?? '')}>
            <SelectTrigger className="w-64" aria-label="Apply a template">
              <SelectValue placeholder="Apply a template…">
                {selectedTemplateId
                  ? estimateTemplates.find((t) => t.id === selectedTemplateId)?.name ?? selectedTemplateId
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {estimateTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleApplyTemplate}
            disabled={!selectedTemplateId || applyingTemplate}
          >
            {applyingTemplate ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      )}

      {/* Two-panel form */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Project Specs */}
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Project Specs</h2>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Customer *</p>
            {customerMode === 'new' ? (
              <div className="space-y-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-primary">New customer</span>
                  <button
                    type="button"
                    onClick={handleClearNewCustomer}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    × Cancel
                  </button>
                </div>
                <Input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(capitalizeWords(e.target.value))}
                  placeholder="Customer name *"
                  className="capitalize"
                />
              </div>
            ) : (
              <>
                <CustomerSearch
                  defaultValue={customerId ?? undefined}
                  defaultLabel={customerName ?? undefined}
                  onChange={handleCustomerChange}
                  allowCreate={mode === 'create'}
                  onCreateNew={handleCreateNewCustomer}
                  onReplaceIntent={mode === 'edit' && !!customerId ? (char) => {
                    setCustomerName(char)
                    setCustomerId(null)
                    contactPicker.resetForCustomerChange()
                    locationPicker.resetForCustomerChange()
                  } : undefined}
                />
                {mode === 'create' && (
                  <button
                    type="button"
                    onClick={() => handleCreateNewCustomer('')}
                    className="mt-1 flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <UserPlus className="size-3.5" />
                    Create a new customer instead
                  </button>
                )}
              </>
            )}
          </div>

          {customerMode === 'new' ? (
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact (optional)</p>
              <ContactEditor
                value={newContactData}
                onChange={setNewContactData}
                idPrefix="est-new-cust-c"
              />
              <div>
                <p className="text-sm font-medium leading-none">Service Location</p>
              </div>
              {/* Row 1: Location Name + Gated */}
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="est-new-loc-name" className="text-xs">Location Name</Label>
                  <Input
                    id="est-new-loc-name"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="e.g. Home or Office"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-5">
                  <Checkbox
                    id="new-cust-location-gated"
                    checked={newLocationGated}
                    onCheckedChange={(c) => setNewLocationGated(c === true)}
                  />
                  <Label htmlFor="new-cust-location-gated" className="cursor-pointer text-sm">
                    Gated Property
                  </Label>
                </div>
              </div>
              {/* Row 2: Street Address + Unit */}
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="space-y-1">
                  <Label htmlFor="est-new-loc-addr1" className="text-xs">Street Address</Label>
                  <AddressAutocomplete
                    id="est-new-loc-addr1"
                    defaultValue={newLocationAddress1}
                    placeholder="Start typing an address…"
                    onAddressSelect={(result) => {
                      setNewLocationAddress1(result.addressLine1 ?? '')
                      setNewLocationCity(result.city ?? '')
                      setNewLocationState(result.state ?? '')
                      setNewLocationPostalCode(result.postalCode ?? '')
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="est-new-loc-addr2" className="text-xs">Unit</Label>
                  <Input
                    id="est-new-loc-addr2"
                    value={newLocationAddress2}
                    onChange={(e) => setNewLocationAddress2(e.target.value)}
                    placeholder="Ste/Unit/Apt"
                    className="w-32"
                  />
                </div>
              </div>
              {/* Row 3: City + State + Zip */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="est-new-loc-city" className="text-xs">City</Label>
                  <Input
                    id="est-new-loc-city"
                    value={newLocationCity}
                    onChange={(e) => setNewLocationCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="est-new-loc-state" className="text-xs">State</Label>
                  <Input
                    id="est-new-loc-state"
                    value={newLocationState}
                    onChange={(e) => setNewLocationState(e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="est-new-loc-zip" className="text-xs">Zip</Label>
                  <Input
                    id="est-new-loc-zip"
                    value={newLocationPostalCode}
                    onChange={(e) => setNewLocationPostalCode(e.target.value)}
                    placeholder="Zip/Postal Code"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* ── Contact ── (shared ContactPickerFields; see src/components/contact-picker-fields.tsx) */}
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">Contact</p>
                <ContactPickerFields picker={contactPicker} customerId={customerId} idPrefix="est" />
              </div>

              {/* ── Service Location ── */}
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none">Service Location</p>
                <LocationPickerFields picker={locationPicker} customerId={customerId} idPrefix="est" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="est-category">Category</Label>
            <Select value={categoryId ?? ''} onValueChange={(v) => setCategoryId(v || null)}>
              <SelectTrigger id="est-category" className="w-full">
                <span className="flex flex-1 text-left text-sm">
                  {categoryId
                    ? referenceData.jobCategories.find((c) => c.id === categoryId)?.name ?? categoryId
                    : <span className="text-muted-foreground">Select category…</span>}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
                {referenceData.jobCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="est-description">Description</Label>
            <Textarea
              id="est-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work or scope"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="est-poNumber">PO #</Label>
            <Input id="est-poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Purchase order number" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="est-onSiteDate">On-site Visit Date</Label>
              <Input id="est-onSiteDate" type="date" value={onSiteDate} onChange={(e) => setOnSiteDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Arrival Window</p>
              <TimeWindowPicker
                startValue={arrivalWindowStart}
                endValue={arrivalWindowEnd}
                onStartChange={setArrivalWindowStart}
                onEndChange={setArrivalWindowEnd}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Assigned Techs</p>
            <TechSelect
              members={referenceData.orgMembers.filter(
                (m) => m.role === 'org:technician' || m.role === 'org:admin',
              )}
              defaultSelected={assigneeUserIds}
              onChange={setAssigneeUserIds}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Tags</p>
            <TagSelect
              availableTags={referenceData.availableTags}
              defaultSelected={referenceData.availableTags.filter((t) => tagIds.includes(t.id))}
              onChange={(selected) => setTagIds(selected.map((t) => t.id))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="est-notesForTechs">Notes for Techs</Label>
            <Textarea
              id="est-notesForTechs"
              value={notesForTechs}
              onChange={(e) => setNotesForTechs(e.target.value)}
              placeholder="Visible to technicians in the field"
              rows={3}
            />
          </div>
        </div>

        {/* Sales Data */}
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Sales Data</h2>

          <div className="space-y-2">
            <Label htmlFor="est-requestedOn">Requested On</Label>
            <Input id="est-requestedOn" type="date" value={requestedOn} onChange={(e) => setRequestedOn(e.target.value)} />
          </div>

          <div className="space-y-2">
            {mode === 'create' ? (
              <Label htmlFor="est-status">Status</Label>
            ) : (
              <p className="text-sm font-medium leading-none">Status</p>
            )}
            {mode === 'edit' && estimateId ? (
              <EstimateStatusDropdown
                estimateId={estimateId}
                currentStatus={status}
                onStatusChange={(s) => setStatus(s as typeof status)}
              />
            ) : (
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger id="est-status">
                  <SelectValue>{estimateStatusLabel(status)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ESTIMATE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-2">
                        <Badge variant={estimateStatusBadgeVariant(s)}>{estimateStatusLabel(s)}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Opportunity Rating</p>
            <StarPicker value={opportunityRating} onChange={setOpportunityRating} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="est-referralSource">Referral Source</Label>
            <Select
              value={referralSourceId ?? ''}
              onValueChange={(v) => setReferralSourceId(v || null)}
            >
              <SelectTrigger id="est-referralSource">
                <SelectValue placeholder="Select source">
                  {referralSourceId
                    ? referenceData.referralSources.find((s) => s.id === referralSourceId)?.name ?? referralSourceId
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No source</SelectItem>
                {referenceData.referralSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="est-expiryDate">Expiry Date</Label>
              <Input id="est-expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="est-followUpDate">Follow-up Date</Label>
              <Input id="est-followUpDate" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="est-salesRep">Sales Rep</Label>
            <Select
              value={assignedAgentId ?? ''}
              onValueChange={(v) => setAssignedAgentId(v || null)}
            >
              <SelectTrigger id="est-salesRep">
                <SelectValue placeholder="Select rep">
                  {assignedAgentId
                    ? referenceData.salesReps.find((r) => r.id === assignedAgentId)?.name ?? assignedAgentId
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {referenceData.salesReps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="est-internalNotes">Internal Notes</Label>
            <Textarea
              id="est-internalNotes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Not shown on the customer-facing PDF"
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-6">
        <GroupedLineItems
          groups={groups}
          lineItems={lineItems}
          onChange={(nextGroups, nextItems) => {
            setGroups(nextGroups)
            setLineItems(nextItems)
          }}
          referenceData={{
            taxItems: referenceData.taxItems,
            productCategories: referenceData.productCategories,
          }}
          role={role}
          jobId={estimateId}
        />
        {groups.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              const defaultGroup: LineItemGroup = {
                id: crypto.randomUUID(),
                name: 'Group 1',
                sortOrder: 0,
              }
              setGroups([defaultGroup])
              setLineItems(lineItems.map((i) => ({ ...i, groupId: defaultGroup.id })))
            }}
          >
            <Plus className="mr-1 size-4" /> Enable Line-Item Groups
          </Button>
        )}

        <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Review line items, then save the estimate.
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
            Save Estimate
          </Button>
        </div>
      </div>
    </div>
  )
}
