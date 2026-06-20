'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Pencil, ChevronsUpDown, Plus, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { updateTechLocationAction } from '@/app/(tech)/tech/customers/actions'
import { addAndAssignJobLocationAction, assignJobLocationAction } from '@/app/(tech)/tech/jobs/actions'
import { searchPlacesAction, getPlaceDetailsAction, type PlaceSuggestion } from '@/lib/places-actions'
import { toast } from 'sonner'

interface ServiceLocation {
  id: string
  name: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}

interface TechLocationCardProps {
  jobId: string
  customerId: string
  serviceLocation: ServiceLocation | null
  availableLocations: ServiceLocation[]
}

function AddressForm({
  initialAddress = '',
  initialCity = '',
  initialState = '',
  initialZip = '',
  submitLabel,
  saving,
  onSubmit,
}: {
  initialAddress?: string
  initialCity?: string
  initialState?: string
  initialZip?: string
  submitLabel: string
  saving: boolean
  onSubmit: (vals: { address: string; city: string; state: string; zip: string }) => void
}) {
  const [address, setAddress] = useState(initialAddress)
  const [city, setCity] = useState(initialCity)
  const [state, setState] = useState(initialState)
  const [zip, setZip] = useState(initialZip)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [predictions, setPredictions] = useState<PlaceSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  function handleAddrInput(val: string) {
    setAddress(val); setCity(''); setState(''); setZip('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 3) { setPredictions([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlacesAction(val)
      setPredictions(results); setShowDropdown(results.length > 0)
    }, 300)
  }

  async function handleAddrSelect(suggestion: PlaceSuggestion) {
    setShowDropdown(false); setPredictions([])
    const details = await getPlaceDetailsAction(suggestion.placeId)
    if (details) { setAddress(details.addressLine1); setCity(details.city); setState(details.state); setZip(details.postalCode) }
    else { setAddress(suggestion.description.split(',')[0].trim()) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ address, city, state, zip }) }} className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="tl-addr">Address</Label>
        <div className="relative">
          <Input
            id="tl-addr"
            autoComplete="off"
            value={address}
            onChange={(e) => handleAddrInput(e.target.value)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="123 Main St"
            autoFocus
            className="text-base"
          />
          {showDropdown && predictions.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-md max-h-56 overflow-y-auto">
              {predictions.map((p) => (
                <li key={p.placeId} onMouseDown={(e) => e.preventDefault()} onClick={() => { void handleAddrSelect(p) }} className="cursor-pointer px-3 py-2.5 text-sm hover:bg-accent leading-snug">
                  {p.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1 space-y-1.5">
          <Label htmlFor="tl-city">City</Label>
          <Input id="tl-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tl-state">State</Label>
          <Input id="tl-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="IL" maxLength={2} className="text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tl-zip">Zip</Label>
          <Input id="tl-zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="60601" className="text-base" />
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : submitLabel}</Button>
    </form>
  )
}

function locationLabel(loc: ServiceLocation): string {
  const isAddressLikeName = loc.name ? /^\d/.test(loc.name.trim()) : true
  return [
    !isAddressLikeName ? loc.name : null,
    loc.addressLine1,
    loc.city,
  ].filter(Boolean).join(' — ') || 'Unnamed location'
}

export function TechLocationCard({ jobId, customerId, serviceLocation, availableLocations }: TechLocationCardProps) {
  const router = useRouter()
  const [selectOpen, setSelectOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  async function handleAssign(locationId: string) {
    setAssigning(locationId)
    const result = await assignJobLocationAction({ jobId, locationId })
    setAssigning(null)
    if (!result.success) { toast.error(result.error); return }
    toast.success('Location updated')
    setSelectOpen(false)
    router.refresh()
  }

  async function handleAdd(vals: { address: string; city: string; state: string; zip: string }) {
    setAddSaving(true)
    const result = await addAndAssignJobLocationAction({
      jobId, customerId,
      addressLine1: vals.address || null, city: vals.city || null,
      state: vals.state || null, postalCode: vals.zip || null,
    })
    setAddSaving(false)
    if (!result.success) { toast.error(result.error); return }
    toast.success('Location added')
    setSelectOpen(false)
    setShowAddForm(false)
    router.refresh()
  }

  async function handleEdit(vals: { address: string; city: string; state: string; zip: string }) {
    if (!serviceLocation) return
    setEditSaving(true)
    const result = await updateTechLocationAction({
      locationId: serviceLocation.id, jobId,
      addressLine1: vals.address || null, city: vals.city || null,
      state: vals.state || null, postalCode: vals.zip || null,
    })
    setEditSaving(false)
    if (!result.success) { toast.error(result.error); return }
    toast.success('Location saved')
    setEditOpen(false)
    router.refresh()
  }

  const parts = serviceLocation
    ? [serviceLocation.addressLine1, serviceLocation.addressLine2, [serviceLocation.city, serviceLocation.state, serviceLocation.postalCode].filter(Boolean).join(', ')].filter(Boolean)
    : []
  const mapsUrl = parts.length ? `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}` : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
        <CardTitle className="text-base flex-1">Service Location</CardTitle>

        {/* Select / add location */}
        <Dialog open={selectOpen} onOpenChange={(v) => { setSelectOpen(v); if (!v) setShowAddForm(false) }}>
          <DialogTrigger render={
            <Button type="button" variant="ghost" size="icon" className="-mr-1" title="Select location">
              <ChevronsUpDown className="size-4" />
            </Button>
          } />
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Select Location</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1 mt-2">
              {availableLocations.length > 0 ? (
                availableLocations.map((loc) => {
                  const isCurrent = loc.id === serviceLocation?.id
                  const isAssigning = assigning === loc.id
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      disabled={isCurrent || !!assigning}
                      onClick={() => handleAssign(loc.id)}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent disabled:opacity-60 disabled:cursor-default transition-colors"
                    >
                      <Check className={`size-4 shrink-0 ${isCurrent ? 'text-primary' : 'invisible'}`} />
                      <span className="flex-1 leading-snug">
                        <span className="block font-medium">{locationLabel(loc)}</span>
                        {loc.city && !locationLabel(loc).includes(loc.city) && (
                          <span className="text-muted-foreground">{loc.city}</span>
                        )}
                      </span>
                      {isAssigning && <span className="text-xs text-muted-foreground">Saving…</span>}
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground px-3 py-2">No locations on file yet.</p>
              )}

              <div className="mt-2 border-t pt-3">
                {!showAddForm ? (
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setShowAddForm(true)}>
                    <Plus className="size-4" /> Add new address
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium">New address</p>
                    <AddressForm submitLabel="Add & Select" saving={addSaving} onSubmit={handleAdd} />
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit current location */}
        {serviceLocation && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger render={
              <Button type="button" variant="ghost" size="icon" className="-mr-2" title="Edit location">
                <Pencil className="size-4" />
              </Button>
            } />
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Edit Location</DialogTitle>
              </DialogHeader>
              {editOpen && (
                <div className="mt-2">
                  <AddressForm
                    initialAddress={serviceLocation.addressLine1 ?? ''}
                    initialCity={serviceLocation.city ?? ''}
                    initialState={serviceLocation.state ?? ''}
                    initialZip={serviceLocation.postalCode ?? ''}
                    submitLabel="Save Location"
                    saving={editSaving}
                    onSubmit={handleEdit}
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline leading-relaxed">
            {parts.map((line, i) => <span key={i} className="block">{line}</span>)}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">No service location — tap <ChevronsUpDown className="size-3 inline" /> to select or add one.</p>
        )}
      </CardContent>
    </Card>
  )
}
