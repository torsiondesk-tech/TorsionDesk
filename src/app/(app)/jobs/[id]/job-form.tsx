'use client'

import { useActionState, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CustomerSearch } from '@/components/customer-search'
import { TagSelect, type TagOption } from '@/components/tag-select'
import { TechSelect } from '@/components/tech-select'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { TimeWindowPicker } from '@/components/ui/time-window-picker'
import { LocationPickerFields } from '@/components/location-picker-fields'
import { ContactPickerFields } from '@/components/contact-picker-fields'
import { useLocationPicker } from '@/hooks/use-location-picker'
import { useContactPicker } from '@/hooks/use-contact-picker'
import { capitalizeWords } from '@/lib/utils'
import {
  createJob,
  updateJob,
  type JobActionState,
  getCustomerContacts,
  getCustomerLocations,
  listJobTemplatesAction,
  applyTemplateAction,
} from '../actions'
import { renameCustomerAction } from '../../customers/actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { StatusDropdown } from './status-dropdown'
import { LineItems } from './line-items'
import {
  GroupedLineItems,
  type LineItemGroup,
  type LineItemRow,
} from '@/components/line-items/grouped-line-items'
import { Plus } from 'lucide-react'
import { logger } from '@/lib/logger'
import { ContactEditor, type ContactEditorValue, emptyContact } from '@/components/contact-editor'

export interface JobFormLineItem {
  id?: string
  type: 'product' | 'service' | 'discount' | 'expense'
  refId?: string | null
  title?: string | null
  description: string
  qty: string
  rate: string
  cost: string
  taxItemId?: string | null
}

export interface JobFormData {
  id?: string
  customerId?: string
  customerName?: string
  contactId?: string | null
  serviceLocationId?: string | null
  categoryId?: string | null
  description?: string | null
  poNumber?: string | null
  jobSourceId?: string | null
  assignedAgentId?: string | null
  status?: string
  billingType?: string
  priority?: string | null
  startDate?: string | null
  endDate?: string | null
  arrivalWindowStart?: string | null
  arrivalWindowEnd?: string | null
  estimatedDuration?: number | null
  reminderLeadHours?: number | null
  multiDay?: boolean
  requiresFollowUp?: boolean
  isRepeating?: boolean
  repeatFrequency?: string | null
  repeatEndDate?: string | null
  notesForTechs?: string | null
  completionNotes?: string | null
  paymentTermsDays?: number | null
  jobPaymentMethod?: string | null
  checkRefNo?: string | null
  tagIds?: string[]
  assigneeUserIds?: string[]
  lineItems?: JobFormLineItem[]
  lineItemGroups?: LineItemGroup[]
  contact?: {
    id: string
    firstName: string
    lastName: string
    jobTitle?: string
    phones: Array<{ id?: string; number: string; ext?: string | null; type: string; isPrimary: boolean }>
    emails: Array<{ id?: string; address: string; type: string; isPrimary: boolean }>
    smsConsent?: boolean
    billingContact?: boolean
    bookingContact?: boolean
  }
}

interface ReferenceData {
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  jobSources: Array<{ id: string; name: string }>
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  availableTags: TagOption[]
  productCategories: Array<{ id: string; name: string }>
  orgMembers: Array<{ id: string; label: string; role: string | null }>
  salesReps: Array<{ id: string; name: string }>
}

interface JobFormProps {
  mode: 'create' | 'edit'
  orgId?: string
  initial?: JobFormData
  referenceData: ReferenceData
  primaryLocationId?: string | null
  primaryContactId?: string | null
  defaults?: {
    customerId?: string
    customerName?: string
    contactId?: string
    locationId?: string
  }
  onSuccess?: () => void
  onCancel?: () => void
  rightPanelExtras?: React.ReactNode
}

/** Detect auto-filled or redundant location names that equal the address. */

export function JobForm({ mode, orgId, initial, referenceData, primaryLocationId, primaryContactId: initialPrimaryContactId, defaults, onSuccess, onCancel, rightPanelExtras }: JobFormProps) {
  const router = useRouter()
  const action = mode === 'create' ? createJob : updateJob
  const [state, formAction, pending] = useActionState<JobActionState, FormData>(
    action,
    {},
  )

  // Redirect on create success; call onSuccess in edit mode
  useEffect(() => {
    if (state.success && state.id) {
      if (mode === 'create') {
        router.push(`/jobs/${state.id}`)
      } else {
        onSuccess?.()
      }
    }
  }, [state, router, mode, onSuccess])

  // Customer create-or-select modes
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [contactMode, setContactMode] = useState<'existing' | 'new'>('existing')
  const [inlineNewContact, setInlineNewContact] = useState<ContactEditorValue>(emptyContact())
  const [searchKey, setSearchKey] = useState(0)
  const autoSelectRef = useRef(false)

  // New-customer first-location state (separate from picker; no customerId yet to attach to)
  const [newCustLocationName, setNewCustLocationName] = useState('')
  const [newCustLocationAddress1, setNewCustLocationAddress1] = useState('')
  const [newCustLocationAddress2, setNewCustLocationAddress2] = useState('')
  const [newCustLocationCity, setNewCustLocationCity] = useState('')
  const [newCustLocationState, setNewCustLocationState] = useState('')
  const [newCustLocationZip, setNewCustLocationZip] = useState('')
  const [newCustLocationGated, setNewCustLocationGated] = useState(false)

  // Dialog shown in edit mode when user types while a customer is selected
  const [renameDialog, setRenameDialog] = useState(false)
  const [renameInput, setRenameInput] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  // Arrival time window (controlled for cross-field validation)
  const [arrivalStart, setArrivalStart] = useState(initial?.arrivalWindowStart ?? '')
  const [arrivalEnd, setArrivalEnd] = useState(initial?.arrivalWindowEnd ?? '')
  const arrivalTimeError =
    arrivalStart && arrivalEnd && arrivalEnd <= arrivalStart
      ? 'End time must be later than start time.'
      : null

  // Booleans
  const [multiDay, setMultiDay] = useState(initial?.multiDay ?? false)
  const [requiresFollowUp, setRequiresFollowUp] = useState(
    initial?.requiresFollowUp ?? false,
  )
  const [isRepeating, setIsRepeating] = useState(initial?.isRepeating ?? false)

  // Payment fields
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    initial?.paymentTermsDays != null ? String(initial.paymentTermsDays) : '',
  )
  const [jobPaymentMethod, setJobPaymentMethod] = useState(initial?.jobPaymentMethod ?? '')

  // Enum selects (controlled so labels display correctly before popup opens)
  const [priority, setPriority] = useState(initial?.priority ?? 'normal')
  const [reminderLeadHours, setReminderLeadHours] = useState(
    initial?.reminderLeadHours != null ? String(initial.reminderLeadHours) : '',
  )
  const [billingType, setBillingType] = useState(initial?.billingType ?? 'single_invoice')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [jobSourceId, setJobSourceId] = useState(initial?.jobSourceId ?? '')
  const [assignedAgentId, setAssignedAgentId] = useState(initial?.assignedAgentId ?? '')
  const [repeatFrequency, setRepeatFrequency] = useState(initial?.repeatFrequency ?? '')

  // Customer + dependent selects
  const [customerId, setCustomerId] = useState<string | undefined>(
    initial?.customerId ?? defaults?.customerId ?? undefined,
  )
  const [customerName, setCustomerName] = useState(initial?.customerName ?? defaults?.customerName ?? '')

  const locationPicker = useLocationPicker({
    customerId,
    initialLocationId: initial?.serviceLocationId ?? defaults?.locationId,
    initialPrimaryLocationId: primaryLocationId,
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
                  isPrimary: p.isPrimary,
                }))
              : [{ number: '', ext: '', type: 'cell', isPrimary: true }],
          emails:
            initial.contact.emails.length > 0
              ? initial.contact.emails.map((e) => ({
                  id: e.id,
                  address: e.address,
                  type: e.type,
                  isPrimary: e.isPrimary,
                }))
              : [{ address: '', type: 'work', isPrimary: true }],
          smsConsent: initial.contact.smsConsent ?? false,
          billingContact: initial.contact.billingContact ?? false,
          bookingContact: initial.contact.bookingContact ?? false,
        }
      : null,
    initialPrimaryContactId: initialPrimaryContactId,
  })

  // contactId and locationId now live in the picker hooks; seed them from initial/defaults
  useEffect(() => {
    if (initial?.contactId) contactPicker.setContactId(initial.contactId)
    else if (defaults?.contactId) contactPicker.setContactId(defaults.contactId)
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Templates
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  // Load templates on mount (create mode)
  useEffect(() => {
    if (mode === 'create') {
      listJobTemplatesAction()
        .then((rows) => {
          if (rows && Array.isArray(rows)) setTemplates(rows)
        })
        .catch((err) => {
          logger.error('loadJobTemplates', err)
        })
    }
  }, [mode])

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return
    setApplyingTemplate(true)
    setTemplateError(null)
    try {
      const result = await applyTemplateAction(selectedTemplateId)
      if (result.error) {
        setTemplateError(result.error)
        logger.error('applyTemplate', result.error)
        return
      }
      if (result.lineItems) {
        setLineItems(
          result.lineItems.map((li) => ({
            id: crypto.randomUUID(),
            type: li.type,
            refId: li.refId ?? null,
            title: li.title ?? null,
            description: li.description,
            qty: li.qty,
            rate: li.rate,
            cost: li.cost,
            taxItemId: li.taxItemId ?? null,
          })),
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setTemplateError(message)
      logger.error('applyTemplate', err)
    } finally {
      setApplyingTemplate(false)
    }
  }

  // Line items state (synced from initial or local)
  const [lineItems, setLineItems] = useState<LineItemRow[]>(
    (initial?.lineItems ?? []) as LineItemRow[],
  )
  const [lineItemGroups, setLineItemGroups] = useState<LineItemGroup[]>(
    initial?.lineItemGroups ?? [],
  )

  // Sync line items from server props after router.refresh()
  useEffect(() => {
    if (initial?.lineItems) {
      setLineItems(initial.lineItems as LineItemRow[])
    }
  }, [initial?.lineItems])

  // Sync line item groups from server props after router.refresh()
  useEffect(() => {
    if (initial?.lineItemGroups) {
      setLineItemGroups(initial.lineItemGroups)
    }
  }, [initial?.lineItemGroups])

  // Sync arrival window state after router.refresh()
  useEffect(() => {
    setArrivalStart(initial?.arrivalWindowStart ?? '')
    setArrivalEnd(initial?.arrivalWindowEnd ?? '')
  }, [initial?.arrivalWindowStart, initial?.arrivalWindowEnd])

  // Sync reminder lead time after router.refresh()
  useEffect(() => {
    setReminderLeadHours(initial?.reminderLeadHours != null ? String(initial.reminderLeadHours) : '')
  }, [initial?.reminderLeadHours])

  // Fetch contacts and locations when customer changes; push data into pickers via hydrate
  useEffect(() => {
    if (!customerId) {
      contactPicker.hydrate([], null)
      locationPicker.hydrate([], null)
      return
    }
    let cancelled = false
    ;(async () => {
      const [{ contacts: c, primaryContactId: pcId }, { locations: l, primaryLocationId: plId }] = await Promise.all([
        getCustomerContacts(customerId),
        getCustomerLocations(customerId),
      ])
      if (!cancelled) {
        contactPicker.hydrate(c, pcId)
        locationPicker.hydrate(l, plId)
        if (autoSelectRef.current) {
          const autoContact = pcId ? c.find((x) => x.id === pcId) : c[0]
          if (autoContact) contactPicker.setContactId(autoContact.id)
          if (l.length > 0) locationPicker.setLocationId(l[0].id)
          autoSelectRef.current = false
        }
      }
    })()
    return () => {
      cancelled = true
    }
  // contactPicker and locationPicker are stable (hooks); adding them would cause extra fetches
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const handleCustomerChange = useCallback((id: string | null) => {
    if (id) {
      autoSelectRef.current = true
      setCustomerId(id)
      setCustomerMode('existing')
      contactPicker.resetForCustomerChange()
      locationPicker.resetForCustomerChange()
    } else {
      setCustomerId(undefined)
      contactPicker.resetForCustomerChange()
      locationPicker.resetForCustomerChange()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateNewCustomer = useCallback((name: string) => {
    setCustomerMode('new')
    setNewCustomerName(capitalizeWords(name))
    setCustomerId(undefined)
    setContactMode('new')
    setInlineNewContact(emptyContact())
    contactPicker.resetForCustomerChange()
    locationPicker.resetForCustomerChange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fired when the user types in the customer field while a customer is already selected (edit mode)
  const handleReplaceIntent = useCallback((typedChar: string) => {
    setRenameInput(typedChar)
    setRenameError(null)
    setRenameDialog(true)
  }, [])

  const handleRenameCustomer = useCallback(async () => {
    if (!customerId || !renameInput.trim()) return
    setRenaming(true)
    setRenameError(null)
    const result = await renameCustomerAction(customerId, renameInput)
    setRenaming(false)
    if (result.error) {
      setRenameError(result.error)
      return
    }
    setCustomerName(renameInput.trim())
    setSearchKey((k) => k + 1)
    setRenameDialog(false)
  }, [customerId, renameInput])

  const handleConfirmChangeCustomer = useCallback(() => {
    setRenameDialog(false)
    handleCustomerChange(null)
    setSearchKey((k) => k + 1)
  }, [handleCustomerChange])

  const handleClearNewCustomer = useCallback(() => {
    setCustomerMode('existing')
    setNewCustomerName('')
    setCustomerId(undefined)
    setContactMode('existing')
    setInlineNewContact(emptyContact())
    contactPicker.resetForCustomerChange()
    locationPicker.resetForCustomerChange()
    setNewCustLocationName('')
    setNewCustLocationAddress1('')
    setNewCustLocationAddress2('')
    setNewCustLocationCity('')
    setNewCustLocationState('')
    setNewCustLocationZip('')
    setNewCustLocationGated(false)
    setSearchKey((k) => k + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const defaultTags = referenceData.availableTags.filter((t) =>
    initial?.tagIds?.includes(t.id),
  )

  const title = mode === 'create' ? 'New Job' : `Edit Job`
  const cta = mode === 'create' ? 'Create Job' : 'Save Job'

  // Build hierarchical categories for select
  const topCategories = referenceData.jobCategories.filter((c) => !c.parentId)
  const childCategories = referenceData.jobCategories.filter((c) => c.parentId)

  return (
    <div className="animate-in fade-in-0 duration-300">
      {/* Customer rename / change dialog — fires on first keystroke in edit mode */}
      <Dialog open={renameDialog} onOpenChange={(open) => { if (!open) setRenameDialog(false) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Change Customer</DialogTitle>
            <DialogDescription>
              You&apos;re editing a job for <strong>{customerName}</strong>. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {/* Rename option */}
            <div className="space-y-2 rounded-lg border bg-card p-3">
              <div className="font-medium text-sm">Rename this customer</div>
              <Input
                aria-label="New customer name"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="New customer name"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameCustomer() } }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Updates the customer record — all their jobs will reflect the new name.
              </p>
              <Button
                type="button"
                size="sm"
                disabled={renaming || !renameInput.trim()}
                onClick={handleRenameCustomer}
              >
                {renaming ? 'Saving…' : 'Rename Customer'}
              </Button>
            </div>
            {/* Change to different customer option */}
            <button
              type="button"
              onClick={handleConfirmChangeCustomer}
              disabled={renaming}
              className="w-full rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/50 disabled:opacity-50"
            >
              <div className="font-medium text-sm">Change to a different customer</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Search for another existing customer or create a new one.
              </div>
            </button>
          </div>
          {renameError && <p className="text-xs text-destructive">{renameError}</p>}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <form action={formAction} autoComplete="off" className="space-y-6">
        {mode === 'edit' && initial?.id && (
          <input type="hidden" name="id" value={initial.id} />
        )}
        <input type="hidden" name="customerId" value={customerId ?? ''} />
        {/* Contact hidden inputs for existing-customer path */}
        {customerMode !== 'new' && (
          <>
            <input type="hidden" name="contactId" value={contactPicker.contactId ?? ''} />
            {contactPicker.contactEdit && contactPicker.contactId && (
              <input type="hidden" name="contactUpdate" value={contactPicker.toFormFields().contactUpdate} />
            )}
          </>
        )}
        {/* New-customer path: empty contactId (contact data is in newContactJson from inlineNewContact) */}
        {customerMode === 'new' && contactMode === 'new' && (
          <input type="hidden" name="contactId" value="" />
        )}
        {/* Location hidden inputs for existing-customer path */}
        {customerMode !== 'new' && (
          <>
            <input type="hidden" name="serviceLocationId" value={locationPicker.toFormFields().serviceLocationId} />
            <input type="hidden" name="newLocationName" value={locationPicker.toFormFields().newLocationName} />
            <input type="hidden" name="newLocationAddress1" value={locationPicker.toFormFields().newLocationAddress1} />
            <input type="hidden" name="newLocationAddress2" value={locationPicker.toFormFields().newLocationAddress2} />
            <input type="hidden" name="newLocationCity" value={locationPicker.toFormFields().newLocationCity} />
            <input type="hidden" name="newLocationState" value={locationPicker.toFormFields().newLocationState} />
            <input type="hidden" name="newLocationZip" value={locationPicker.toFormFields().newLocationZip} />
            <input type="hidden" name="newLocationGated" value={locationPicker.toFormFields().newLocationGated} />
            <input type="hidden" name="newLocationLat" value={locationPicker.toFormFields().newLocationLat} />
            <input type="hidden" name="newLocationLng" value={locationPicker.toFormFields().newLocationLng} />
          </>
        )}
        {/* New-customer path: location fields have name= attributes for native form submission */}
        {customerMode === 'new' && (
          <input type="hidden" name="serviceLocationId" value="" />
        )}
        <input
          type="hidden"
          name="lineItems"
          value={JSON.stringify(lineItems)}
        />
        <input
          type="hidden"
          name="lineItemGroups"
          value={JSON.stringify(lineItemGroups)}
        />

        {/* Top action bar — duplicated for easy access on long job forms (desktop only) */}
        <div className="hidden md:flex items-center justify-end gap-3">
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {mode === 'edit' && onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={pending || !!arrivalTimeError}>
            {pending ? 'Saving…' : cta}
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* ── LEFT PANEL: Details ── */}
          <div className="space-y-5 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Details</h2>

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
                    aria-label="New customer name"
                    name="newCustomerName"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(capitalizeWords(e.target.value))}
                    placeholder="Customer name *"
                    className="capitalize"
                    required
                  />
                </div>
              ) : (
                <CustomerSearch
                  key={searchKey}
                  name="customerIdDisplay"
                  defaultValue={customerId}
                  defaultLabel={customerName}
                  onChange={handleCustomerChange}
                  allowCreate={mode === 'create'}
                  onCreateNew={handleCreateNewCustomer}
                  onReplaceIntent={mode === 'edit' && !!customerId ? handleReplaceIntent : undefined}
                />
              )}
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium leading-none">Contact</p>
              {customerMode === 'new' ? (
                <div className="space-y-3">
                  <input type="hidden" name="newContactJson" value={JSON.stringify(inlineNewContact)} />
                  <ContactEditor
                    value={inlineNewContact}
                    onChange={setInlineNewContact}
                    idPrefix="job-inline-nc"
                  />
                </div>
              ) : (
                <ContactPickerFields
                  picker={contactPicker}
                  customerId={customerId}
                  idPrefix="job"
                />
              )}
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium leading-none">Service Location</p>
              {customerMode === 'new' ? (
                // New customer — collect first location inline; no customerId yet, so the picker
                // cannot save to DB. Fields carry name= attributes for native form submission.
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="job-new-cust-loc-name" className="text-xs">Location Name</Label>
                      <Input
                        id="job-new-cust-loc-name"
                        name="newLocationName"
                        value={newCustLocationName}
                        onChange={(e) => setNewCustLocationName(e.target.value)}
                        placeholder="e.g. Home or Office"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 pt-5">
                      <Checkbox
                        id="job-new-cust-loc-gated"
                        checked={newCustLocationGated}
                        onCheckedChange={(c) => setNewCustLocationGated(c === true)}
                      />
                      {/* Hidden input carries 'true'/'false' so zod's v === 'true' preprocessor works */}
                      <input type="hidden" name="newLocationGated" value={newCustLocationGated ? 'true' : 'false'} />
                      <Label htmlFor="job-new-cust-loc-gated" className="cursor-pointer text-sm">
                        Gated Property
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="job-new-cust-loc-addr1" className="text-xs">Street Address</Label>
                      <AddressAutocomplete
                        id="job-new-cust-loc-addr1"
                        name="newLocationAddress1"
                        defaultValue={newCustLocationAddress1}
                        placeholder="Start typing an address…"
                        onAddressSelect={(result) => {
                          setNewCustLocationAddress1(result.addressLine1 ?? '')
                          setNewCustLocationCity(result.city ?? '')
                          setNewCustLocationState(result.state ?? '')
                          setNewCustLocationZip(result.postalCode ?? '')
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="job-new-cust-loc-addr2" className="text-xs">Unit</Label>
                      <Input
                        id="job-new-cust-loc-addr2"
                        name="newLocationAddress2"
                        value={newCustLocationAddress2}
                        onChange={(e) => setNewCustLocationAddress2(e.target.value)}
                        placeholder="Ste/Unit/Apt"
                        className="w-32"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="job-new-cust-loc-city" className="text-xs">City</Label>
                      <Input
                        id="job-new-cust-loc-city"
                        name="newLocationCity"
                        value={newCustLocationCity}
                        onChange={(e) => setNewCustLocationCity(e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="job-new-cust-loc-state" className="text-xs">State</Label>
                      <Input
                        id="job-new-cust-loc-state"
                        name="newLocationState"
                        value={newCustLocationState}
                        onChange={(e) => setNewCustLocationState(e.target.value)}
                        placeholder="State"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="job-new-cust-loc-zip" className="text-xs">Zip</Label>
                      <Input
                        id="job-new-cust-loc-zip"
                        name="newLocationZip"
                        value={newCustLocationZip}
                        onChange={(e) => setNewCustLocationZip(e.target.value)}
                        placeholder="Zip/Postal Code"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <LocationPickerFields
                  picker={locationPicker}
                  customerId={customerId}
                  idPrefix="job"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Job Category</Label>
              <Select name="categoryId" value={categoryId} onValueChange={(v) => { if (v !== undefined) setCategoryId(v ?? '') }}>
                <SelectTrigger id="categoryId" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {categoryId
                      ? (referenceData.jobCategories.find((c) => c.id === categoryId)?.name ?? categoryId)
                      : <span className="text-muted-foreground">Select category…</span>}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select category…</SelectItem>
                  {topCategories.map((parent) => (
                    <SelectGroup key={parent.id}>
                      <SelectLabel>{parent.name}</SelectLabel>
                      <SelectItem value={parent.id}>{parent.name}</SelectItem>
                      {childCategories
                        .filter((c) => c.parentId === parent.id)
                        .map((child) => {
                          const childText = `${'\xa0\xa0'}${child.name}`
                          return (
                            <SelectItem key={child.id} value={child.id}>
                              {childText}
                            </SelectItem>
                          )
                        })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={initial?.description ?? ''}
                placeholder="Job description…"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poNumber">PO #</Label>
              <Input
                id="poNumber"
                name="poNumber"
                defaultValue={initial?.poNumber ?? ''}
                placeholder="Purchase order number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobSourceId">Job Source</Label>
              <Select name="jobSourceId" value={jobSourceId} onValueChange={(v) => { if (v !== undefined) setJobSourceId(v ?? '') }}>
                <SelectTrigger id="jobSourceId" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {jobSourceId
                      ? (referenceData.jobSources.find((s) => s.id === jobSourceId)?.name ?? jobSourceId)
                      : <span className="text-muted-foreground">Select source…</span>}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select source…</SelectItem>
                  {referenceData.jobSources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedAgentId">Agent / Rep</Label>
              <Select name="assignedAgentId" value={assignedAgentId} onValueChange={(v) => { if (v !== undefined) setAssignedAgentId(v ?? '') }}>
                <SelectTrigger id="assignedAgentId" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {assignedAgentId
                      ? (referenceData.salesReps.find((r) => r.id === assignedAgentId)?.name ?? assignedAgentId)
                      : <span className="text-muted-foreground">Select rep…</span>}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select rep…</SelectItem>
                  {referenceData.salesReps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Tags</p>
              <TagSelect
                name="tagIds"
                availableTags={referenceData.availableTags}
                defaultSelected={defaultTags}
              />
            </div>
          </div>

          {/* ── RIGHT PANEL: Job Info ── */}
          <div className="space-y-5 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Job Info</h2>

            <div className="space-y-2">
              {mode === 'create' ? <Label htmlFor="jf-status">Status</Label> : <p className="text-sm font-medium leading-none">Status</p>}
              {mode === 'create' ? (
                <Select name="status" defaultValue="unscheduled">
                  <SelectTrigger id="jf-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unscheduled">Unscheduled</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="dispatched">Dispatched</SelectItem>
                    <SelectItem value="on_the_way">On The Way</SelectItem>
                    <SelectItem value="on_site">On Site</SelectItem>
                    <SelectItem value="started">Started</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="partially_completed">Partially Completed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              ) : initial?.id ? (
                <StatusDropdown
                  jobId={initial.id}
                  currentStatus={initial.status ?? 'unscheduled'}
                />
              ) : (
                <Badge variant="outline">Unscheduled</Badge>
              )}
            </div>

            <div className={multiDay ? 'grid gap-4 sm:grid-cols-2' : undefined}>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  key={`sd-${initial?.startDate ?? 'empty'}`}
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={initial?.startDate ?? ''}
                />
              </div>
              {multiDay && (
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    key={`ed-${initial?.endDate ?? 'empty'}`}
                    id="endDate"
                    name="endDate"
                    type="date"
                    defaultValue={initial?.endDate ?? ''}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Arrival Time Window</p>
              <TimeWindowPicker
                startValue={arrivalStart}
                endValue={arrivalEnd}
                onStartChange={setArrivalStart}
                onEndChange={setArrivalEnd}
                startName="arrivalWindowStart"
                endName="arrivalWindowEnd"
                startId="arrivalWindowStart"
                endId="arrivalWindowEnd"
                error={arrivalTimeError || undefined}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedDuration">Estimated Duration (minutes)</Label>
              <Input
                id="estimatedDuration"
                name="estimatedDuration"
                type="number"
                defaultValue={initial?.estimatedDuration ?? ''}
                placeholder="e.g. 120"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminderLeadHours">Appointment Reminder</Label>
              <Select
                name="reminderLeadHours"
                value={reminderLeadHours}
                onValueChange={(v) => setReminderLeadHours(v ?? '')}
              >
                <SelectTrigger id="reminderLeadHours" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {reminderLeadHours === ''
                      ? 'No SMS reminder'
                      : `${reminderLeadHours} hour${reminderLeadHours === '1' ? '' : 's'} before start`}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No SMS reminder</SelectItem>
                  <SelectItem value="1">1 hour before start</SelectItem>
                  <SelectItem value="2">2 hours before start</SelectItem>
                  <SelectItem value="4">4 hours before start</SelectItem>
                  <SelectItem value="24">24 hours before start</SelectItem>
                  <SelectItem value="48">48 hours before start</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <input
              type="hidden"
              name="multiDay"
              value={multiDay ? '1' : '0'}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="multiDay"
                checked={multiDay}
                onCheckedChange={(c) => setMultiDay(c === true)}
              />
              <Label htmlFor="multiDay" className="cursor-pointer">
                Multi-day job
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" value={priority} onValueChange={(v) => { if (v) setPriority(v) }}>
                <SelectTrigger id="priority" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {{ low: 'Low', normal: 'Normal', high: 'High', emergency: 'Emergency' }[priority] ?? priority}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Assigned Techs</p>
              <TechSelect
                members={referenceData.orgMembers.filter(
                  (m) => m.role === 'org:technician' || m.role === 'org:admin',
                )}
                defaultSelected={initial?.assigneeUserIds ?? []}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notesForTechs">Notes for Techs</Label>
              <Textarea
                id="notesForTechs"
                name="notesForTechs"
                defaultValue={initial?.notesForTechs ?? ''}
                placeholder="Instructions for technicians…"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="completionNotes">Completion Notes</Label>
              <Textarea
                id="completionNotes"
                name="completionNotes"
                defaultValue={initial?.completionNotes ?? ''}
                placeholder="Notes upon completion…"
                rows={2}
              />
            </div>

            <input
              type="hidden"
              name="requiresFollowUp"
              value={requiresFollowUp ? '1' : '0'}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="requiresFollowUp"
                checked={requiresFollowUp}
                onCheckedChange={(c) => setRequiresFollowUp(c === true)}
              />
              <Label htmlFor="requiresFollowUp" className="cursor-pointer">
                Requires follow-up
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingType">Billing Type</Label>
              <Select name="billingType" value={billingType} onValueChange={(v) => { if (v) setBillingType(v) }}>
                <SelectTrigger id="billingType" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {{ single_invoice: 'Single Invoice', progress_billing: 'Progress Billing', no_charge: 'No Charge' }[billingType] ?? billingType}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_invoice">Single Invoice</SelectItem>
                  <SelectItem value="progress_billing">Progress Billing</SelectItem>
                  <SelectItem value="no_charge">No Charge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Payment ── */}
            <div className="space-y-2">
              <Label htmlFor="jobPaymentMethod">Payment Method</Label>
              <input type="hidden" name="jobPaymentMethod" value={jobPaymentMethod} />
              <Select value={jobPaymentMethod} onValueChange={(v) => setJobPaymentMethod(v ?? '')}>
                <SelectTrigger id="jobPaymentMethod" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {jobPaymentMethod || <span className="text-muted-foreground">Select…</span>}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  <SelectItem value="Direct Bill">Direct Bill</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="COD">COD</SelectItem>
                  <SelectItem value="Financing">Financing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkRefNo">Check / Ref #</Label>
              <Input
                id="checkRefNo"
                name="checkRefNo"
                defaultValue={initial?.checkRefNo ?? ''}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentTermsDays">Terms</Label>
              <input type="hidden" name="paymentTermsDays" value={paymentTermsDays} />
              <Select value={paymentTermsDays} onValueChange={(v) => setPaymentTermsDays(v ?? '')}>
                <SelectTrigger id="paymentTermsDays" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {paymentTermsDays === ''
                      ? <span className="text-muted-foreground">Use org default</span>
                      : ({ '0': 'Due on Receipt', '15': 'Net 15', '30': 'Net 30', '45': 'Net 45', '60': 'Net 60' }[paymentTermsDays] ?? `Net ${paymentTermsDays}`)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Use org default</SelectItem>
                  <SelectItem value="0">Due on Receipt</SelectItem>
                  <SelectItem value="15">Net 15</SelectItem>
                  <SelectItem value="30">Net 30</SelectItem>
                  <SelectItem value="45">Net 45</SelectItem>
                  <SelectItem value="60">Net 60</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <input
              type="hidden"
              name="isRepeating"
              value={isRepeating ? '1' : '0'}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="isRepeating"
                checked={isRepeating}
                onCheckedChange={(c) => setIsRepeating(c === true)}
              />
              <Label htmlFor="isRepeating" className="cursor-pointer">
                Repeating Job
              </Label>
            </div>

            {isRepeating && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-2">
                  <Label htmlFor="repeatFrequency">Frequency</Label>
                  <Select name="repeatFrequency" value={repeatFrequency} onValueChange={(v) => { if (v) setRepeatFrequency(v) }}>
                    <SelectTrigger id="repeatFrequency" className="w-full">
                      <span className="flex flex-1 text-left text-sm">
                        {repeatFrequency
                          ? ({ daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[repeatFrequency] ?? repeatFrequency)
                          : <span className="text-muted-foreground">Select frequency…</span>}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repeatEndDate">End Date</Label>
                  <Input
                    id="repeatEndDate"
                    name="repeatEndDate"
                    type="date"
                    defaultValue={initial?.repeatEndDate ?? ''}
                  />
                </div>
              </div>
            )}

            {rightPanelExtras}
          </div>
        </div>

        {/* ── APPLY TEMPLATE (create mode only) ── */}
        {mode === 'create' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <p className="shrink-0 text-sm font-medium">Apply Template</p>
              {templates.length > 0 ? (
                <>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(val) => { setSelectedTemplateId(val ?? ''); setTemplateError(null) }}
                  >
                    <SelectTrigger className="h-9 flex-1" aria-label="Select job template">
                      <SelectValue placeholder="Select a template…">
                        {(value: string) => {
                          if (!value) return 'Select a template…'
                          const tmpl = templates.find((t) => t.id === value)
                          return tmpl?.name ?? value
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Select a template…</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedTemplateId || applyingTemplate}
                    onClick={handleApplyTemplate}
                  >
                    {applyingTemplate ? 'Applying…' : 'Apply'}
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No templates available.{' '}
                  <a href="/settings/job-templates" className="underline hover:text-foreground">
                    Create one in Settings → Templates
                  </a>
                </span>
              )}
            </div>
            {templateError && (
              <p className="text-sm text-destructive px-1">{templateError}</p>
            )}
          </div>
        )}

        {/* ── LINE ITEMS (full-width below grid) ── */}
        {lineItemGroups.length > 0 ? (
          <GroupedLineItems
            groups={lineItemGroups}
            lineItems={lineItems}
            onChange={(groups, items) => {
              setLineItemGroups(groups)
              setLineItems(items)
            }}
            referenceData={referenceData}
            jobId={mode === 'edit' ? initial?.id : undefined}
          />
        ) : (
          <div className="space-y-2">
            <LineItems
              jobId={mode === 'edit' ? initial?.id : undefined}
              items={lineItems as JobFormLineItem[]}
              onChange={setLineItems}
              referenceData={referenceData}
            />
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
                setLineItemGroups([defaultGroup])
                setLineItems(lineItems.map((i) => ({ ...i, groupId: defaultGroup.id })))
              }}
            >
              <Plus className="mr-1 size-4" /> Enable Line-Item Groups
            </Button>
          </div>
        )}

        {/* ── FORM FOOTER ── */}
        <div className="flex items-center gap-3 pt-2">
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending || !!arrivalTimeError}>
            {pending ? 'Saving…' : cta}
          </Button>
          {mode === 'edit' && onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
