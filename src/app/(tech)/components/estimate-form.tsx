'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Search, X, Star, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOnline } from '@/app/(tech)/lib/use-online'
import {
  useTechCustomers,
  useTechLocations,
  useTechContacts,
  useTechReferenceData,
} from '@/app/(tech)/lib/use-tech-data'
import {
  createTechDb,
  type CachedCustomer,
  type CachedLocation,
  type CachedContact,
} from '@/app/(tech)/lib/dexie'
import {
  enqueueOutboxItem,
  flushOutbox,
  type EstimateCreatePayload,
} from '@/app/(tech)/lib/sync'
import {
  createEstimateAction,
  type CreateEstimateInput,
  type EstimateLineItemInput,
} from '@/app/(tech)/tech/estimates/actions'
import {
  createTechCustomerAction,
  createTechServiceLocationAction,
  updateTechLocationAction,
} from '@/app/(tech)/tech/customers/actions'
import { setPrimaryLocationAction } from '@/app/(app)/customers/actions'
import {
  searchPlacesAction,
  getPlaceDetailsAction,
  type PlaceSuggestion,
} from '@/lib/places-actions'
import { searchProductsAction, searchServicesAction } from '@/app/(app)/jobs/actions'
import { estimateStatusLabel } from '@/lib/estimates/status'
import { toISODate, formatPhoneInput, capitalizeWords, normalizePhone, cn } from '@/lib/utils'
import { toast } from 'sonner'

interface EstimateFormProps {
  orgId: string
  userId: string
  initialCustomers?: CachedCustomer[]
  initialLocations?: CachedLocation[]
  initialContacts?: CachedContact[]
}

type LineItemType = 'product' | 'service' | 'discount' | 'expense'

interface MobileLineItem extends EstimateLineItemInput {
  id: string
  type: LineItemType
}

type SearchResult = {
  id: string
  name: string
  unitPrice: string | null
  unitCost: string | null
  description: string | null
}

function formatMoney(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}

function moneyToCents(val: string): number {
  const n = parseFloat(val || '0')
  return isNaN(n) ? 0 : Math.round(n * 100)
}

function computeTotalCents(items: MobileLineItem[]): number {
  return items.reduce((sum, item) => {
    const qty = parseFloat(item.qty || '0') || 0
    const rate = parseFloat(item.rate || item.unitPrice || '0') || 0
    return sum + Math.round(qty * rate * 100)
  }, 0)
}

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

export function EstimateForm({
  orgId,
  userId,
  initialCustomers = [],
  initialLocations = [],
  initialContacts = [],
}: EstimateFormProps) {
  const db = useMemo(() => createTechDb(orgId), [orgId])
  const liveCustomers = useTechCustomers(orgId)
  const liveLocations = useTechLocations(orgId)
  const liveContacts = useTechContacts(orgId)
  const referenceData = useTechReferenceData(orgId)
  const online = useOnline()
  const router = useRouter()

  // Seed server-fetched initial data into Dexie so the form works offline too.
  useEffect(() => {
    if (!initialCustomers.length && !initialLocations.length && !initialContacts.length) return
    void (async () => {
      await db.open()
      if (initialCustomers.length) {
        const count = await db.customers.count()
        if (count === 0) await db.customers.bulkPut(initialCustomers)
      }
      if (initialLocations.length) {
        const count = await db.serviceLocations.count()
        if (count === 0) await db.serviceLocations.bulkPut(initialLocations)
      }
      if (initialContacts.length) {
        const count = await db.contacts.count()
        if (count === 0) await db.contacts.bulkPut(initialContacts)
      }
    })()
  }, [db, initialCustomers, initialLocations, initialContacts])

  const customersReady = liveCustomers !== undefined
  const locationsReady = liveLocations !== undefined
  const contactsReady = liveContacts !== undefined
  const referenceReady = referenceData !== undefined

  const customers = customersReady ? liveCustomers : initialCustomers
  const locations = useMemo(() => {
    const fromLive = locationsReady ? liveLocations : []
    const fromInitial = initialLocations
    const map = new Map<string, CachedLocation>()
    for (const loc of [...fromInitial, ...fromLive]) {
      map.set(loc.id, loc)
    }
    return Array.from(map.values())
  }, [locationsReady, liveLocations, initialLocations])

  const contacts = useMemo(() => {
    const fromLive = contactsReady ? liveContacts : []
    const fromInitial = initialContacts
    const map = new Map<string, CachedContact>()
    for (const c of [...fromInitial, ...fromLive]) {
      map.set(c.id, c)
    }
    return Array.from(map.values())
  }, [contactsReady, liveContacts, initialContacts])

  // ── Customer search state ──
  const [customerSearch, setCustomerSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [customerId, setCustomerId] = useState('')

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers.slice(0, 8)
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10)
  }, [customers, customerSearch])

  const selectedCustomerName = useMemo(
    () => customers.find((c) => c.id === customerId)?.name ?? '',
    [customers, customerId],
  )

  // ── Contact state ──
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactFirstName, setContactFirstName] = useState('')
  const [contactLastName, setContactLastName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMode, setContactMode] = useState<'existing' | 'new'>('existing')

  const customerContacts = useMemo(
    () => (customerId ? contacts.filter((c) => c.customerId === customerId) : []),
    [contacts, customerId],
  )

  useEffect(() => {
    if (!customerId) {
      setContactId(null)
      setContactFirstName('')
      setContactLastName('')
      setContactPhone('')
      setContactEmail('')
      setContactMode('existing')
      return
    }
    const primary = customerContacts[0]
    if (primary) {
      setContactId(primary.id)
      setContactFirstName(primary.firstName)
      setContactLastName(primary.lastName ?? '')
      setContactPhone(primary.primaryPhone ?? '')
      setContactEmail(primary.primaryEmail ?? '')
      setContactMode('existing')
    } else {
      setContactId(null)
      setContactFirstName('')
      setContactLastName('')
      setContactPhone('')
      setContactEmail('')
      setContactMode('new')
    }
  }, [customerId, customerContacts])

  // ── Location state ──
  const [serviceLocationId, setServiceLocationId] = useState('')
  const [customerLocations, setCustomerLocations] = useState<CachedLocation[]>(
    () => (customerId ? initialLocations.filter((l) => l.customerId === customerId) : []),
  )

  useEffect(() => {
    if (!customerId) {
      setCustomerLocations([])
      setServiceLocationId('')
      setPrimaryLocationId(null)
      setLocationMode('select')
      return
    }
    const matched = locations.filter((l) => l.customerId === customerId)
    setCustomerLocations(matched)
    const customer = customers.find((c) => c.id === customerId)
    const primaryId = customer?.primaryLocationId ?? matched[0]?.id ?? null
    setPrimaryLocationId(primaryId)
    if (!serviceLocationId && primaryId) {
      setServiceLocationId(primaryId)
      setLocationMode('view')
    }
  }, [customerId, locations, customers, serviceLocationId])

  // ── Reference data helpers ──
  const categories = referenceData?.jobCategories ?? []
  const referralSources = referenceData?.referralSources ?? []
  const taxItems = referenceData?.taxItems ?? []
  const tagOptions = referenceData?.tags ?? []
  const orgMembers = referenceData?.orgMembers ?? []
  const salesReps = referenceData?.salesReps ?? []
  const productCategories = referenceData?.productCategories ?? []
  const techMembers = useMemo(
    () => orgMembers.filter((m) => m.role === 'org:technician' || m.role === 'org:admin'),
    [orgMembers],
  )

  // ── Other form state ──
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [poNumber, setPoNumber] = useState('')
  const [description, setDescription] = useState('')
  const [onSiteDate, setOnSiteDate] = useState('')
  const [arrivalWindowStart, setArrivalWindowStart] = useState('')
  const [arrivalWindowEnd, setArrivalWindowEnd] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([])
  const [notesForTechs, setNotesForTechs] = useState('')
  const [status, setStatus] = useState('estimate_requested')
  const [opportunityRating, setOpportunityRating] = useState<number | null>(null)
  const [referralSourceId, setReferralSourceId] = useState<string | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [lineItems, setLineItems] = useState<MobileLineItem[]>([])
  const [saving, setSaving] = useState(false)

  // ── New customer dialog state ──
  const [newCustOpen, setNewCustOpen] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustContactFirstName, setNewCustContactFirstName] = useState('')
  const [newCustContactLastName, setNewCustContactLastName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustAddress, setNewCustAddress] = useState('')
  const [newCustCity, setNewCustCity] = useState('')
  const [newCustState, setNewCustState] = useState('')
  const [newCustZip, setNewCustZip] = useState('')
  const [creatingCust, setCreatingCust] = useState(false)

  // ── Location create/edit state ──
  // 'view' = selected-location card, 'select' = dropdown, 'new'/'edit' = inline form
  const [locationMode, setLocationMode] = useState<'view' | 'select' | 'new' | 'edit'>('select')
  const [newLocName, setNewLocName] = useState('')
  const [newLocAddress, setNewLocAddress] = useState('')
  const [newLocAddress2, setNewLocAddress2] = useState('')
  const [newLocCity, setNewLocCity] = useState('')
  const [newLocState, setNewLocState] = useState('')
  const [newLocZip, setNewLocZip] = useState('')
  const [newLocGated, setNewLocGated] = useState(false)
  const [creatingLoc, setCreatingLoc] = useState(false)
  const [primaryLocationId, setPrimaryLocationId] = useState<string | null>(null)

  // Address autocomplete refs
  const addrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [addrPredictions, setAddrPredictions] = useState<PlaceSuggestion[]>([])
  const [showAddrDropdown, setShowAddrDropdown] = useState(false)
  const locAddrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [locAddrPredictions, setLocAddrPredictions] = useState<PlaceSuggestion[]>([])
  const [showLocAddrDropdown, setShowLocAddrDropdown] = useState(false)

  function handleAddrInput(val: string) {
    setNewCustAddress(val)
    setNewCustCity('')
    setNewCustState('')
    setNewCustZip('')
    if (addrDebounceRef.current) clearTimeout(addrDebounceRef.current)
    if (val.trim().length < 3) {
      setAddrPredictions([])
      setShowAddrDropdown(false)
      return
    }
    addrDebounceRef.current = setTimeout(async () => {
      const results = await searchPlacesAction(val)
      setAddrPredictions(results)
      setShowAddrDropdown(results.length > 0)
    }, 300)
  }

  async function handleAddrSelect(suggestion: PlaceSuggestion) {
    setShowAddrDropdown(false)
    setAddrPredictions([])
    const details = await getPlaceDetailsAction(suggestion.placeId)
    if (details) {
      setNewCustAddress(details.addressLine1)
      setNewCustCity(details.city)
      setNewCustState(details.state)
      setNewCustZip(details.postalCode)
    } else {
      setNewCustAddress(suggestion.description.split(',')[0].trim())
    }
  }

  function handleLocAddrInput(val: string) {
    setNewLocAddress(val)
    setNewLocCity('')
    setNewLocState('')
    setNewLocZip('')
    if (locAddrDebounceRef.current) clearTimeout(locAddrDebounceRef.current)
    if (val.trim().length < 3) {
      setLocAddrPredictions([])
      setShowLocAddrDropdown(false)
      return
    }
    locAddrDebounceRef.current = setTimeout(async () => {
      const results = await searchPlacesAction(val)
      setLocAddrPredictions(results)
      setShowLocAddrDropdown(results.length > 0)
    }, 300)
  }

  async function handleLocAddrSelect(suggestion: PlaceSuggestion) {
    setShowLocAddrDropdown(false)
    setLocAddrPredictions([])
    const details = await getPlaceDetailsAction(suggestion.placeId)
    if (details) {
      setNewLocAddress(details.addressLine1)
      setNewLocCity(details.city)
      setNewLocState(details.state)
      setNewLocZip(details.postalCode)
    } else {
      setNewLocAddress(suggestion.description.split(',')[0].trim())
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!newCustName.trim()) {
      toast.error('Name is required')
      return
    }
    setCreatingCust(true)
    const result = await createTechCustomerAction({
      name: newCustName.trim(),
      contactFirstName: newCustContactFirstName.trim() || null,
      contactLastName: newCustContactLastName.trim() || null,
      phone: newCustPhone || null,
      email: newCustEmail || null,
      addressLine1: newCustAddress || null,
      city: newCustCity || null,
      state: newCustState || null,
      postalCode: newCustZip || null,
    })
    if (!result.success) {
      toast.error(result.error)
      setCreatingCust(false)
      return
    }
    await db.open()
    await db.customers.put({
      id: result.customerId,
      tenantId: orgId,
      name: newCustName.trim(),
      accountNo: null,
      primaryPhone: newCustPhone || null,
      primaryCity: newCustCity || null,
    })
    if (result.locationId) {
      await db.serviceLocations.put({
        id: result.locationId,
        tenantId: orgId,
        customerId: result.customerId,
        name: null,
        addressLine1: newCustAddress || null,
        addressLine2: null,
        city: newCustCity || null,
        state: newCustState || null,
        postalCode: newCustZip || null,
        country: null,
        latitude: null,
        longitude: null,
        gated: false,
      })
    }
    // Add primary contact to local cache
    await db.contacts.put({
      id: crypto.randomUUID(),
      tenantId: orgId,
      customerId: result.customerId,
      firstName: newCustContactFirstName.trim() || newCustName.trim(),
      lastName: newCustContactLastName.trim() || null,
      jobTitle: null,
      primaryPhone: normalizePhone(newCustPhone) || null,
      primaryEmail: newCustEmail.trim() || null,
    })
    setCustomerId(result.customerId)
    setServiceLocationId(result.locationId ?? '')
    setContactMode('new')
    setContactId(null)
    setContactFirstName(newCustContactFirstName.trim())
    setContactLastName(newCustContactLastName.trim())
    setContactPhone(newCustPhone)
    setContactEmail(newCustEmail)
    toast.success('Customer created')
    setNewCustOpen(false)
    setNewCustName('')
    setNewCustContactFirstName('')
    setNewCustContactLastName('')
    setNewCustPhone('')
    setNewCustEmail('')
    setNewCustAddress('')
    setNewCustCity('')
    setNewCustState('')
    setNewCustZip('')
    setCreatingCust(false)
  }


  // ── Line item helpers ──
  const [lineItemSheetOpen, setLineItemSheetOpen] = useState(false)
  const [addTab, setAddTab] = useState<'product' | 'service' | 'discount'>('product')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [addName, setAddName] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addRate, setAddRate] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [addTaxItemId, setAddTaxItemId] = useState<string | null>(null)
  const [discountDesc, setDiscountDesc] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [editingItem, setEditingItem] = useState<MobileLineItem | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editRate, setEditRate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(
    async (q: string, kind: 'product' | 'service') => {
      setSearchQuery(q)
      setSelected(null)
      if (!q.trim()) {
        setSearchResults([])
        return
      }
      if (searchTimer.current) clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(async () => {
        setSearching(true)
        try {
          const results =
            kind === 'product' ? await searchProductsAction(q) : await searchServicesAction(q)
          setSearchResults(results)
        } finally {
          setSearching(false)
        }
      }, 300)
    },
    [],
  )

  function selectCatalogItem(item: SearchResult) {
    setSelected(item)
    setAddDesc(item.description ?? '')
    setAddQty('1')
    setAddRate(item.unitPrice ?? '0')
  }

  function selectCustomItem(name: string) {
    setSelected({ id: '', name, unitPrice: null, unitCost: null, description: null })
    setAddName('')
    setAddDesc('')
    setAddQty('1')
    setAddRate('')
  }

  function resetAddSheet() {
    setSearchQuery('')
    setSearchResults([])
    setSelected(null)
    setAddName('')
    setAddQty('1')
    setAddRate('')
    setAddDesc('')
    setAddTaxItemId(null)
    setDiscountDesc('')
    setDiscountAmount('')
    setAddTab('product')
  }

  function handleAddCatalogItem() {
    if (!selected) return
    const isCustom = selected.id === ''
    const title = isCustom ? addName.trim() : selected.name
    if (!title) return
    const item: MobileLineItem = {
      id: crypto.randomUUID(),
      type: addTab,
      refId: isCustom ? null : selected.id,
      title,
      description: addDesc || title,
      qty: addQty,
      rate: addRate,
      cost: isCustom ? '0' : (selected.unitCost ?? '0'),
      taxItemId: addTaxItemId,
      groupId: null,
    }
    setLineItems((prev) => [...prev, item])
    toast.success('Item added')
    setLineItemSheetOpen(false)
    resetAddSheet()
  }

  function handleAddDiscount() {
    const amount = parseFloat(discountAmount) || 0
    if (!amount) return
    const item: MobileLineItem = {
      id: crypto.randomUUID(),
      type: 'discount',
      refId: null,
      title: discountDesc || 'Discount',
      description: discountDesc || 'Discount',
      qty: '1',
      rate: String(-Math.abs(amount)),
      cost: '0',
      taxItemId: null,
      groupId: null,
    }
    setLineItems((prev) => [...prev, item])
    toast.success('Discount added')
    setLineItemSheetOpen(false)
    resetAddSheet()
  }

  function openEdit(item: MobileLineItem) {
    setEditingItem(item)
    setEditQty(item.qty ?? '1')
    setEditRate(item.type === 'discount' ? String(Math.abs(parseFloat(item.rate || '0') || 0)) : item.rate ?? '')
    setEditDesc(item.description ?? item.title ?? '')
  }

  function handleSaveEdit() {
    if (!editingItem) return
    const rateToSave =
      editingItem.type === 'discount'
        ? String(-Math.abs(parseFloat(editRate) || 0))
        : editRate
    setLineItems((prev) =>
      prev.map((i) =>
        i.id === editingItem.id
          ? { ...i, qty: editQty, rate: rateToSave, description: editDesc }
          : i,
      ),
    )
    toast.success('Item updated')
    setEditingItem(null)
  }

  function handleDeleteLineItem(id: string) {
    setLineItems((prev) => prev.filter((i) => i.id !== id))
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const isNewCustomer = !customerId
    if (isNewCustomer && !newCustName.trim()) {
      toast.error('Select or create a customer')
      return
    }
    if (!isNewCustomer && !customerId) {
      toast.error('Select a customer')
      return
    }
    if (!description.trim()) {
      toast.error('Enter a description')
      return
    }

    setSaving(true)

    const hasNewContact = !contactId && (contactFirstName.trim() || contactLastName.trim())
    const input: CreateEstimateInput = {
      customerId: isNewCustomer ? undefined : customerId,
      newCustomerName: isNewCustomer ? newCustName.trim() : undefined,
      newContactFirstName: hasNewContact ? contactFirstName.trim() : undefined,
      newContactLastName: hasNewContact ? (contactLastName.trim() || undefined) : undefined,
      newContactPhone: hasNewContact ? (normalizePhone(contactPhone) || undefined) : undefined,
      newContactEmail: hasNewContact ? (contactEmail.trim() || undefined) : undefined,
      contactId: contactId || null,
      serviceLocationId: serviceLocationId || null,
      categoryId,
      description: description.trim(),
      poNumber: poNumber.trim() || undefined,
      opportunityRating,
      referralSourceId,
      expiryDate: expiryDate || null,
      followUpDate: followUpDate || null,
      onSiteDate: onSiteDate || null,
      arrivalWindowStart: arrivalWindowStart || null,
      arrivalWindowEnd: arrivalWindowEnd || null,
      notesForTechs: notesForTechs.trim() || undefined,
      notes: notes.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
      assignedAgentId,
      tagIds,
      assigneeUserIds,
      lineItems: lineItems.map((item) => ({
        type: item.type,
        refId: item.refId,
        title: item.title,
        description: item.description,
        qty: item.qty,
        rate: item.rate,
        cost: item.cost,
        taxItemId: item.taxItemId,
        groupId: item.groupId,
      })),
      groups: [],
    }

    if (online) {
      const result = await createEstimateAction(input)
      if (!result.success) {
        toast.error(result.error)
        setSaving(false)
        return
      }
      toast.success('Estimate created')
      router.push('/tech/estimates')
    } else {
      await enqueueOutboxItem(orgId, {
        type: 'estimate_create',
        payload: { input } satisfies EstimateCreatePayload,
      })
      await flushOutbox(orgId, userId)
      toast.info('Queued estimate — will sync when online')
      router.push('/tech/estimates')
    }

    setSaving(false)
  }

  const totalCents = computeTotalCents(lineItems)

  if (!referenceReady && !productCategories.length) {
    // Waiting for first hydrate is okay; we can still render with empty lists.
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* ── Project Specs ── */}
      <SectionTitle>Project Specs</SectionTitle>

      {/* Customer */}
      <div className="space-y-2">
        <Label htmlFor="customer-search">Customer</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="customer-search"
              data-testid="customer-search"
              type="text"
              autoComplete="off"
              placeholder="Search by name…"
              value={customerId ? selectedCustomerName : customerSearch}
              onFocus={() => {
                if (customerId) {
                  setCustomerId('')
                  setServiceLocationId('')
                  setCustomerSearch(selectedCustomerName)
                }
                setShowSuggestions(true)
              }}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setCustomerId('')
                setServiceLocationId('')
                setShowSuggestions(true)
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="text-base"
            />
            {showSuggestions && filteredCustomers.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-md max-h-56 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <li
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCustomerId(c.id)
                      setCustomerSearch('')
                      setShowSuggestions(false)
                    }}
                    className="cursor-pointer px-3 py-2.5 text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.primaryCity && (
                      <span className="ml-2 text-muted-foreground">{c.primaryCity}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
            <DialogTrigger
              render={
                <Button type="button" variant="outline" size="icon" className="shrink-0">
                  <Plus className="size-4" />
                </Button>
              }
            />
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>New Customer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCustomer} className="flex flex-col gap-3 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nc-name">Name *</Label>
                  <Input
                    id="nc-name"
                    value={newCustName}
                    onChange={(e) => setNewCustName(capitalizeWords(e.target.value))}
                    autoCapitalize="words"
                    placeholder="e.g. John Smith or Acme Corp"
                    autoFocus
                    className="text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nc-contact-first">Contact First</Label>
                    <Input
                      id="nc-contact-first"
                      value={newCustContactFirstName}
                      onChange={(e) => setNewCustContactFirstName(capitalizeWords(e.target.value))}
                      autoCapitalize="words"
                      placeholder="First"
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nc-contact-last">Last</Label>
                    <Input
                      id="nc-contact-last"
                      value={newCustContactLastName}
                      onChange={(e) => setNewCustContactLastName(capitalizeWords(e.target.value))}
                      autoCapitalize="words"
                      placeholder="Last"
                      className="text-base"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-phone">Phone</Label>
                  <Input
                    id="nc-phone"
                    type="tel"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(formatPhoneInput(e.target.value))}
                    placeholder="(555) 000-0000"
                    className="text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-email">Email</Label>
                  <Input
                    id="nc-email"
                    type="email"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-address">Address</Label>
                  <div className="relative">
                    <Input
                      id="nc-address"
                      autoComplete="off"
                      value={newCustAddress}
                      onChange={(e) => handleAddrInput(e.target.value)}
                      onBlur={() => setTimeout(() => setShowAddrDropdown(false), 150)}
                      placeholder="123 Main St"
                      className="text-base"
                    />
                    {showAddrDropdown && addrPredictions.length > 0 && (
                      <ul className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-md max-h-56 overflow-y-auto">
                        {addrPredictions.map((p) => (
                          <li
                            key={p.placeId}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { void handleAddrSelect(p) }}
                            className="cursor-pointer px-3 py-2.5 text-sm hover:bg-accent leading-snug"
                          >
                            {p.description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 space-y-1.5">
                    <Label htmlFor="nc-city">City</Label>
                    <Input
                      id="nc-city"
                      value={newCustCity}
                      onChange={(e) => setNewCustCity(e.target.value)}
                      placeholder="City"
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nc-state">State</Label>
                    <Input
                      id="nc-state"
                      value={newCustState}
                      onChange={(e) => setNewCustState(e.target.value)}
                      placeholder="IL"
                      maxLength={2}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nc-zip">Zip</Label>
                    <Input
                      id="nc-zip"
                      value={newCustZip}
                      onChange={(e) => setNewCustZip(e.target.value)}
                      placeholder="60601"
                      className="text-base"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={creatingCust} className="w-full mt-1">
                  {creatingCust ? 'Creating…' : 'Create Customer'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contact */}
      {customerId && (
        <div className="space-y-2">
          <Label>Contact</Label>
          {customerContacts.length > 0 && (
            <Select
              value={contactMode === 'existing' ? contactId ?? '' : '__new__'}
              onValueChange={(val) => {
                if (val === '__new__') {
                  setContactMode('new')
                  setContactId(null)
                  setContactFirstName('')
                  setContactLastName('')
                  setContactPhone('')
                  setContactEmail('')
                } else {
                  const c = customerContacts.find((x) => x.id === val)
                  if (c) {
                    setContactMode('existing')
                    setContactId(c.id)
                    setContactFirstName(c.firstName)
                    setContactLastName(c.lastName ?? '')
                    setContactPhone(c.primaryPhone ?? '')
                    setContactEmail(c.primaryEmail ?? '')
                  }
                }
              }}
            >
              <SelectTrigger className="w-full text-base">
                <SelectValue placeholder="Select contact…">
                  {contactMode === 'new'
                    ? '+ New contact…'
                    : (() => {
                        const c = customerContacts.find((x) => x.id === contactId)
                        return c ? `${c.firstName} ${c.lastName ?? ''}`.trim() : contactId ?? 'Select contact…'
                      })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customerContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ New contact…</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="First name"
              value={contactFirstName}
              onChange={(e) => {
                setContactFirstName(capitalizeWords(e.target.value))
                setContactId(null)
                setContactMode('new')
              }}
              autoCapitalize="words"
              className="text-base"
            />
            <Input
              placeholder="Last name"
              value={contactLastName}
              onChange={(e) => {
                setContactLastName(capitalizeWords(e.target.value))
                setContactId(null)
                setContactMode('new')
              }}
              autoCapitalize="words"
              className="text-base"
            />
          </div>
          <Input
            type="tel"
            placeholder="Phone (optional)"
            value={contactPhone}
            onChange={(e) => {
              setContactPhone(formatPhoneInput(e.target.value))
              setContactId(null)
              setContactMode('new')
            }}
            className="text-base"
          />
          <Input
            type="email"
            placeholder="Email (optional)"
            value={contactEmail}
            onChange={(e) => {
              setContactEmail(e.target.value)
              setContactId(null)
              setContactMode('new')
            }}
            className="text-base"
          />
        </div>
      )}

      {/* Service location */}
      <div className="space-y-2">
        <Label>Service location</Label>
        {serviceLocationId && locationMode === 'view' ? (
          <div className="rounded-lg border p-3 space-y-2">
            {(() => {
              const loc = customerLocations.find((x) => x.id === serviceLocationId)
              if (!loc) return null
              return (
                <>
                  <div className="flex items-start gap-2">
                    <MapPin className="size-4 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">
                        {loc.name && !isRedundantLocationName(loc.name, loc.addressLine1, loc.city)
                          ? loc.name
                          : loc.addressLine1}
                      </p>
                      {loc.name && !isRedundantLocationName(loc.name, loc.addressLine1, loc.city) && (
                        <p className="text-sm text-muted-foreground">{loc.addressLine1}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {[loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {serviceLocationId === primaryLocationId && (
                      <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Star className="mr-1 size-3" />
                        Primary
                      </span>
                    )}
                    {loc.gated && (
                      <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Gated Property
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {serviceLocationId !== primaryLocationId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!customerId || !serviceLocationId) return
                          setCreatingLoc(true)
                          try {
                            const res = await setPrimaryLocationAction(customerId, serviceLocationId)
                            if (res?.error) throw new Error(res.error)
                            setPrimaryLocationId(serviceLocationId)
                            await db.customers.update(customerId, { primaryLocationId: serviceLocationId })
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Failed to set primary location')
                          } finally {
                            setCreatingLoc(false)
                          }
                        }}
                        disabled={creatingLoc}
                      >
                        Set as Primary
                      </Button>
                    )}
                    {serviceLocationId === primaryLocationId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                        className="opacity-60"
                      >
                        Primary
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const loc = customerLocations.find((x) => x.id === serviceLocationId)
                        if (!loc) return
                        setNewLocName(loc.name || '')
                        setNewLocAddress(loc.addressLine1 || '')
                        setNewLocAddress2(loc.addressLine2 || '')
                        setNewLocCity(loc.city || '')
                        setNewLocState(loc.state || '')
                        setNewLocZip(loc.postalCode || '')
                        setNewLocGated(!!loc.gated)
                        setLocationMode('edit')
                      }}
                    >
                      Edit address
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLocationMode('select')}
                    >
                      Change location
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewLocName('')
                        setNewLocAddress('')
                        setNewLocAddress2('')
                        setNewLocCity('')
                        setNewLocState('')
                        setNewLocZip('')
                        setNewLocGated(false)
                        setLocationMode('new')
                      }}
                    >
                      + New address
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
        ) : locationMode === 'new' || locationMode === 'edit' ? (
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-sm font-medium">
              {locationMode === 'new' ? 'New address' : 'Edit address'}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="loc-name">Location name (optional)</Label>
              <Input
                id="loc-name"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                placeholder="e.g. Main Office"
                className="text-base"
                autoCapitalize="words"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-address">Address</Label>
              <div className="relative">
                <Input
                  id="loc-address"
                  autoComplete="off"
                  value={newLocAddress}
                  onChange={(e) => handleLocAddrInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowLocAddrDropdown(false), 150)}
                  placeholder="123 Main St"
                  className="text-base"
                  autoFocus={locationMode === 'new'}
                />
                {showLocAddrDropdown && locAddrPredictions.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-md max-h-56 overflow-y-auto">
                    {locAddrPredictions.map((p) => (
                      <li
                        key={p.placeId}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { void handleLocAddrSelect(p) }}
                        className="cursor-pointer px-3 py-2.5 text-sm hover:bg-accent leading-snug"
                      >
                        {p.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <Input
              value={newLocAddress2}
              onChange={(e) => setNewLocAddress2(e.target.value)}
              placeholder="Apt, suite, unit (optional)"
              className="text-base"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="loc-city">City</Label>
                <Input
                  id="loc-city"
                  value={newLocCity}
                  onChange={(e) => setNewLocCity(e.target.value)}
                  placeholder="City"
                  className="text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-state">State</Label>
                <Input
                  id="loc-state"
                  value={newLocState}
                  onChange={(e) => setNewLocState(e.target.value)}
                  placeholder="IL"
                  maxLength={2}
                  className="text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-zip">Zip</Label>
                <Input
                  id="loc-zip"
                  value={newLocZip}
                  onChange={(e) => setNewLocZip(e.target.value)}
                  placeholder="60601"
                  className="text-base"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="loc-gated"
                checked={newLocGated}
                onCheckedChange={(v) => setNewLocGated(!!v)}
              />
              <Label htmlFor="loc-gated" className="text-sm font-normal">
                Gated property
              </Label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  if (!customerId || !newLocAddress.trim() || !newLocCity.trim() || !newLocState.trim()) {
                    toast.error('Address, city and state are required')
                    return
                  }
                  setCreatingLoc(true)
                  try {
                    if (locationMode === 'edit' && serviceLocationId) {
                      const res = await updateTechLocationAction({
                        locationId: serviceLocationId,
                        jobId: '',
                        addressLine1: newLocAddress.trim(),
                        city: newLocCity.trim(),
                        state: newLocState.trim().toUpperCase(),
                        postalCode: newLocZip.trim() || null,
                      })
                      if (!res.success) throw new Error(res.error)
                      const updatedFields = {
                        name: newLocName.trim() || null,
                        addressLine1: newLocAddress.trim(),
                        addressLine2: newLocAddress2.trim() || null,
                        city: newLocCity.trim(),
                        state: newLocState.trim().toUpperCase(),
                        postalCode: newLocZip.trim() || null,
                        gated: newLocGated,
                      }
                      await db.serviceLocations.update(serviceLocationId, updatedFields)
                      setCustomerLocations((prev) =>
                        prev.map((loc) =>
                          loc.id === serviceLocationId ? { ...loc, ...updatedFields } : loc
                        )
                      )
                      toast.success('Address updated')
                    } else {
                      const res = await createTechServiceLocationAction({
                        customerId,
                        addressLine1: newLocAddress.trim(),
                        city: newLocCity.trim(),
                        state: newLocState.trim().toUpperCase(),
                        postalCode: newLocZip.trim() || null,
                      })
                      if (!res.success) throw new Error(res.error)
                      const id = res.locationId
                      const newLoc: CachedLocation = {
                        id,
                        tenantId: orgId,
                        customerId,
                        name: newLocName.trim() || null,
                        addressLine1: newLocAddress.trim(),
                        addressLine2: newLocAddress2.trim() || null,
                        city: newLocCity.trim(),
                        state: newLocState.trim().toUpperCase(),
                        postalCode: newLocZip.trim() || null,
                        country: null,
                        latitude: null,
                        longitude: null,
                        gated: newLocGated,
                      }
                      await db.serviceLocations.put(newLoc)
                      setServiceLocationId(id)
                      setCustomerLocations((prev) => [...prev, newLoc])
                      if (!primaryLocationId) {
                        setPrimaryLocationId(id)
                        await db.customers.update(customerId, { primaryLocationId: id })
                      }
                      toast.success('Address added')
                    }
                    setLocationMode('view')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed to save address')
                  } finally {
                    setCreatingLoc(false)
                  }
                }}
                disabled={creatingLoc}
              >
                {creatingLoc
                  ? locationMode === 'edit'
                    ? 'Updating…'
                    : 'Saving…'
                  : locationMode === 'edit'
                    ? 'Update address'
                    : 'Save address'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (locationMode === 'edit' && !serviceLocationId) {
                    setLocationMode('new')
                  } else if (!serviceLocationId) {
                    setLocationMode('select')
                  } else {
                    setLocationMode('view')
                  }
                }}
                disabled={creatingLoc}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Select
              value={serviceLocationId}
              onValueChange={(val) => {
                if (val === '__new__') {
                  setNewLocName('')
                  setNewLocAddress('')
                  setNewLocAddress2('')
                  setNewLocCity('')
                  setNewLocState('')
                  setNewLocZip('')
                  setNewLocGated(false)
                  setLocationMode('new')
                } else {
                  setServiceLocationId(val ?? '')
                  setLocationMode(val ? 'view' : 'select')
                }
              }}
              disabled={!customerId}
            >
              <SelectTrigger className="w-full text-base" id="location" data-testid="location-select-trigger">
                <SelectValue placeholder={customerId ? 'Select location (optional)' : 'Select a customer first'}>
                  {(() => {
                    if (!serviceLocationId) return null
                    const loc = customerLocations.find((x) => x.id === serviceLocationId)
                    if (!loc) return serviceLocationId
                    return [loc.name, loc.addressLine1, loc.city].filter(Boolean).join(' — ') || serviceLocationId
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No location</SelectItem>
                {customerLocations.map((loc) => {
                  const label = [loc.name, loc.addressLine1, loc.city].filter(Boolean).join(' — ')
                  return (
                    <SelectItem key={loc.id} value={loc.id}>
                      {label || loc.id}
                    </SelectItem>
                  )
                })}
                {customerId && (
                  <SelectItem value="__new__">+ New address…</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Category + PO */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={categoryId ?? ''} onValueChange={(v) => setCategoryId(v || null)}>
            <SelectTrigger className="text-base" id="category">
              <SelectValue placeholder="No category">
                {categoryId ? categories.find((c) => c.id === categoryId)?.name ?? categoryId : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="po">PO Number</Label>
          <Input
            id="po"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="PO #"
            className="text-base"
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the work or scope"
          className="text-base"
          required
        />
      </div>

      {/* On-site + arrival window */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="onSite">On-site date</Label>
          <Input
            id="onSite"
            type="date"
            value={onSiteDate}
            onChange={(e) => setOnSiteDate(e.target.value)}
            className="text-base"
          />
        </div>
        <div className="space-y-2">
          <Label>Arrival window</Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={arrivalWindowStart}
              onChange={(e) => setArrivalWindowStart(e.target.value)}
              className="text-base"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              type="time"
              value={arrivalWindowEnd}
              onChange={(e) => setArrivalWindowEnd(e.target.value)}
              className="text-base"
            />
          </div>
        </div>
      </div>

      {/* Assigned techs */}
      <div className="space-y-2">
        <Label>Assigned techs</Label>
        <div className="flex flex-wrap gap-2">
          {techMembers.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={assigneeUserIds.includes(m.id)}
                onCheckedChange={(checked) => {
                  setAssigneeUserIds((prev) =>
                    checked
                      ? [...prev, m.id]
                      : prev.filter((id) => id !== m.id),
                  )
                }}
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={tagIds.includes(t.id)}
                onCheckedChange={(checked) => {
                  setTagIds((prev) =>
                    checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                  )
                }}
              />
              {t.name}
            </label>
          ))}
        </div>
      </div>

      {/* Notes for techs */}
      <div className="space-y-2">
        <Label htmlFor="notesForTechs">Notes for techs</Label>
        <Textarea
          id="notesForTechs"
          value={notesForTechs}
          onChange={(e) => setNotesForTechs(e.target.value)}
          placeholder="Visible to technicians in the field"
          className="text-base"
        />
      </div>

      {/* ── Sales Data ── */}
      <SectionTitle>Sales Data</SectionTitle>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(v) => v && setStatus(v)}>
          <SelectTrigger className="text-base" id="status">
            <SelectValue>{estimateStatusLabel(status)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="estimate_requested">Requested</SelectItem>
            <SelectItem value="estimate_provided">Provided</SelectItem>
            <SelectItem value="estimate_accepted">Accepted</SelectItem>
            <SelectItem value="estimate_won">Won</SelectItem>
            <SelectItem value="estimate_lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Opportunity rating */}
      <div className="space-y-2">
        <Label>Opportunity rating</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setOpportunityRating(opportunityRating === star ? null : star)}
              className="p-1"
            >
              <Star
                className={cn(
                  'size-6',
                  opportunityRating && star <= opportunityRating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground',
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Referral source */}
      <div className="space-y-2">
        <Label htmlFor="referralSource">Referral source</Label>
        <Select value={referralSourceId ?? ''} onValueChange={(v) => setReferralSourceId(v || null)}>
          <SelectTrigger className="text-base" id="referralSource">
            <SelectValue placeholder="No source">
              {referralSourceId ? referralSources.find((s) => s.id === referralSourceId)?.name ?? referralSourceId : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No source</SelectItem>
            {referralSources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="expiry">Expiry date</Label>
          <Input
            id="expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="followUp">Follow-up date</Label>
          <Input
            id="followUp"
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="text-base"
          />
        </div>
      </div>

      {/* Sales rep */}
      <div className="space-y-2">
        <Label htmlFor="salesRep">Sales rep</Label>
        <Select value={assignedAgentId ?? ''} onValueChange={(v) => setAssignedAgentId(v || null)}>
          <SelectTrigger className="text-base" id="salesRep">
            <SelectValue placeholder="Unassigned">
              {assignedAgentId ? salesReps.find((r) => r.id === assignedAgentId)?.name ?? assignedAgentId : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Unassigned</SelectItem>
            {salesReps.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes + internal */}
      <div className="space-y-2">
        <Label htmlFor="notes">Customer-facing notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Shown on the estimate"
          className="text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internalNotes">Internal notes</Label>
        <Textarea
          id="internalNotes"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Not shown to the customer"
          className="text-base"
        />
      </div>

      {/* ── Line Items ── */}
      <SectionTitle>Line Items</SectionTitle>

      <Card>
        <CardContent className="p-4 space-y-3">
          {lineItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          )}
          {lineItems.map((item) => {
            const qty = parseFloat(item.qty || '0') || 0
            const rate = parseFloat(item.rate || '0') || 0
            const lineTotal = qty * rate
            const isDiscount = item.type === 'discount'
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium truncate',
                      isDiscount && 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {item.title || item.description || 'Unnamed item'}
                  </p>
                  {item.description && item.description !== (item.title || '') && (
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {qty} × ${rate.toFixed(2)} = {' '}
                    <span className={cn(isDiscount && 'text-red-600 dark:text-red-400')}>
                      {isDiscount ? '-' : ''}${Math.abs(lineTotal).toFixed(2)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLineItem(item.id)}
                  className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )
          })}
          {lineItems.length > 0 && (
            <p className="text-sm font-medium text-right">
              Total: {formatMoney(totalCents)}
            </p>
          )}

          <Sheet
            open={lineItemSheetOpen}
            onOpenChange={(o) => {
              setLineItemSheetOpen(o)
              if (!o) resetAddSheet()
            }}
          >
            <SheetTrigger
              render={
                <Button variant="outline" className="w-full gap-2" type="button">
                  <Plus className="size-4" />
                  Add Item
                </Button>
              }
            />
            <SheetContent side="bottom" className="h-[82vh] flex flex-col gap-0 pb-safe">
              <SheetHeader className="shrink-0 pb-4">
                <SheetTitle>Add Line Item</SheetTitle>
              </SheetHeader>

              <Tabs
                value={addTab}
                onValueChange={(v) => {
                  setAddTab(v as typeof addTab)
                  setSearchQuery('')
                  setSearchResults([])
                  setSelected(null)
                }}
                className="flex flex-col flex-1 min-h-0"
              >
                <TabsList className="grid grid-cols-3 shrink-0">
                  <TabsTrigger value="product">Product</TabsTrigger>
                  <TabsTrigger value="service">Service</TabsTrigger>
                  <TabsTrigger value="discount">Discount</TabsTrigger>
                </TabsList>

                {(['product', 'service'] as const).map((kind) => (
                  <TabsContent
                    key={kind}
                    value={kind}
                    className="flex flex-col flex-1 min-h-0 mt-4 gap-4"
                  >
                    {!selected ? (
                      <>
                        <div className="relative shrink-0">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                          <Input
                            className="pl-9 text-base"
                            placeholder={`Search ${kind}s…`}
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value, kind)}
                            autoComplete="off"
                          />
                        </div>
                        <div className="flex-1 overflow-y-auto -mx-2 px-2">
                          {searching && (
                            <p className="text-sm text-muted-foreground py-2">Searching…</p>
                          )}
                          {!searching && searchQuery && searchResults.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2">
                              No {kind}s found for &ldquo;{searchQuery}&rdquo;
                            </p>
                          )}
                          {!searching && !searchQuery && (
                            <p className="text-sm text-muted-foreground py-2">
                              Type to search the catalog.
                            </p>
                          )}
                          <ul className="flex flex-col divide-y">
                            {searchResults.map((r) => (
                              <li key={r.id}>
                                <button
                                  type="button"
                                  onClick={() => selectCatalogItem(r)}
                                  className="flex flex-col w-full text-left px-1 py-3 hover:bg-muted active:bg-muted rounded-md transition-colors"
                                >
                                  <span className="text-sm font-medium">{r.name}</span>
                                  {r.description && (
                                    <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                      {r.description}
                                    </span>
                                  )}
                                  {r.unitPrice != null && (
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                      ${parseFloat(r.unitPrice).toFixed(2)}
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                          {!searching && searchQuery && (
                            <div className={cn('pt-2', searchResults.length > 0 && 'border-t mt-1')}>
                              <button
                                type="button"
                                data-testid="add-custom-item"
                                onClick={() => selectCustomItem(searchQuery)}
                                className="flex flex-col w-full text-left px-1 py-3 hover:bg-muted active:bg-muted rounded-md transition-colors"
                              >
                                <span className="text-sm font-medium">
                                  Add &ldquo;{searchQuery}&rdquo; as custom item
                                </span>
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  Not in catalog — enter name and price manually
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col flex-1 gap-4">
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit"
                        >
                          <X className="size-4" />
                          Back to search
                        </button>
                        {selected.id === '' ? (
                          <div>
                            <Label htmlFor={`${kind}-name`}>Name</Label>
                            <Input
                              id={`${kind}-name`}
                              aria-label={`${kind} name`}
                              value={addName}
                              onChange={(e) => setAddName(e.target.value)}
                              className="mt-1 text-base"
                              placeholder="Item or service name"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <p className="font-medium">{selected.name}</p>
                        )}
                        <div className="flex flex-col gap-3">
                          <div>
                            <Label htmlFor={`${kind}-desc`}>Description</Label>
                            <Input
                              id={`${kind}-desc`}
                              value={addDesc}
                              onChange={(e) => setAddDesc(e.target.value)}
                              className="mt-1 text-base"
                              placeholder="Description for this estimate"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor={`${kind}-qty`}>Qty</Label>
                              <Input
                                id={`${kind}-qty`}
                                aria-label={`${kind} quantity`}
                                type="number"
                                inputMode="decimal"
                                value={addQty}
                                onChange={(e) => setAddQty(e.target.value)}
                                className="mt-1 text-base"
                                min="0"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`${kind}-rate`}>Rate ($)</Label>
                              <Input
                                id={`${kind}-rate`}
                                aria-label={`${kind} rate`}
                                type="text"
                                inputMode="decimal"
                                value={addRate}
                                onChange={(e) => setAddRate(e.target.value)}
                                className="mt-1 text-base"
                              />
                            </div>
                          </div>
                          {taxItems.length > 0 && (
                            <div>
                              <Label htmlFor={`${kind}-tax`}>Tax item</Label>
                              <Select
                                value={addTaxItemId ?? ''}
                                onValueChange={(v) => setAddTaxItemId(v || null)}
                              >
                                <SelectTrigger className="mt-1 text-base" id={`${kind}-tax`}>
                                  <SelectValue placeholder="No tax">
                                    {addTaxItemId ? taxItems.find((t) => t.id === addTaxItemId)?.name ?? addTaxItemId : null}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">No tax</SelectItem>
                                  {taxItems.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 mt-auto">
                          <Button
                            onClick={handleAddCatalogItem}
                            disabled={!addRate || (selected.id === '' && !addName.trim())}
                            className="w-full"
                            type="button"
                          >
                            Add {kind === 'product' ? 'Product' : 'Service'}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setSelected(null)}
                            className="w-full"
                            type="button"
                          >
                            Back to Search
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                ))}

                <TabsContent value="discount" className="flex flex-col flex-1 mt-4 gap-4">
                  <div className="flex flex-col gap-3">
                    <div>
                      <Label htmlFor="disc-desc">Description</Label>
                      <Input
                        id="disc-desc"
                        placeholder="e.g. Military discount"
                        value={discountDesc}
                        onChange={(e) => setDiscountDesc(e.target.value)}
                        className="mt-1 text-base"
                      />
                    </div>
                    <div>
                      <Label htmlFor="disc-amount">Amount ($)</Label>
                      <Input
                        id="disc-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        className="mt-1 text-base"
                        min="0"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddDiscount}
                    disabled={!discountAmount}
                    className="mt-auto"
                    type="button"
                  >
                    Add Discount
                  </Button>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>

          {/* Edit sheet */}
          <Sheet
            open={!!editingItem}
            onOpenChange={(o) => {
              if (!o) setEditingItem(null)
            }}
          >
            <SheetContent side="bottom" className="h-auto pb-safe">
              <SheetHeader className="pb-4">
                <SheetTitle>Edit Item</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="edit-desc">Description</Label>
                  <Input
                    id="edit-desc"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="mt-1 text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-qty">Qty</Label>
                    <Input
                      id="edit-qty"
                      type="number"
                      inputMode="decimal"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      className="mt-1 text-base"
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-rate">
                      {editingItem?.type === 'discount' ? 'Amount ($)' : 'Rate ($)'}
                    </Label>
                    <Input
                      id="edit-rate"
                      type="text"
                      inputMode="decimal"
                      value={editRate}
                      onChange={(e) => setEditRate(e.target.value)}
                      className="mt-1 text-base"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleSaveEdit} className="w-full" type="button">
                    Save Changes
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setEditingItem(null)}
                    className="w-full"
                    type="button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-full mt-2">
        {saving ? 'Saving…' : 'Create Estimate'}
      </Button>
    </form>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold tracking-tight border-b pb-2 mt-2 first:mt-0">
      {children}
    </h2>
  )
}
