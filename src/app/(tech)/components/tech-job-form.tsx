'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { useTechCustomers, useTechLocations } from '@/app/(tech)/lib/use-tech-data'
import { createTechDb, type CachedCustomer, type CachedLocation } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type JobCreatePayload } from '@/app/(tech)/lib/sync'
import { createTechJobAction } from '@/app/(tech)/tech/jobs/actions'
import { createTechCustomerAction, createTechServiceLocationAction } from '@/app/(tech)/tech/customers/actions'
import { searchPlacesAction, getPlaceDetailsAction, type PlaceSuggestion } from '@/lib/places-actions'
import { getTechCustomerPrimaryContactAction } from '@/app/(tech)/tech/customers/actions'
import { toISODate, formatPhoneInput, capitalizeWords } from '@/lib/utils'
import { toast } from 'sonner'
import { TECH_DATA_UPDATED } from '@/app/(tech)/lib/sync'

interface TechJobFormProps {
  orgId: string
  userId: string
  initialCustomers?: CachedCustomer[]
  initialLocations?: CachedLocation[]
}

export function TechJobForm({
  orgId,
  userId,
  initialCustomers = [],
  initialLocations = [],
}: TechJobFormProps) {
  const db = useMemo(() => createTechDb(orgId), [orgId])
  const liveCustomers = useTechCustomers(orgId)
  const [customerId, setCustomerId] = useState('')
  const liveLocations = useTechLocations(orgId, customerId || null)
  const online = useOnline()
  const router = useRouter()

  useEffect(() => {
    if (!initialCustomers.length && !initialLocations.length) return
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
    })()
  }, [db, initialCustomers, initialLocations])

  // Pre-populate contact from customer's primary contact when online
  useEffect(() => {
    if (!customerId) {
      setContactId(null)
      setContactFirstName('')
      setContactLastName('')
      setContactPhone('')
      return
    }
    if (!online) return
    void getTechCustomerPrimaryContactAction(customerId).then((contact) => {
      if (contact) {
        setContactId(contact.id)
        setContactFirstName(contact.firstName)
        setContactLastName(contact.lastName ?? '')
        setContactPhone(contact.phone ?? '')
      } else {
        setContactId(null)
        setContactFirstName('')
        setContactLastName('')
        setContactPhone('')
      }
    })
  }, [customerId, online])

  const allCustomers = liveCustomers !== undefined ? liveCustomers : initialCustomers

  // Type-ahead search state
  const [customerSearch, setCustomerSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return allCustomers.slice(0, 8)
    return allCustomers
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 10)
  }, [allCustomers, customerSearch])

  const selectedCustomerName = useMemo(
    () => allCustomers.find((c) => c.id === customerId)?.name ?? '',
    [allCustomers, customerId],
  )

  const locations = useMemo(() => {
    const fromLive = liveLocations !== undefined ? liveLocations : []
    const fromInitial = initialLocations.filter((loc) => loc.customerId === customerId)
    const map = new Map<string, CachedLocation>()
    for (const loc of [...fromInitial, ...fromLive]) map.set(loc.id, loc)
    return Array.from(map.values())
  }, [liveLocations, initialLocations, customerId])

  const [serviceLocationId, setServiceLocationId] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(toISODate(new Date()))
  const [saving, setSaving] = useState(false)

  // Contact section
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactFirstName, setContactFirstName] = useState('')
  const [contactLastName, setContactLastName] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  // New customer dialog state
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

  // New location dialog state
  const [newLocOpen, setNewLocOpen] = useState(false)
  const [newLocAddress, setNewLocAddress] = useState('')
  const [newLocCity, setNewLocCity] = useState('')
  const [newLocState, setNewLocState] = useState('')
  const [newLocZip, setNewLocZip] = useState('')
  const [creatingLoc, setCreatingLoc] = useState(false)
  const locAddrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [locAddrPredictions, setLocAddrPredictions] = useState<PlaceSuggestion[]>([])
  const [showLocAddrDropdown, setShowLocAddrDropdown] = useState(false)

  // Address autocomplete — reuses the same Google Places server actions as the desktop app
  const addrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [addrPredictions, setAddrPredictions] = useState<PlaceSuggestion[]>([])
  const [showAddrDropdown, setShowAddrDropdown] = useState(false)

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

  async function handleCreateLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) return
    setCreatingLoc(true)
    const result = await createTechServiceLocationAction({
      customerId,
      addressLine1: newLocAddress || null,
      city: newLocCity || null,
      state: newLocState || null,
      postalCode: newLocZip || null,
    })
    if (!result.success) {
      toast.error(result.error)
      setCreatingLoc(false)
      return
    }
    await db.open()
    await db.serviceLocations.put({
      id: result.locationId,
      tenantId: orgId,
      customerId,
      name: null,
      addressLine1: newLocAddress || null,
      addressLine2: null,
      city: newLocCity || null,
      state: newLocState || null,
      postalCode: newLocZip || null,
      country: null,
      latitude: null,
      longitude: null,
      gated: false,
    })
    setServiceLocationId(result.locationId)
    toast.success('Location added')
    setNewLocOpen(false)
    setNewLocAddress('')
    setNewLocCity('')
    setNewLocState('')
    setNewLocZip('')
    setCreatingLoc(false)
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
    // Write the new customer to Dexie so it appears in the dropdown immediately
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
    setCustomerId(result.customerId)
    setServiceLocationId(result.locationId ?? '')
    // Pre-populate contact from what was just entered
    setContactId(null)
    setContactFirstName(newCustContactFirstName.trim() || newCustName.trim())
    setContactLastName(newCustContactLastName.trim())
    setContactPhone(newCustPhone)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!customerId) {
      toast.error('Select a customer')
      return
    }
    if (!description.trim()) {
      toast.error('Enter a description')
      return
    }

    setSaving(true)
    // Resolve contact: prefer existing contactId, else pass new contact fields if provided
    const hasNewContact = !contactId && contactFirstName.trim().length > 0
    const input = {
      customerId,
      serviceLocationId: serviceLocationId || null,
      description: description.trim(),
      startDate: startDate || null,
      contactId: contactId || null,
      newContactFirstName: hasNewContact ? contactFirstName.trim() : null,
      newContactLastName: hasNewContact ? (contactLastName.trim() || null) : null,
      newContactPhone: hasNewContact ? (contactPhone || null) : null,
    }

    if (online) {
      const result = await createTechJobAction(input)
      if (!result.success) {
        toast.error(result.error)
        setSaving(false)
        return
      }

      // Optimistically cache the new job in Dexie so the detail page renders
      // instantly instead of flashing "Job not found" while we wait for Realtime
      // to trigger a full hydration round-trip.
      const selectedCustomer = allCustomers.find((c) => c.id === customerId)
      const selectedLocation = locations.find((l) => l.id === serviceLocationId)
      await db.open()
      await db.jobs.put({
        id: result.id,
        tenantId: orgId,
        jobNo: result.jobNo,
        customerId,
        contactId: result.contactId,
        serviceLocationId: result.serviceLocationId,
        status: 'unscheduled',
        description: description.trim(),
        startDate: startDate || null,
        arrivalWindowStart: null,
        arrivalWindowEnd: null,
        notesForTechs: null,
        completionNotes: null,
        assigneeUserIds: [userId],
        customerName: selectedCustomer?.name ?? null,
        addressLine1: selectedLocation?.addressLine1 ?? null,
        city: selectedLocation?.city ?? null,
        state: selectedLocation?.state ?? null,
        postalCode: selectedLocation?.postalCode ?? null,
        contactPhone: contactPhone || null,
        contactEmail: null,
        contactFirstName: contactFirstName.trim() || null,
        contactLastName: contactLastName.trim() || null,
        lineItems: [],
      })
      window.dispatchEvent(new CustomEvent(TECH_DATA_UPDATED))

      toast.success('Job created')
      router.push(`/tech/jobs/${result.id}`)
    } else {
      await enqueueOutboxItem(orgId, {
        type: 'job_create',
        payload: { input } satisfies JobCreatePayload,
      })
      await flushOutbox(orgId, userId)
      toast.info('Job queued — will sync when online')
      router.push('/tech/jobs')
    }

    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="customer-search">Customer</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="customer-search"
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
            <DialogTrigger render={
              <Button type="button" variant="outline" size="icon" className="shrink-0">
                <Plus className="size-4" />
              </Button>
            } />
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
                    onChange={(e) => setNewCustName(e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()))}
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

      {customerId && (
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">Contact <span className="text-muted-foreground font-normal">(optional)</span></p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="First name"
              value={contactFirstName}
              onChange={(e) => { setContactFirstName(capitalizeWords(e.target.value)); setContactId(null) }}
              autoCapitalize="words"
              className="text-base"
            />
            <Input
              placeholder="Last name"
              value={contactLastName}
              onChange={(e) => { setContactLastName(capitalizeWords(e.target.value)); setContactId(null) }}
              autoCapitalize="words"
              className="text-base"
            />
          </div>
          <Input
            type="tel"
            placeholder="Phone (optional)"
            value={contactPhone}
            onChange={(e) => { setContactPhone(formatPhoneInput(e.target.value)); setContactId(null) }}
            className="text-base"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="location">Service location</Label>
        <div className="flex gap-2">
          <select
            id="location"
            value={serviceLocationId}
            onChange={(e) => setServiceLocationId(e.target.value)}
            disabled={!customerId}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-base disabled:opacity-50"
          >
            <option value="">
              {customerId ? 'Select location (optional)' : 'Select a customer first'}
            </option>
            {locations.map((loc) => {
              // Skip name if it looks like a street address (starts with a digit) — it duplicates addressLine1
              const isAddressLikeName = loc.name ? /^\d/.test(loc.name.trim()) : true
              const label = [
                !isAddressLikeName ? loc.name : null,
                loc.addressLine1,
                loc.city,
              ].filter(Boolean).join(' — ')
              return (
                <option key={loc.id} value={loc.id}>{label}</option>
              )
            })}
          </select>
          <Dialog open={newLocOpen} onOpenChange={setNewLocOpen}>
            <DialogTrigger render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={!customerId}
                title="Add location"
              >
                <Plus className="size-4" />
              </Button>
            } />
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>New Location</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateLocation} className="flex flex-col gap-3 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nl-address">Address</Label>
                  <div className="relative">
                    <Input
                      id="nl-address"
                      autoComplete="off"
                      value={newLocAddress}
                      onChange={(e) => handleLocAddrInput(e.target.value)}
                      onBlur={() => setTimeout(() => setShowLocAddrDropdown(false), 150)}
                      placeholder="123 Main St"
                      autoFocus
                      className="text-base"
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
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 space-y-1.5">
                    <Label htmlFor="nl-city">City</Label>
                    <Input
                      id="nl-city"
                      value={newLocCity}
                      onChange={(e) => setNewLocCity(e.target.value)}
                      placeholder="City"
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nl-state">State</Label>
                    <Input
                      id="nl-state"
                      value={newLocState}
                      onChange={(e) => setNewLocState(e.target.value)}
                      placeholder="IL"
                      maxLength={2}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nl-zip">Zip</Label>
                    <Input
                      id="nl-zip"
                      value={newLocZip}
                      onChange={(e) => setNewLocZip(e.target.value)}
                      placeholder="60601"
                      className="text-base"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={creatingLoc} className="w-full mt-1">
                  {creatingLoc ? 'Adding…' : 'Add Location'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Spring replacement"
          className="text-base"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">Start date</Label>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="text-base"
        />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Create Job'}
      </Button>
    </form>
  )
}
