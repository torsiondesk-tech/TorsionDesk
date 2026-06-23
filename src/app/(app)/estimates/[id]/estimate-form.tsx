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
import type { ParsedAddress } from '@/lib/places-actions'
import {
  createOfficeEstimateAction,
  updateEstimateAction,
  convertEstimateToJobAction,
  sendEstimateAction,
  applyEstimateTemplateAction,
  getCustomerContacts,
  getCustomerLocations,
} from '../actions'
import {
  getCustomerContactDetail,
  createContactForJob,
  createServiceLocation,
  updateServiceLocation,
} from '../../jobs/actions'
import { setPrimaryContactAction, setPrimaryLocationAction } from '../../customers/actions'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import { computeEstimateTotals } from '@/lib/estimates/totals'
import { toISODate, formatPhoneInput, normalizePhone } from '@/lib/utils'
import { toast } from 'sonner'
import { FileDown, Mail, Send, Plus, Loader2, UserPlus, Star, MapPin } from 'lucide-react'
import type { EstimateTemplate } from '@/lib/estimates/templates'
import type { getEstimateAction } from '../actions'

interface ReferenceData {
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  jobSources: Array<{ id: string; name: string }>
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  availableTags: TagOption[]
  productCategories: Array<{ id: string; name: string }>
  orgMembers: Array<{ id: string; label: string; role: string | null }>
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
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
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
}: EstimateFormProps) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [converting, setConverting] = React.useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = React.useState(false)

  // ── Customer create-or-select mode ──
  const [customerMode, setCustomerMode] = React.useState<'existing' | 'new'>(mode === 'create' ? 'existing' : 'existing')
  const [newCustomerName, setNewCustomerName] = React.useState('')
  const [newContactFirstName, setNewContactFirstName] = React.useState('')
  const [newContactLastName, setNewContactLastName] = React.useState('')
  const [newContactPhone, setNewContactPhone] = React.useState('')
  const [newContactEmail, setNewContactEmail] = React.useState('')
  const [newLocationAddress1, setNewLocationAddress1] = React.useState('')
  const [newLocationAddress2, setNewLocationAddress2] = React.useState('')
  const [newLocationCity, setNewLocationCity] = React.useState('')
  const [newLocationState, setNewLocationState] = React.useState('')
  const [newLocationPostalCode, setNewLocationPostalCode] = React.useState('')
  const prevCustomerIdRef = React.useRef<string | null>(initial?.estimate.customerId ?? null)

  // ── Core form state ──
  const [customerId, setCustomerId] = React.useState<string | null>(initial?.estimate.customerId ?? null)
  const [customerName, setCustomerName] = React.useState<string>(initial?.customerName ?? '')
  const [contactId, setContactId] = React.useState<string | null>(initial?.estimate.contactId ?? null)
  const [serviceLocationId, setServiceLocationId] = React.useState<string | null>(initial?.estimate.serviceLocationId ?? null)
  const [categoryId, setCategoryId] = React.useState<string | null>(initial?.estimate.categoryId ?? null)
  const [description, setDescription] = React.useState(initial?.estimate.description ?? '')
  const [poNumber, setPoNumber] = React.useState(initial?.estimate.poNumber ?? '')
  const [opportunityRating, setOpportunityRating] = React.useState<number | null>(initial?.estimate.opportunityRating ?? null)
  const [status, setStatus] = React.useState(initial?.estimate.status ?? 'estimate_requested')
  const [referralSourceId, setReferralSourceId] = React.useState<string | null>(initial?.estimate.referralSourceId ?? null)
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

  // ── Dependent selects ──
  const [contacts, setContacts] = React.useState<Array<{ id: string; firstName: string; lastName: string | null }>>([])
  const [locations, setLocations] = React.useState<
    Array<{
      id: string
      name: string | null
      addressLine1: string | null
      addressLine2: string | null
      city: string | null
      state: string | null
      postalCode: string | null
      gated: boolean | null
    }>
  >([])
  const [contactsLoading, setContactsLoading] = React.useState(false)
  const [locationsLoading, setLocationsLoading] = React.useState(false)
  const [primaryContactId, setPrimaryContactId] = React.useState<string | null>(null)
  const [primaryLocationId, setPrimaryLocationId] = React.useState<string | null>(null)

  // ── Inline contact/location creation/editing ──
  const [contactMode, setContactMode] = React.useState<'existing' | 'new'>('existing')
  const [locationMode, setLocationMode] = React.useState<'existing' | 'new' | 'edit'>('existing')
  interface LocationAddrState extends Partial<ParsedAddress> {
    addressLine2?: string
  }
  const [newLocationAddr, setNewLocationAddr] = React.useState<LocationAddrState>({})
  const [locationEditName, setLocationEditName] = React.useState('')
  const [locationGated, setLocationGated] = React.useState(false)
  const [savingContact, setSavingContact] = React.useState(false)
  const [savingLocation, setSavingLocation] = React.useState(false)
  const [contactError, setContactError] = React.useState<string | null>(null)
  const [locationError, setLocationError] = React.useState<string | null>(null)
  const [locationFormKey, setLocationFormKey] = React.useState(0)
  const autoSelectRef = React.useRef(false)

  // Sync location edit form when an existing location is selected
  React.useEffect(() => {
    if (!serviceLocationId || locationMode === 'new' || !locations.length) return
    const loc = locations.find((l) => l.id === serviceLocationId)
    if (!loc) return
    setNewLocationAddr({
      addressLine1: loc.addressLine1 ?? undefined,
      addressLine2: loc.addressLine2 ?? undefined,
      city: loc.city ?? undefined,
      state: loc.state ?? undefined,
      postalCode: loc.postalCode ?? undefined,
    })
    setLocationEditName(loc.name ?? '')
    setLocationGated(loc.gated ?? false)
    setLocationFormKey((k) => k + 1)
  }, [serviceLocationId, locations, locationMode])

  React.useEffect(() => {
    if (!customerId) {
      setContacts([])
      setLocations([])
      setContactsLoading(false)
      setLocationsLoading(false)
      setPrimaryContactId(null)
      setPrimaryLocationId(null)
      prevCustomerIdRef.current = customerId
      return
    }
    let cancelled = false
    setContactsLoading(true)
    setLocationsLoading(true)
    ;(async () => {
      try {
        const [{ contacts: c, primaryContactId: pcId }, { locations: l, primaryLocationId: plId }] = await Promise.all([
          getCustomerContacts(customerId),
          getCustomerLocations(customerId),
        ])
        if (cancelled) return
        setContacts(c)
        setLocations(l)
        setPrimaryContactId(pcId)
        setPrimaryLocationId(plId)
        if (autoSelectRef.current) {
          const autoContact = pcId ? c.find((x) => x.id === pcId) : c[0]
          if (autoContact) setContactId(autoContact.id)
          const autoLocation = plId ? l.find((x) => x.id === plId) : l[0]
          if (autoLocation) setServiceLocationId(autoLocation.id)
          autoSelectRef.current = false
        }
      } catch (err) {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : 'Could not load customer details.')
      } finally {
        if (!cancelled) {
          setContactsLoading(false)
          setLocationsLoading(false)
        }
      }
    })()
    prevCustomerIdRef.current = customerId
    return () => {
      cancelled = true
    }
  }, [customerId])

  const handleCustomerChange = React.useCallback((id: string | null) => {
    if (id) {
      autoSelectRef.current = true
      setCustomerMode('existing')
      setCustomerId(id)
      setContactId(null)
      setServiceLocationId(null)
      setContactMode('existing')
      setLocationMode('existing')
      setCustomerName('')
      setLocationEditName('')
      setLocationGated(false)
      setNewLocationAddr({})
      setLocationError(null)
      setContactError(null)
    } else {
      setCustomerId(null)
      setContactId(null)
      setServiceLocationId(null)
      setContacts([])
      setLocations([])
      setContactMode('existing')
      setLocationMode('existing')
      setLocationEditName('')
      setLocationGated(false)
      setNewLocationAddr({})
      setLocationError(null)
      setContactError(null)
    }
  }, [])

  const handleCreateNewCustomer = React.useCallback((name: string) => {
    setCustomerMode('new')
    setNewCustomerName(name)
    setCustomerId(null)
    setContactId(null)
    setServiceLocationId(null)
    setContacts([])
    setLocations([])
    setContactMode('new')
    setNewContactFirstName('')
    setNewContactLastName('')
    setNewContactPhone('')
    setNewContactEmail('')
    setLocationMode('new')
    setNewLocationAddress1('')
    setNewLocationAddress2('')
    setNewLocationCity('')
    setNewLocationState('')
    setNewLocationPostalCode('')
    setLocationEditName('')
    setLocationGated(false)
    setNewLocationAddr({})
    setLocationError(null)
    setContactError(null)
  }, [])

  const handleClearNewCustomer = React.useCallback(() => {
    setCustomerMode('existing')
    setNewCustomerName('')
    setCustomerId(null)
    setContactId(null)
    setServiceLocationId(null)
    setContacts([])
    setLocations([])
    setContactMode('existing')
    setNewContactFirstName('')
    setNewContactLastName('')
    setNewContactPhone('')
    setNewContactEmail('')
    setLocationMode('existing')
    setNewLocationAddress1('')
    setNewLocationAddress2('')
    setNewLocationCity('')
    setNewLocationState('')
    setNewLocationPostalCode('')
    setLocationEditName('')
    setLocationGated(false)
    setNewLocationAddr({})
    setLocationError(null)
    setContactError(null)
  }, [])

  const handleSaveNewContact = async () => {
    if (!customerId) {
      setContactError('Select a customer first.')
      return
    }
    if (!newContactFirstName.trim() && !newContactLastName.trim()) {
      setContactError('First or last name is required.')
      return
    }
    setSavingContact(true)
    setContactError(null)
    try {
      const result = await createContactForJob(customerId, {
        firstName: newContactFirstName.trim(),
        lastName: newContactLastName.trim() || null,
        phone: newContactPhone || null,
        email: newContactEmail.trim() || null,
      })
      if (result.error) {
        setContactError(result.error)
        return
      }
      const { contacts: refreshed, primaryContactId: refreshedPrimary } = await getCustomerContacts(customerId)
      setContacts(refreshed)
      setPrimaryContactId(refreshedPrimary)
      setContactId(result.id)
      setContactMode('existing')
      setNewContactFirstName('')
      setNewContactLastName('')
      setNewContactPhone('')
      setNewContactEmail('')
    } catch (err) {
      setContactError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingContact(false)
    }
  }

  const handleSaveNewLocation = async () => {
    if (!customerId || customerMode === 'new') {
      setLocationError('Select an existing customer first.')
      return
    }
    if (!newLocationAddr.addressLine1?.trim()) {
      setLocationError('Street address is required.')
      return
    }
    setSavingLocation(true)
    setLocationError(null)
    try {
      const result = await createServiceLocation(customerId, {
        name: locationEditName.trim() || null,
        addressLine1: newLocationAddr.addressLine1,
        addressLine2: newLocationAddr.addressLine2 ?? null,
        city: newLocationAddr.city ?? null,
        state: newLocationAddr.state ?? null,
        postalCode: newLocationAddr.postalCode ?? null,
        gated: locationGated,
      })
      if (result.error) {
        setLocationError(result.error)
        return
      }
      const { locations: refreshed, primaryLocationId: refreshedPrimary } = await getCustomerLocations(customerId)
      setLocations(refreshed)
      setPrimaryLocationId(refreshedPrimary)
      setServiceLocationId(result.id)
      setLocationMode('existing')
      setNewLocationAddr({})
      setLocationEditName('')
      setLocationGated(false)
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingLocation(false)
    }
  }

  const handleUpdateLocation = async () => {
    if (!serviceLocationId) {
      setLocationError('Select a location first.')
      return
    }
    if (!newLocationAddr.addressLine1?.trim()) {
      setLocationError('Street address is required.')
      return
    }
    setSavingLocation(true)
    setLocationError(null)
    try {
      const result = await updateServiceLocation(serviceLocationId, {
        name: locationEditName.trim() || null,
        addressLine1: newLocationAddr.addressLine1,
        addressLine2: newLocationAddr.addressLine2 ?? null,
        city: newLocationAddr.city ?? null,
        state: newLocationAddr.state ?? null,
        postalCode: newLocationAddr.postalCode ?? null,
        gated: locationGated,
      })
      if (result.error) {
        setLocationError(result.error)
        return
      }
      if (customerId) {
        const { locations: refreshed, primaryLocationId: refreshedPrimary } = await getCustomerLocations(customerId)
        setLocations(refreshed)
        setPrimaryLocationId(refreshedPrimary)
      }
      setLocationMode('existing')
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingLocation(false)
    }
  }

  /** Detect auto-filled or redundant location names that equal the address. */
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
    newContactFirstName: customerMode === 'new' ? newContactFirstName : '',
    newContactLastName: customerMode === 'new' ? newContactLastName : '',
    newContactPhone: customerMode === 'new' ? normalizePhone(newContactPhone) : '',
    newContactEmail: customerMode === 'new' ? newContactEmail : '',
    newLocationAddress1: customerMode === 'new' ? newLocationAddress1 : '',
    newLocationAddress2: customerMode === 'new' ? newLocationAddress2 : '',
    newLocationCity: customerMode === 'new' ? newLocationCity : '',
    newLocationState: customerMode === 'new' ? newLocationState : '',
    newLocationPostalCode: customerMode === 'new' ? newLocationPostalCode : '',
    contactId: customerMode === 'new' ? null : contactId,
    serviceLocationId: customerMode === 'new' ? null : serviceLocationId,
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {mode === 'create' ? 'New Estimate' : `Estimate #EST-${initial?.estimate.estimateNo ?? ''}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customerName || 'Select a customer to begin'}
          </p>
          {mode === 'edit' && initial?.convertedJob && (
            <p className="text-sm">
              <span className="text-muted-foreground">Converted to </span>
              <Link
                href={`/jobs/${initial.convertedJob.id}`}
                className="font-medium underline hover:text-foreground"
              >
                Job #{`JOB-${initial.convertedJob.jobNo}`}
              </Link>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
                      {initial?.convertedJob && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          <strong>This estimate is already converted to Job #{`JOB-${initial.convertedJob.jobNo}`}.</strong>
                          <br />
                          Clicking Convert again will create a duplicate job. Use this only if you intentionally need a second job from the same estimate.
                        </div>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleConvert} disabled={converting} variant={initial?.convertedJob ? 'destructive' : 'default'}>
                      {converting && <Loader2 className="mr-1 size-4 animate-spin" />}
                      {initial?.convertedJob ? 'Convert Anyway' : 'Convert'}
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
            <SelectTrigger className="w-64">
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
            <Label>Customer *</Label>
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
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Customer name *"
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
                    setContactId(null)
                    setServiceLocationId(null)
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contact first name</Label>
                  <Input
                    value={newContactFirstName}
                    onChange={(e) => setNewContactFirstName(e.target.value)}
                    placeholder="First name (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact last name</Label>
                  <Input
                    value={newContactLastName}
                    onChange={(e) => setNewContactLastName(e.target.value)}
                    placeholder="Last name (optional)"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contact phone</Label>
                  <Input
                    type="tel"
                    value={formatPhoneInput(newContactPhone)}
                    onChange={(e) => setNewContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact email</Label>
                  <Input
                    type="email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Service location address</Label>
                <AddressAutocomplete
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
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={newLocationCity}
                    onChange={(e) => setNewLocationCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={newLocationState}
                    onChange={(e) => setNewLocationState(e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ZIP</Label>
                  <Input
                    value={newLocationPostalCode}
                    onChange={(e) => setNewLocationPostalCode(e.target.value)}
                    placeholder="ZIP"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* ── Contact ── */}
              <div className="space-y-2">
                <Label>Contact</Label>
                {!customerId ? (
                  <Select disabled>
                    <SelectTrigger className="w-full opacity-50">
                      <SelectValue placeholder="Select a customer first…" />
                    </SelectTrigger>
                  </Select>
                ) : contactMode === 'new' ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={newContactFirstName}
                        onChange={(e) => setNewContactFirstName(e.target.value)}
                        placeholder="First name (optional)"
                      />
                      <Input
                        value={newContactLastName}
                        onChange={(e) => setNewContactLastName(e.target.value)}
                        placeholder="Last name (optional)"
                      />
                    </div>
                    <Input
                      type="tel"
                      value={formatPhoneInput(newContactPhone)}
                      onChange={(e) => setNewContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Phone number (optional)"
                    />
                    <Input
                      type="email"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      placeholder="Email (optional)"
                    />
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setContactMode('existing')
                          setNewContactFirstName('')
                          setNewContactLastName('')
                          setNewContactPhone('')
                          setNewContactEmail('')
                          setContactError(null)
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ← Use existing contact
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingContact}
                        onClick={handleSaveNewContact}
                      >
                        {savingContact ? 'Saving…' : 'Save Contact'}
                      </Button>
                    </div>
                    {contactError && (
                      <p className="text-xs text-destructive">{contactError}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <Select
                      value={contactId ?? ''}
                      onValueChange={(val) => {
                        const v = val ?? ''
                        if (v === '__new__') {
                          setContactMode('new')
                          setContactId(null)
                        } else if (v === '') {
                          setContactId(null)
                        } else {
                          setContactId(v)
                        }
                      }}
                      disabled={!customerId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select contact…">
                          {contactId
                            ? (() => {
                                const c = contacts.find((c) => c.id === contactId)
                                if (c) return `${c.firstName} ${c.lastName ?? ''}`.trim()
                                if (contactsLoading) return 'Loading…'
                                return contactId
                              })()
                            : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Select contact…</SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                            {c.id === primaryContactId ? ' (Primary)' : ''}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">+ Create new contact…</SelectItem>
                      </SelectContent>
                    </Select>

                    {contactId && customerId && (
                      <div className="flex items-center gap-2 pt-0.5">
                        {contactId === primaryContactId ? (
                          <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                            <Star className="size-3 fill-amber-500 text-amber-500" />
                            Primary Contact
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs"
                            onClick={async () => {
                              const result = await setPrimaryContactAction(customerId, contactId)
                              if (result.success) setPrimaryContactId(contactId)
                            }}
                          >
                            <Star className="size-3" />
                            Set as Primary
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Service Location ── */}
              <div className="space-y-2">
                <Label>Service Location</Label>
                {!customerId ? (
                  <Select disabled>
                    <SelectTrigger className="w-full opacity-50">
                      <SelectValue placeholder="Select a customer first…" />
                    </SelectTrigger>
                  </Select>
                ) : locationMode === 'existing' && serviceLocationId ? (
                  <>
                    {(() => {
                      const loc = locations.find((l) => l.id === serviceLocationId)
                      const cityStateZip = loc
                        ? [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')
                        : ''
                      return (
                        <div className="rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm">
                          <div className="space-y-0.5">
                            {loc ? (
                              <>
                                {!isRedundantLocationName(loc.name, loc.addressLine1, loc.city) && (
                                  <div className="font-medium">{loc.name}</div>
                                )}
                                {loc.addressLine1 && (
                                  <div className="text-muted-foreground">{loc.addressLine1}</div>
                                )}
                                {loc.addressLine2 && (
                                  <div className="text-muted-foreground">{loc.addressLine2}</div>
                                )}
                                {cityStateZip && (
                                  <div className="text-muted-foreground">{cityStateZip}</div>
                                )}
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {loc.id === primaryLocationId && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Primary
                                    </Badge>
                                  )}
                                  {loc.gated && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      Gated Property
                                    </Badge>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Loading…</span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {serviceLocationId === primaryLocationId ? (
                              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                <Star className="size-3 fill-amber-500 text-amber-500" />
                                Primary
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await setPrimaryLocationAction(customerId, serviceLocationId)
                                  if (result.success) setPrimaryLocationId(serviceLocationId)
                                }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Star className="size-3" />
                                Set as Primary
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setLocationMode('edit')}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Edit address
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setServiceLocationId(null)
                                setLocationError(null)
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Change location
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLocationMode('new')
                                setServiceLocationId(null)
                                setNewLocationAddr({})
                                setLocationEditName('')
                                setLocationGated(false)
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              + New address
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <>
                    {locationMode === 'existing' && (
                      <Select
                        value={serviceLocationId ?? ''}
                        onValueChange={(val) => {
                          const v = val ?? ''
                          setLocationError(null)
                          if (v === '__new__') {
                            setLocationMode('new')
                            setServiceLocationId(null)
                            setNewLocationAddr({})
                            setLocationEditName('')
                            setLocationGated(false)
                          } else if (v === '') {
                            setServiceLocationId(null)
                          } else {
                            setLocationMode('existing')
                            setServiceLocationId(v)
                          }
                        }}
                        disabled={!customerId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select location…">
                            {serviceLocationId
                              ? (() => {
                                  const l = locations.find((x) => x.id === serviceLocationId)
                                  if (l) return l.name || [l.addressLine1, l.city, l.state].filter(Boolean).join(', ')
                                  if (locationsLoading) return 'Loading…'
                                  return serviceLocationId
                                })()
                              : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Select location…</SelectItem>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name || [l.addressLine1, l.city, l.state].filter(Boolean).join(', ')}
                            {l.id === primaryLocationId ? ' (Primary)' : ''}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">+ New address…</SelectItem>
                      </SelectContent>
                    </Select>
                    )}

                    {(locationMode === 'new' || locationMode === 'edit') && (
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Location name</Label>
                          <Input
                            value={locationEditName}
                            onChange={(e) => setLocationEditName(e.target.value)}
                            placeholder="e.g. Main residence"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Address</Label>
                          <AddressAutocomplete
                            key={locationFormKey}
                            defaultValue={newLocationAddr.addressLine1 ?? ''}
                            placeholder="Start typing an address…"
                            onAddressSelect={(result) => {
                              setNewLocationAddr((prev) => ({
                                ...result,
                                addressLine2: prev.addressLine2,
                              }))
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={newLocationAddr.addressLine2 ?? ''}
                            onChange={(e) =>
                              setNewLocationAddr((prev) => ({ ...prev, addressLine2: e.target.value }))
                            }
                            placeholder="Apt / suite / unit"
                          />
                          <Input
                            value={newLocationAddr.city ?? ''}
                            onChange={(e) => setNewLocationAddr((prev) => ({ ...prev, city: e.target.value }))}
                            placeholder="City"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={newLocationAddr.state ?? ''}
                            onChange={(e) => setNewLocationAddr((prev) => ({ ...prev, state: e.target.value }))}
                            placeholder="State"
                          />
                          <Input
                            value={newLocationAddr.postalCode ?? ''}
                            onChange={(e) =>
                              setNewLocationAddr((prev) => ({ ...prev, postalCode: e.target.value }))
                            }
                            placeholder="ZIP"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="location-gated"
                            checked={locationGated}
                            onCheckedChange={(c) => setLocationGated(c === true)}
                          />
                          <Label htmlFor="location-gated" className="cursor-pointer text-sm">
                            Gated Property
                          </Label>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setLocationMode('existing')
                              setLocationError(null)
                              if (!serviceLocationId) setNewLocationAddr({})
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            ← Cancel
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingLocation}
                            onClick={locationMode === 'edit' ? handleUpdateLocation : handleSaveNewLocation}
                          >
                            {savingLocation
                              ? 'Saving…'
                              : locationMode === 'edit'
                                ? 'Update Location'
                                : 'Save Location'}
                          </Button>
                        </div>
                        {locationError && (
                          <p className="text-xs text-destructive">{locationError}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId ?? ''} onValueChange={(v) => setCategoryId(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category">
                    {categoryId
                      ? referenceData.jobCategories.find((c) => c.id === categoryId)?.name ?? categoryId
                      : null}
                  </SelectValue>
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
              <Label>PO Number</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO #" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
            onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work or scope"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>On-site Visit Date</Label>
              <Input type="date" value={onSiteDate} onChange={(e) => setOnSiteDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Arrival Window</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={arrivalWindowStart}
                  onChange={(e) => setArrivalWindowStart(e.target.value)}
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="time"
                  value={arrivalWindowEnd}
                  onChange={(e) => setArrivalWindowEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assigned Techs</Label>
            <TechSelect
              members={referenceData.orgMembers.filter(
                (m) => m.role === 'org:technician' || m.role === 'org:admin',
              )}
              defaultSelected={assigneeUserIds}
              onChange={setAssigneeUserIds}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagSelect
              availableTags={referenceData.availableTags}
              defaultSelected={referenceData.availableTags.filter((t) => tagIds.includes(t.id))}
              onChange={(selected) => setTagIds(selected.map((t) => t.id))}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes for Techs</Label>
            <Textarea
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
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger>
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
          </div>

          <div className="space-y-2">
            <Label>Opportunity Rating</Label>
            <StarPicker value={opportunityRating} onChange={setOpportunityRating} />
          </div>

          <div className="space-y-2">
            <Label>Referral Source</Label>
            <Select
              value={referralSourceId ?? ''}
              onValueChange={(v) => setReferralSourceId(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source">
                  {referralSourceId
                    ? referenceData.jobSources.find((s) => s.id === referralSourceId)?.name ?? referralSourceId
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No source</SelectItem>
                {referenceData.jobSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Follow-up Date</Label>
              <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sales Rep</Label>
            <Select
              value={assignedAgentId ?? ''}
              onValueChange={(v) => setAssignedAgentId(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select rep">
                  {assignedAgentId
                    ? referenceData.orgMembers.find((m) => m.id === assignedAgentId)?.label ?? assignedAgentId
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {referenceData.orgMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Not shown on the customer-facing PDF"
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border bg-card p-6 space-y-6">
        <h2 className="text-xl font-semibold">Line Items</h2>
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
