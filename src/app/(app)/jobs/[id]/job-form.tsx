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
import type { ParsedAddress } from '@/lib/places-actions'
import { formatPhone, capitalizeWords } from '@/lib/utils'
import {
  createJob,
  updateJob,
  type JobActionState,
  getCustomerContacts,
  getCustomerContactDetail,
  type ContactDetail,
  getCustomerLocations,
  createServiceLocation,
  updateServiceLocation,
  createContactForJob,
  listJobTemplatesAction,
  applyTemplateAction,
} from '../actions'
import { setPrimaryContactAction, setPrimaryLocationAction, renameCustomerAction } from '../../customers/actions'
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
import { Plus, X, Phone, Mail, Trash2, Star } from 'lucide-react'
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
  const [contactPickerOpen, setContactPickerOpen] = useState(false)
  const [contactPickerSelected, setContactPickerSelected] = useState<string>('')
  const [inlineNewContact, setInlineNewContact] = useState<ContactEditorValue>(emptyContact())
  const [dialogNewContact, setDialogNewContact] = useState<ContactEditorValue>(emptyContact())
  const [dialogBirthday, setDialogBirthday] = useState('')
  const [dialogAnniversary, setDialogAnniversary] = useState('')
  const [newContactDialogOpen, setNewContactDialogOpen] = useState(false)
  const [savingNewContactDialog, setSavingNewContactDialog] = useState(false)
  const [newContactDialogError, setNewContactDialogError] = useState<string | null>(null)
  const [locationMode, setLocationMode] = useState<'existing' | 'new' | 'edit'>(
    initial?.serviceLocationId || defaults?.locationId ? 'existing' : 'new'
  )
  interface LocationAddrState extends Partial<ParsedAddress> {
    addressLine2?: string
  }
  const [newLocationAddr, setNewLocationAddr] = useState<LocationAddrState>({})
  const [locationEditName, setLocationEditName] = useState('')
  const [locationGated, setLocationGated] = useState(false)
  const [locationFormKey, setLocationFormKey] = useState(0)
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [savingContact, setSavingContact] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [searchKey, setSearchKey] = useState(0)
  const autoSelectRef = useRef(false)

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
  const [contacts, setContacts] = useState<Array<{ id: string; firstName: string; lastName: string | null; phone: string | null }>>([])
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; gated: boolean | null }>
  >([])

  const [contactId, setContactId] = useState<string | undefined>(
    initial?.contactId ?? defaults?.contactId ?? undefined,
  )
  const [locationId, setLocationId] = useState<string | undefined>(
    initial?.serviceLocationId ?? defaults?.locationId ?? undefined,
  )
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(initialPrimaryContactId ?? null)
  const [localPrimaryLocationId, setLocalPrimaryLocationId] = useState<string | null>(primaryLocationId ?? null)

  // Full contact editing state
  interface ContactEditState {
    id: string
    firstName: string
    lastName: string
    jobTitle: string
    phones: Array<{ id?: string; number: string; ext: string; type: string; isPrimary: boolean }>
    emails: Array<{ id?: string; address: string; type: string; isPrimary: boolean }>
    smsConsent: boolean
    billingContact: boolean
    bookingContact: boolean
  }

  const emptyContactEdit = (): ContactEditState => ({
    id: '',
    firstName: '',
    lastName: '',
    jobTitle: '',
    phones: [{ number: '', ext: '', type: 'cell', isPrimary: true }],
    emails: [{ address: '', type: 'work', isPrimary: true }],
    smsConsent: true,
    billingContact: false,
    bookingContact: false,
  })

  const [contactEdit, setContactEdit] = useState<ContactEditState | null>(() => {
    if (initial?.contact) {
      const c = initial.contact
      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        jobTitle: c.jobTitle ?? '',
        phones:
          c.phones.length > 0
            ? c.phones.map((p) => ({
                id: p.id,
                number: p.number,
                ext: (p as { ext?: string | null }).ext ?? '',
                type: p.type,
                isPrimary: p.isPrimary,
              }))
            : [{ number: '', ext: '', type: 'cell', isPrimary: true }],
        emails:
          c.emails.length > 0
            ? c.emails.map((e) => ({
                id: e.id,
                address: e.address,
                type: e.type,
                isPrimary: e.isPrimary,
              }))
            : [{ address: '', type: 'work', isPrimary: true }],
        smsConsent: c.smsConsent ?? false,
        billingContact: c.billingContact ?? false,
        bookingContact: c.bookingContact ?? false,
      }
    }
    return null
  })

  // Fetch full contact detail when contactId changes (existing contact)
  useEffect(() => {
    if (!contactId || contactMode === 'new') return
    let cancelled = false
    getCustomerContactDetail(contactId)
      .then((detail) => {
        if (!cancelled && detail) {
          setContactEdit({
            id: detail.id,
            firstName: detail.firstName,
            lastName: detail.lastName ?? '',
            jobTitle: detail.jobTitle ?? '',
            phones:
              detail.phones.length > 0
                ? detail.phones.map((p) => ({
                    id: p.id,
                    number: p.number,
                    ext: p.ext ?? '',
                    type: p.type,
                    isPrimary: p.isPrimary ?? false,
                  }))
                : [{ number: '', ext: '', type: 'cell', isPrimary: true }],
            emails:
              detail.emails.length > 0
                ? detail.emails.map((e) => ({
                    id: e.id,
                    address: e.address,
                    type: e.type,
                    isPrimary: e.isPrimary ?? false,
                  }))
                : [{ address: '', type: 'work', isPrimary: true }],
            smsConsent: detail.smsConsent ?? false,
            billingContact: detail.billingContact ?? false,
            bookingContact: detail.bookingContact ?? false,
          })
        }
      })
      .catch((err) => logger.error('loadContactDetail', err))
    return () => {
      cancelled = true
    }
  }, [contactId, contactMode])

  // Contact edit helpers
  const updateContactField = (
    field: keyof Omit<ContactEditState, 'phones' | 'emails'>,
    value: unknown,
  ) => {
    let normalized = value
    if ((field === 'firstName' || field === 'lastName') && typeof value === 'string') {
      normalized = capitalizeWords(value)
    }
    setContactEdit((prev) => (prev ? { ...prev, [field]: normalized } : prev))
  }

  const updateContactPhone = (
    pi: number,
    field: 'number' | 'ext' | 'type' | 'isPrimary',
    value: string | boolean,
  ) => {
    setContactEdit((prev) => {
      if (!prev) return prev
      const phones = [...prev.phones]
      phones[pi] = { ...phones[pi], [field]: value }
      return { ...prev, phones }
    })
  }

  const addContactPhone = () => {
    setContactEdit((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        phones: [...prev.phones, { number: '', ext: '', type: 'cell', isPrimary: false }],
      }
    })
  }

  const removeContactPhone = (pi: number) => {
    setContactEdit((prev) => {
      if (!prev) return prev
      return { ...prev, phones: prev.phones.filter((_, i) => i !== pi) }
    })
  }

  const updateContactEmail = (
    ei: number,
    field: 'address' | 'type' | 'isPrimary',
    value: string | boolean,
  ) => {
    setContactEdit((prev) => {
      if (!prev) return prev
      const emails = [...prev.emails]
      emails[ei] = { ...emails[ei], [field]: value }
      return { ...prev, emails }
    })
  }

  const addContactEmail = () => {
    setContactEdit((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        emails: [...prev.emails, { address: '', type: 'work', isPrimary: false }],
      }
    })
  }

  const removeContactEmail = (ei: number) => {
    setContactEdit((prev) => {
      if (!prev) return prev
      return { ...prev, emails: prev.emails.filter((_, i) => i !== ei) }
    })
  }

  // Save new location standalone (not via the job form submit)
  const handleSaveNewLocation = async () => {
    if (!customerId) {
      setLocationError('Select a customer first.')
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
        addressLine1: newLocationAddr.addressLine1.trim(),
        addressLine2: newLocationAddr.addressLine2?.trim() || null,
        city: newLocationAddr.city?.trim() || null,
        state: newLocationAddr.state?.trim() || null,
        postalCode: newLocationAddr.postalCode?.trim() || null,
        gated: locationGated,
        latitude: newLocationAddr.latitude?.trim() || null,
        longitude: newLocationAddr.longitude?.trim() || null,
      })
      if (result.error) {
        setLocationError(result.error)
        return
      }
      // Refresh locations list and select the new one
      const { locations: refreshed, primaryLocationId: refreshedPrimary } = await getCustomerLocations(customerId)
      setLocations(refreshed)
      setLocalPrimaryLocationId(refreshedPrimary)
      setLocationId(result.id)
      setLocationMode('existing')
      setNewLocationAddr({})
      setLocationEditName('')
      setLocationGated(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setLocationError(message)
    } finally {
      setSavingLocation(false)
    }
  }

  // Save edited location standalone (not via the job form submit)
  const handleSaveEditedLocation = async () => {
    if (!locationId) {
      setLocationError('No location selected.')
      return
    }
    if (!newLocationAddr.addressLine1?.trim()) {
      setLocationError('Street address is required.')
      return
    }
    setSavingLocation(true)
    setLocationError(null)
    try {
      const result = await updateServiceLocation(locationId, {
        name: locationEditName.trim() || null,
        addressLine1: newLocationAddr.addressLine1.trim(),
        addressLine2: newLocationAddr.addressLine2?.trim() || null,
        city: newLocationAddr.city?.trim() || null,
        state: newLocationAddr.state?.trim() || null,
        postalCode: newLocationAddr.postalCode?.trim() || null,
        gated: locationGated,
        latitude: newLocationAddr.latitude?.trim() || null,
        longitude: newLocationAddr.longitude?.trim() || null,
      })
      if (result.error) {
        setLocationError(result.error)
        return
      }
      // Refresh locations list and stay on the same location
      const { locations: refreshed, primaryLocationId: refreshedPrimary } = await getCustomerLocations(customerId!)
      setLocations(refreshed)
      setLocalPrimaryLocationId(refreshedPrimary)
      setLocationMode('existing')
      setLocationError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setLocationError(message)
    } finally {
      setSavingLocation(false)
    }
  }

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

  // Sync location edit form when an existing location is selected
  useEffect(() => {
    if (!locationId || locationMode === 'new' || !locations.length) return
    const loc = locations.find((l) => l.id === locationId)
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
  }, [locationId, locations, locationMode])

  // Fetch contacts and locations when customer changes
  useEffect(() => {
    if (!customerId) {
      setContacts([])
      setLocations([])
      return
    }
    let cancelled = false
    ;(async () => {
      const [{ contacts: c, primaryContactId: pcId }, { locations: l, primaryLocationId: plId }] = await Promise.all([
        getCustomerContacts(customerId),
        getCustomerLocations(customerId),
      ])
      if (!cancelled) {
        setContacts(c)
        setLocations(l)
        setPrimaryContactId(pcId)
        setLocalPrimaryLocationId(plId)
        if (autoSelectRef.current) {
          const autoContact = pcId ? c.find((x) => x.id === pcId) : c[0]
          if (autoContact) setContactId(autoContact.id)
          if (l.length > 0) setLocationId(l[0].id)
          autoSelectRef.current = false
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerId])

  const handleCustomerChange = useCallback((id: string | null) => {
    if (id) {
      autoSelectRef.current = true
      setCustomerId(id)
      setContactId(undefined)
      setLocationId(undefined)
      setCustomerMode('existing')
      setLocationMode('existing')
      setLocationEditName('')
      setLocationGated(false)
      setNewLocationAddr({})
      setContactEdit(null)
    } else {
      setCustomerId(undefined)
      setContacts([])
      setLocations([])
      setContactId(undefined)
      setLocationId(undefined)
      setLocationMode('existing')
      setLocationEditName('')
      setLocationGated(false)
      setNewLocationAddr({})
      setContactEdit(null)
    }
  }, [])

  const handleCreateNewCustomer = useCallback((name: string) => {
    setCustomerMode('new')
    setNewCustomerName(capitalizeWords(name))
    setCustomerId(undefined)
    setContactId(undefined)
    setLocationId(undefined)
    setContacts([])
    setLocations([])
    setContactMode('new')
    setInlineNewContact(emptyContact())
    setLocationMode('new')
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
    setContactId(undefined)
    setLocationId(undefined)
    setContacts([])
    setLocations([])
    setContactMode('existing')
    setInlineNewContact(emptyContact())
    setLocationMode('existing')
    setLocationEditName('')
    setLocationGated(false)
    setNewLocationAddr({})
    setSearchKey((k) => k + 1)
  }, [])

  const handleSaveNewContactDialog = async () => {
    if (!customerId) return
    if (!dialogNewContact.firstName.trim() && !dialogNewContact.lastName.trim()) {
      setNewContactDialogError('First or last name is required.')
      return
    }
    setSavingNewContactDialog(true)
    setNewContactDialogError(null)
    try {
      const result = await createContactForJob(customerId, {
        firstName: dialogNewContact.firstName.trim(),
        lastName: dialogNewContact.lastName.trim() || null,
        jobTitle: dialogNewContact.jobTitle.trim() || null,
        billingContact: dialogNewContact.billingContact,
        bookingContact: dialogNewContact.bookingContact,
        smsConsent: dialogNewContact.smsConsent,
        birthday: dialogBirthday || null,
        anniversary: dialogAnniversary || null,
        phones: dialogNewContact.phones
          .filter((p) => p.number.trim())
          .map((p) => ({ number: p.number, ext: p.ext || null, type: p.type, isPrimary: p.isPrimary })),
        emails: dialogNewContact.emails
          .filter((e) => e.address.trim())
          .map((e) => ({ address: e.address, type: e.type, isPrimary: e.isPrimary })),
      })
      if (result.error) {
        setNewContactDialogError(result.error)
        return
      }
      const { contacts: refreshed, primaryContactId: refreshedPrimary } = await getCustomerContacts(customerId)
      setContacts(refreshed)
      setPrimaryContactId(refreshedPrimary)
      setContactId(result.id)
      setNewContactDialogOpen(false)
    } catch (err) {
      setNewContactDialogError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingNewContactDialog(false)
    }
  }

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

      <form action={formAction} className="space-y-6">
        {mode === 'edit' && initial?.id && (
          <input type="hidden" name="id" value={initial.id} />
        )}
        <input type="hidden" name="customerId" value={customerId ?? ''} />
        {customerMode === 'new' && contactMode === 'new' && (
          <input type="hidden" name="contactId" value="" />
        )}
        {customerMode === 'new' && locationMode === 'new' && (
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
              <Label htmlFor="contactId">Contact</Label>
              {customerMode === 'new' ? (
                <div className="space-y-3">
                  <input type="hidden" name="newContactJson" value={JSON.stringify(inlineNewContact)} />
                  <ContactEditor
                    value={inlineNewContact}
                    onChange={setInlineNewContact}
                    idPrefix="job-inline-nc"
                  />
                </div>
              ) : !customerId ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled className="opacity-50">
                    Select Contact
                  </Button>
                  <span className="text-xs text-muted-foreground">Select a customer first</span>
                </div>
              ) : (
                <>
                  <input type="hidden" name="contactId" value={contactId ?? ''} />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setContactPickerSelected(contactId ?? '')
                        setContactPickerOpen(true)
                      }}
                    >
                      Select Contact
                    </Button>
                    {contactId && (
                      <span className="text-sm font-medium">
                        {contactEdit
                          ? contactEdit.firstName + (contactEdit.lastName ? ' ' + contactEdit.lastName : '')
                          : (() => {
                              const c = contacts.find((c) => c.id === contactId)
                              return c ? c.firstName + (c.lastName ? ' ' + c.lastName : '') : ''
                            })()}
                      </span>
                    )}
                  </div>

                  <Dialog open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Select Contact</DialogTitle>
                        <DialogDescription>Choose a contact for this job or add a new one.</DialogDescription>
                      </DialogHeader>
                      <div className="max-h-64 overflow-y-auto">
                        {contacts.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">No contacts for this customer.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="w-8 py-2" />
                                <th className="py-2 text-left font-semibold">Contact Name</th>
                                <th className="py-2 text-left font-semibold">Phone</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contacts.map((c) => {
                                const label = c.firstName + (c.lastName ? ' ' + c.lastName : '')
                                return (
                                  <tr
                                    key={c.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setContactPickerSelected(c.id)}
                                  >
                                    <td className="py-2 pr-2">
                                      <input
                                        type="radio"
                                        name="contactPickerRadio"
                                        checked={contactPickerSelected === c.id}
                                        onChange={() => setContactPickerSelected(c.id)}
                                        className="accent-primary"
                                      />
                                    </td>
                                    <td className="py-2 pr-4 font-medium text-amber-700">
                                      {label}{c.id === primaryContactId ? ' (Primary)' : ''}
                                    </td>
                                    <td className="py-2 text-muted-foreground">
                                      {c.phone ? formatPhone(c.phone) : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                      <DialogFooter className="flex-row gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setContactPickerOpen(false)
                            setDialogNewContact({ ...emptyContact(), billingContact: contacts.length === 0 })
                            setDialogBirthday('')
                            setDialogAnniversary('')
                            setNewContactDialogError(null)
                            setNewContactDialogOpen(true)
                          }}
                          className="mr-auto"
                        >
                          Add New Contact
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setContactPickerOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            if (contactPickerSelected) setContactId(contactPickerSelected)
                            setContactPickerOpen(false)
                          }}
                        >
                          Select
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Add New Contact dialog */}
                  <Dialog open={newContactDialogOpen} onOpenChange={setNewContactDialogOpen}>
                    <DialogContent className="sm:max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Add New Contact</DialogTitle>
                        <DialogDescription>Create a new contact for this customer.</DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[70vh] overflow-y-auto space-y-5 pr-2">
                        <ContactEditor
                          value={dialogNewContact}
                          onChange={setDialogNewContact}
                          idPrefix="job-dialog-nc"
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Birthday</Label>
                            <Input
                              type="date"
                              value={dialogBirthday}
                              onChange={(e) => setDialogBirthday(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Anniversary</Label>
                            <Input
                              type="date"
                              value={dialogAnniversary}
                              onChange={(e) => setDialogAnniversary(e.target.value)}
                            />
                          </div>
                        </div>

                        {newContactDialogError && (
                          <p className="text-sm text-destructive">{newContactDialogError}</p>
                        )}
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setNewContactDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleSaveNewContactDialog} disabled={savingNewContactDialog}>
                          {savingNewContactDialog ? 'Saving…' : 'Save'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Primary contact badge / toggle */}
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

                  {/* Full contact editor when an existing contact is selected */}
                  {contactEdit && contactId && (
                    <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
                      <input
                        type="hidden"
                        name="contactUpdate"
                        value={JSON.stringify(contactEdit)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">First Name</Label>
                          <Input
                            value={contactEdit.firstName}
                            onChange={(e) =>
                              updateContactField('firstName', e.target.value)
                            }
                            autoCapitalize="words"
                            placeholder="First name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Last Name</Label>
                          <Input
                            value={contactEdit.lastName}
                            onChange={(e) =>
                              updateContactField('lastName', e.target.value)
                            }
                            autoCapitalize="words"
                            placeholder="Last name"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Job Title</Label>
                        <Input
                          value={contactEdit.jobTitle}
                          onChange={(e) =>
                            updateContactField('jobTitle', e.target.value)
                          }
                          placeholder="e.g. Property Manager"
                        />
                      </div>

                      {/* Phones */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Phone Numbers
                        </div>
                        {contactEdit.phones.map((phone, pi) => (
                          <div key={pi} className="flex items-center gap-2">
                            <Phone className="size-4 text-muted-foreground" />
                            <Input
                              placeholder="555-0100"
                              value={formatPhone(phone.number)}
                              onChange={(e) =>
                                updateContactPhone(
                                  pi,
                                  'number',
                                  e.target.value.replace(/\D/g, ''),
                                )
                              }
                              className="max-w-[160px]"
                            />
                            <Input
                              placeholder="Ext"
                              value={phone.ext}
                              onChange={(e) => updateContactPhone(pi, 'ext', e.target.value.replace(/\D/g, ''))}
                              className="w-16"
                            />
                            <Select
                              value={phone.type}
                              onValueChange={(val) =>
                                updateContactPhone(pi, 'type', val ?? '')
                              }
                            >
                              <SelectTrigger className="h-9 w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cell">Cell</SelectItem>
                                <SelectItem value="home">Home</SelectItem>
                                <SelectItem value="work">Work</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id={`phone-primary-${pi}`}
                                checked={phone.isPrimary}
                                onCheckedChange={(c) =>
                                  updateContactPhone(
                                    pi,
                                    'isPrimary',
                                    c === true,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`phone-primary-${pi}`}
                                className="cursor-pointer text-xs"
                              >
                                Primary
                              </Label>
                            </div>
                            {contactEdit.phones.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive"
                                onClick={() => removeContactPhone(pi)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={addContactPhone}
                        >
                          <Plus className="mr-1 size-3" />
                          Add phone
                        </Button>
                      </div>

                      {/* Emails */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Email Addresses
                        </div>
                        {contactEdit.emails.map((email, ei) => (
                          <div key={ei} className="flex items-center gap-2">
                            <Mail className="size-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="name@company.com"
                              value={email.address}
                              onChange={(e) =>
                                updateContactEmail(
                                  ei,
                                  'address',
                                  e.target.value,
                                )
                              }
                              className="max-w-[240px]"
                            />
                            <Select
                              value={email.type}
                              onValueChange={(val) =>
                                updateContactEmail(ei, 'type', val ?? '')
                              }
                            >
                              <SelectTrigger className="h-9 w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="work">Work</SelectItem>
                                <SelectItem value="personal">Personal</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id={`email-primary-${ei}`}
                                checked={email.isPrimary}
                                onCheckedChange={(c) =>
                                  updateContactEmail(
                                    ei,
                                    'isPrimary',
                                    c === true,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`email-primary-${ei}`}
                                className="cursor-pointer text-xs"
                              >
                                Primary
                              </Label>
                            </div>
                            {contactEdit.emails.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive"
                                onClick={() => removeContactEmail(ei)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={addContactEmail}
                        >
                          <Plus className="mr-1 size-3" />
                          Add email
                        </Button>
                      </div>

                      {/* Flags */}
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="billing-contact"
                            checked={contactEdit.billingContact}
                            onCheckedChange={(c) =>
                              updateContactField(
                                'billingContact',
                                c === true,
                              )
                            }
                          />
                          <Label
                            htmlFor="billing-contact"
                            className="cursor-pointer text-sm"
                          >
                            Billing Contact
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="booking-contact"
                            checked={contactEdit.bookingContact}
                            onCheckedChange={(c) =>
                              updateContactField(
                                'bookingContact',
                                c === true,
                              )
                            }
                          />
                          <Label
                            htmlFor="booking-contact"
                            className="cursor-pointer text-sm"
                          >
                            Booking Contact
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="sms-consent"
                            checked={contactEdit.smsConsent}
                            onCheckedChange={(c) =>
                              updateContactField('smsConsent', c === true)
                            }
                          />
                          <Label
                            htmlFor="sms-consent"
                            className="cursor-pointer text-sm"
                          >
                            SMS Consent
                          </Label>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4">
              <Label htmlFor="serviceLocationId">Service Location</Label>
              {!customerId && customerMode !== 'new' ? (
                <Select name="serviceLocationId" disabled>
                  <SelectTrigger className="w-full opacity-50">
                    <SelectValue placeholder="Select a customer first…" />
                  </SelectTrigger>
                </Select>
              ) : locationMode === 'existing' && locationId ? (
                // Location chosen — show summary card only (no select so no UUID leaks into trigger)
                <>
                  <input type="hidden" name="serviceLocationId" value={locationId} />
                  {(() => {
                    const loc = locations.find((l) => l.id === locationId)
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
                                {loc.id === localPrimaryLocationId && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Primary</Badge>
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
                          {customerId && (
                            locationId === localPrimaryLocationId ? (
                              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                <Star className="size-3 fill-amber-500 text-amber-500" />
                                Primary
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await setPrimaryLocationAction(customerId, locationId)
                                  if (result.success) setLocalPrimaryLocationId(locationId)
                                }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Star className="size-3" />
                                Set as Primary
                              </button>
                            )
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
                            onClick={() => { setLocationId(undefined); setLocationError(null) }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Change location
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLocationMode('new')
                              setLocationId(undefined)
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
                    <>
                      <Select
                        name="serviceLocationId"
                        value={locationId ?? ''}
                        onValueChange={(val) => {
                          const v = val ?? ''
                          setLocationError(null)
                          if (v === '__new__') {
                            setLocationMode('new')
                            setLocationId(undefined)
                            setNewLocationAddr({})
                            setLocationEditName('')
                            setLocationGated(false)
                          } else if (v === '') {
                            setLocationId(undefined)
                          } else {
                            setLocationMode('existing')
                            setLocationId(v)
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select location…">
                            {(() => {
                              if (!locationId) return null
                              const l = locations.find((x) => x.id === locationId)
                              if (!l) return null
                              const cityStateZip = [l.city, l.state, l.postalCode].filter(Boolean).join(', ')
                              const addrFull = l.addressLine1
                                ? `${l.addressLine1}${cityStateZip ? `, ${cityStateZip}` : ''}`
                                : cityStateZip
                              const hasName = !isRedundantLocationName(l.name, l.addressLine1, l.city)
                              const display = hasName
                                ? (addrFull ? `${l.name} — ${addrFull}` : l.name)
                                : addrFull
                              return display || 'Location'
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Select location…</SelectItem>
                          {locations.map((l) => {
                            const cityStateZip = [l.city, l.state, l.postalCode].filter(Boolean).join(', ')
                            const addrFull = l.addressLine1
                              ? `${l.addressLine1}${cityStateZip ? `, ${cityStateZip}` : ''}`
                              : cityStateZip
                            const hasName = !isRedundantLocationName(l.name, l.addressLine1, l.city)
                            const label = hasName
                              ? (addrFull ? `${l.name} — ${addrFull}` : l.name)
                              : addrFull
                            const isPrimary = l.id === localPrimaryLocationId
                            const itemText = `${label || 'Location'}${isPrimary ? ' (Primary)' : ''}`
                            return (
                              <SelectItem key={l.id} value={l.id}>
                                {itemText}
                              </SelectItem>
                            )
                          })}
                          <SelectItem value="__new__">+ Create new location…</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Primary location badge / toggle */}
                      {locationId && customerId && (
                        <div className="flex items-center gap-2 pt-0.5">
                          {locationId === localPrimaryLocationId ? (
                            <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                              <Star className="size-3 fill-amber-500 text-amber-500" />
                              Primary Location
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={async () => {
                                const result = await setPrimaryLocationAction(customerId, locationId)
                                if (result.success) setLocalPrimaryLocationId(locationId)
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

                  {/* Full editable form (edit or new mode) */}
                  {(locationMode === 'edit' || locationMode === 'new') && (
                    <div key={locationFormKey} className="mt-2 space-y-3 rounded-lg border bg-muted/20 p-3">
                      <input type="hidden" name="serviceLocationId" value={locationId ?? ''} />
                      {/* Row 1: Location Name + Gated */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Location Name</Label>
                          <Input
                            name="newLocationName"
                            value={locationEditName}
                            onChange={(e) => setLocationEditName(e.target.value)}
                            placeholder="e.g. Home or Office"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 pt-5">
                          <Checkbox
                            id="newLocationGated"
                            name="newLocationGated"
                            checked={locationGated}
                            onCheckedChange={(c) => setLocationGated(c === true)}
                          />
                          <Label htmlFor="newLocationGated" className="cursor-pointer text-sm">
                            Gated Property
                          </Label>
                        </div>
                      </div>
                      {/* Row 2: Street Address + Ste/Unit/Apt */}
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Street Address</Label>
                          <AddressAutocomplete
                            name="newLocationAddress1"
                            defaultValue={newLocationAddr.addressLine1}
                            placeholder="Street Address"
                            onAddressSelect={(result) => setNewLocationAddr(result)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input
                            name="newLocationAddress2"
                            value={newLocationAddr.addressLine2 ?? ''}
                            onChange={(e) => setNewLocationAddr((a) => ({ ...a, addressLine2: e.target.value }))}
                            placeholder="Ste/Unit/Apt"
                            className="w-32"
                          />
                        </div>
                      </div>
                      {/* Row 3: City + State + ZIP */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">City</Label>
                          <Input
                            name="newLocationCity"
                            value={newLocationAddr.city ?? ''}
                            onChange={(e) => setNewLocationAddr((a) => ({ ...a, city: e.target.value }))}
                            placeholder="City"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">State</Label>
                          <Input
                            name="newLocationState"
                            value={newLocationAddr.state ?? ''}
                            onChange={(e) => setNewLocationAddr((a) => ({ ...a, state: e.target.value }))}
                            placeholder="State/Province"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Zip</Label>
                          <Input
                            name="newLocationZip"
                            value={newLocationAddr.postalCode ?? ''}
                            onChange={(e) => setNewLocationAddr((a) => ({ ...a, postalCode: e.target.value }))}
                            placeholder="Zip/Postal Code"
                          />
                        </div>
                      </div>
                      <input type="hidden" name="newLocationLat" value={newLocationAddr.latitude ?? ''} />
                      <input type="hidden" name="newLocationLng" value={newLocationAddr.longitude ?? ''} />

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {locationMode === 'edit' && locationId && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                // Reset to saved values by re-triggering the sync effect
                                setLocationFormKey((k) => k + 1)
                                setLocationMode('existing')
                                setLocationError(null)
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingLocation}
                              onClick={handleSaveEditedLocation}
                            >
                              {savingLocation ? 'Saving…' : 'Save Location'}
                            </Button>
                          </>
                        )}
                        {locationMode === 'new' && (
                          <>
                            {locations.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLocationMode('existing')
                                  setLocationId(undefined)
                                  setNewLocationAddr({})
                                  setLocationEditName('')
                                  setLocationGated(false)
                                  setLocationError(null)
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                ← Use existing location
                              </button>
                            )}
                            {customerMode !== 'new' && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={savingLocation}
                                onClick={handleSaveNewLocation}
                              >
                                {savingLocation ? 'Saving…' : 'Save Location'}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                      {locationError && (
                        <p className="text-xs text-destructive">{locationError}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Job Category</Label>
              <Select name="categoryId" value={categoryId} onValueChange={(v) => { if (v !== undefined) setCategoryId(v ?? '') }}>
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
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
              <Label>Tags</Label>
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
              <Label>Status</Label>
              {mode === 'create' ? (
                <Select name="status" defaultValue="unscheduled">
                  <SelectTrigger className="w-full">
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
              <Label>Arrival Time Window</Label>
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
                <SelectTrigger className="w-full">
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
              <Label>Assigned Techs</Label>
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
                <SelectTrigger className="w-full">
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
                    <SelectTrigger className="w-full">
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
              <Label className="shrink-0 text-sm font-medium">Apply Template</Label>
              {templates.length > 0 ? (
                <>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(val) => { setSelectedTemplateId(val ?? ''); setTemplateError(null) }}
                  >
                    <SelectTrigger className="h-9 flex-1">
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
