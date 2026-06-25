'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  MapPin,
  X,
  Pencil,
  Trash2,
  Wrench,
  Save,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import type { ParsedAddress } from '@/lib/places-actions'
import {
  createLocationAction,
  updateLocationAction,
  deleteLocationAction,
  createEquipmentAction,
  deleteEquipmentAction,
  setPrimaryLocationAction,
} from '../actions'

interface LocationRow {
  id: string
  name: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  gated: boolean | null
  equipment: Array<{
    id: string
    kind: 'door' | 'opener' | 'spring'
    brand: string | null
    widthFt: string | null
    heightFt: string | null
    model: string | null
    wireSize: string | null
    insideDiameter: string | null
    length: string | null
    windDirection: 'left' | 'right' | 'pair' | null
  }>
}

interface LocationsSectionProps {
  customerId: string
  locations: LocationRow[]
  primaryLocationId: string | null
}

// ── Inline Add Form ────────────────────────────────────────────────────────

function AddLocationForm({
  customerId,
  onSuccess,
  onCancel,
}: {
  customerId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [gated, setGated] = useState(false)
  const [addr, setAddr] = useState<Partial<ParsedAddress>>({})

  const handleAddressSelect = (result: ParsedAddress) => {
    setAddr(result)
  }

  return (
    <form
      action={async (formData) => {
        formData.append('customerId', customerId)
        const result = await createLocationAction({}, formData)
        if (result.success) onSuccess()
      }}
      className="rounded-lg border p-4"
    >
      <p className="mb-3 text-sm font-medium">Add New Location</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="add-loc-name">Location name</Label>
          <Input id="add-loc-name" name="name" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="add-addressLine1">Address</Label>
          <AddressAutocomplete
            id="add-addressLine1"
            name="addressLine1"
            defaultValue={addr.addressLine1}
            onAddressSelect={handleAddressSelect}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-city">City</Label>
          <Input
            id="add-city"
            name="city"
            value={addr.city ?? ''}
            onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-state">State</Label>
          <Input
            id="add-state"
            name="state"
            value={addr.state ?? ''}
            onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-postalCode">Postal code</Label>
          <Input
            id="add-postalCode"
            name="postalCode"
            value={addr.postalCode ?? ''}
            onChange={(e) => setAddr((a) => ({ ...a, postalCode: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-country">Country</Label>
          <Input
            id="add-country"
            name="country"
            value={addr.country ?? 'USA'}
            onChange={(e) => setAddr((a) => ({ ...a, country: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="hidden" name="gated" value={gated ? '1' : '0'} />
          <Checkbox
            id="add-gated"
            checked={gated}
            onCheckedChange={(c) => setGated(c === true)}
          />
          <Label htmlFor="add-gated" className="cursor-pointer">
            Gated community
          </Label>
        </div>
      </div>
      {/* Hidden lat/lng captured by autocomplete */}
      <input type="hidden" name="latitude" value={addr.latitude ?? ''} />
      <input type="hidden" name="longitude" value={addr.longitude ?? ''} />
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm">
          <Save className="mr-1 size-3.5" />
          Save Location
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ── Inline Edit Form ────────────────────────────────────────────────────────

function EditLocationForm({
  loc,
  customerId,
  onSuccess,
  onCancel,
}: {
  loc: LocationRow
  customerId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [gated, setGated] = useState(loc.gated ?? false)
  const [addr, setAddr] = useState<Partial<ParsedAddress>>({
    addressLine1: loc.addressLine1 ?? '',
    city: loc.city ?? '',
    state: loc.state ?? '',
    postalCode: loc.postalCode ?? '',
    country: loc.country ?? 'USA',
    latitude: '',
    longitude: '',
  })

  const handleAddressSelect = (result: ParsedAddress) => {
    setAddr(result)
  }

  return (
    <form
      action={async (formData) => {
        formData.append('id', loc.id)
        formData.append('customerId', customerId)
        formData.append('gated', gated ? '1' : '0')
        const result = await updateLocationAction({}, formData)
        if (result.success) onSuccess()
      }}
      className="p-4"
    >
      <p className="mb-3 text-sm font-medium">Edit Location</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`edit-name-${loc.id}`}>Location name</Label>
          <Input
            id={`edit-name-${loc.id}`}
            name="name"
            defaultValue={loc.name ?? ''}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`edit-addr-${loc.id}`}>Address</Label>
          <AddressAutocomplete
            id={`edit-addr-${loc.id}`}
            name="addressLine1"
            defaultValue={addr.addressLine1}
            onAddressSelect={handleAddressSelect}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`edit-city-${loc.id}`}>City</Label>
          <Input
            id={`edit-city-${loc.id}`}
            name="city"
            value={addr.city ?? ''}
            onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`edit-state-${loc.id}`}>State</Label>
          <Input
            id={`edit-state-${loc.id}`}
            name="state"
            value={addr.state ?? ''}
            onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`edit-postal-${loc.id}`}>Postal code</Label>
          <Input
            id={`edit-postal-${loc.id}`}
            name="postalCode"
            value={addr.postalCode ?? ''}
            onChange={(e) => setAddr((a) => ({ ...a, postalCode: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`edit-country-${loc.id}`}>Country</Label>
          <Input
            id={`edit-country-${loc.id}`}
            name="country"
            value={addr.country ?? 'USA'}
            onChange={(e) => setAddr((a) => ({ ...a, country: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="hidden" name="gated" value={gated ? '1' : '0'} />
          <Checkbox
            id={`edit-gated-${loc.id}`}
            checked={gated}
            onCheckedChange={(c) => setGated(c === true)}
          />
          <Label htmlFor={`edit-gated-${loc.id}`} className="cursor-pointer">
            Gated community
          </Label>
        </div>
      </div>
      <input type="hidden" name="latitude" value={addr.latitude ?? ''} />
      <input type="hidden" name="longitude" value={addr.longitude ?? ''} />
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm">
          <Save className="mr-1 size-3.5" />
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function LocationsSection({
  customerId,
  locations,
  primaryLocationId,
}: LocationsSectionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [equipmentFormLocId, setEquipmentFormLocId] = useState<string | null>(null)
  const [equipmentKind, setEquipmentKind] = useState<'door' | 'opener' | 'spring'>('door')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">
          Service Locations &amp; Equipment
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm((s) => !s)}
        >
          {showAddForm ? (
            <>
              <X className="size-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="size-4" /> Add Location
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {locations.length === 0 && !showAddForm && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No service locations yet.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setShowAddForm(true)}
            >
              Add Location
            </Button>
          </div>
        )}

        {showAddForm && (
          <AddLocationForm
            customerId={customerId}
            onSuccess={() => {
              setShowAddForm(false)
              router.refresh()
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {locations.map((loc) => {
          const doors = loc.equipment.filter((e) => e.kind === 'door')
          const openers = loc.equipment.filter((e) => e.kind === 'opener')
          const springs = loc.equipment.filter((e) => e.kind === 'spring')
          const isEditing = editingId === loc.id

          return (
            <div key={loc.id} className="rounded-lg border">
              {!isEditing ? (
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        {loc.name && <p className="font-medium">{loc.name}</p>}
                        {(() => {
                          const addrStr = [loc.addressLine1, loc.addressLine2, loc.city, loc.state, loc.postalCode]
                            .filter(Boolean)
                            .join(', ')
                          if (!addrStr) return null
                          return (
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(addrStr)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-muted-foreground hover:underline"
                            >
                              {addrStr}
                            </a>
                          )
                        })()}
                        {loc.gated && (
                          <Badge className="mt-1" variant="outline">
                            Gated
                          </Badge>
                        )}
                        {primaryLocationId === loc.id && (
                          <Badge className="mt-1 gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                            <Star className="size-3 fill-amber-500 text-amber-500" />
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {primaryLocationId !== loc.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() =>
                            startTransition(async () => {
                              await setPrimaryLocationAction(customerId, loc.id)
                              router.refresh()
                            })
                          }
                        >
                          <Star className="size-3" />
                          Set Primary
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setEditingId(loc.id)}
                      >
                        <Pencil className="size-3" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() =>
                          startTransition(async () => {
                            await deleteLocationAction(loc.id, customerId)
                            router.refresh()
                          })
                        }
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Equipment grid */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Doors
                      </p>
                      {doors.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {doors.map((d) => (
                            <li
                              key={d.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {d.brand ?? 'Unknown'} — {d.widthFt}ft ×{' '}
                                {d.heightFt}ft
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 p-0 text-destructive opacity-50 transition-opacity hover:opacity-100"
                                onClick={() =>
                                  startTransition(async () => {
                                    await deleteEquipmentAction(d.id, customerId)
                                    router.refresh()
                                  })
                                }
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Openers
                      </p>
                      {openers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {openers.map((o) => (
                            <li
                              key={o.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {o.brand ?? 'Unknown'} {o.model}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 p-0 text-destructive opacity-50 transition-opacity hover:opacity-100"
                                onClick={() =>
                                  startTransition(async () => {
                                    await deleteEquipmentAction(o.id, customerId)
                                    router.refresh()
                                  })
                                }
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Springs
                      </p>
                      {springs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {springs.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {s.wireSize}″ × {s.insideDiameter}″ ×{' '}
                                {s.length}″ ({s.windDirection})
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 p-0 text-destructive opacity-50 transition-opacity hover:opacity-100"
                                onClick={() =>
                                  startTransition(async () => {
                                    await deleteEquipmentAction(s.id, customerId)
                                    router.refresh()
                                  })
                                }
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Add equipment toggle */}
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        setEquipmentFormLocId((curr) =>
                          curr === loc.id ? null : loc.id,
                        )
                        setEquipmentKind('door')
                      }}
                    >
                      {equipmentFormLocId === loc.id ? (
                        <>
                          <X className="size-3" /> Cancel
                        </>
                      ) : (
                        <>
                          <Wrench className="size-3" /> Add Equipment
                        </>
                      )}
                    </Button>
                  </div>

                  {equipmentFormLocId === loc.id && (
                    <EquipmentForm
                      customerId={customerId}
                      locationId={loc.id}
                      onSuccess={() => {
                        setEquipmentFormLocId(null)
                        router.refresh()
                      }}
                    />
                  )}
                </div>
              ) : (
                <EditLocationForm
                  loc={loc}
                  customerId={customerId}
                  onSuccess={() => {
                    setEditingId(null)
                    router.refresh()
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Inline Equipment Form ───────────────────────────────────────────────────

function EquipmentForm({
  customerId,
  locationId,
  onSuccess,
}: {
  customerId: string
  locationId: string
  onSuccess: () => void
}) {
  const [kind, setKind] = useState<'door' | 'opener' | 'spring'>('door')
  const [pending, setPending] = useState(false)

  return (
    <form
      action={async (formData) => {
        setPending(true)
        formData.append('serviceLocationId', locationId)
        formData.append('customerId', customerId)
        try {
          const result = await createEquipmentAction({}, formData)
          if (result.success) {
            onSuccess()
          }
        } finally {
          setPending(false)
        }
      }}
      className="mt-3 rounded-md border bg-muted/40 p-3"
    >
      <p className="mb-2 text-xs font-medium">Add Equipment</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="eq-kind">Kind *</Label>
          <select
            id="eq-kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'door' | 'opener' | 'spring')}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="door">Door</option>
            <option value="opener">Opener</option>
            <option value="spring">Spring</option>
          </select>
        </div>

        {kind === 'door' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="eq-brand">Brand *</Label>
              <Input id="eq-brand" name="brand" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-modelSeries">Model Series</Label>
              <Input id="eq-modelSeries" name="modelSeries" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-widthFt">Width (ft) *</Label>
              <Input id="eq-widthFt" name="widthFt" type="number" step="1" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-heightFt">Height (ft) *</Label>
              <Input id="eq-heightFt" name="heightFt" type="number" step="1" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-material">Material</Label>
              <Input id="eq-material" name="material" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-style">Style</Label>
              <Input id="eq-style" name="style" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-color">Color</Label>
              <Input id="eq-color" name="color" />
            </div>
          </>
        )}

        {kind === 'opener' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="eq-brand">Brand *</Label>
              <Input id="eq-brand" name="brand" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-model">Model</Label>
              <Input id="eq-model" name="model" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-hp">HP</Label>
              <Input id="eq-hp" name="hp" type="number" step="1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-serial">Serial</Label>
              <Input id="eq-serial" name="serial" />
            </div>
          </>
        )}

        {kind === 'spring' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="eq-wireSize">Wire Size *</Label>
              <Input id="eq-wireSize" name="wireSize" type="number" step="0.001" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-insideDiameter">Inside Diameter *</Label>
              <Input id="eq-insideDiameter" name="insideDiameter" type="number" step="1" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-length">Length (in) *</Label>
              <Input id="eq-length" name="length" type="number" step="1" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-windDirection">Wind Direction *</Label>
              <select
                id="eq-windDirection"
                name="windDirection"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="pair">Pair</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-cycleRating">Cycle Rating</Label>
              <Input id="eq-cycleRating" name="cycleRating" type="number" />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="eq-installDate">Install Date</Label>
          <Input id="eq-installDate" name="installDate" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eq-warrantyExpires">Warranty Expires</Label>
          <Input id="eq-warrantyExpires" name="warrantyExpires" type="date" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="eq-notes">Notes</Label>
          <Input id="eq-notes" name="notes" placeholder="Additional details…" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Save className="mr-1 size-3.5" />
          {pending ? 'Saving…' : 'Save Equipment'}
        </Button>
      </div>
    </form>
  )
}
