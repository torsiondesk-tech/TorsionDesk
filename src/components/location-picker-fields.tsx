'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Star } from 'lucide-react'
import { ServiceLocationCard, isRedundantLocationName } from '@/components/service-location-card'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import type { UseLocationPickerResult } from '@/hooks/use-location-picker'

export interface LocationPickerFieldsProps {
  picker: UseLocationPickerResult
  customerId: string | null | undefined
  /**
   * Hide the standalone "Save Location" button — true while creating a new customer
   * (no customerId exists yet to attach the location to; the parent handles that path separately).
   */
  disableStandaloneSave?: boolean
  /** Prefix applied to all htmlFor/id values to prevent collisions when two instances are on one page */
  idPrefix?: string
}

export function LocationPickerFields({
  picker,
  customerId,
  disableStandaloneSave = false,
  idPrefix = 'lp',
}: LocationPickerFieldsProps) {
  const {
    locationMode,
    locationId,
    locations,
    primaryLocationId,
    newLocationAddr,
    locationEditName,
    locationGated,
    locationFormKey,
    savingLocation,
    locationError,
    setNewLocationAddr,
    setLocationEditName,
    setLocationGated,
    onSelectChange,
    startNewLocation,
    cancelLocationEdit,
    saveNewLocation,
    saveEditedLocation,
    setPrimary,
  } = picker

  // ── Case 1: No customer selected yet ───────────────────────────────────────
  if (!customerId) {
    return (
      <Select disabled>
        <SelectTrigger id={`${idPrefix}-serviceLocationId`} className="w-full opacity-50">
          <SelectValue placeholder="Select a customer first…" />
        </SelectTrigger>
      </Select>
    )
  }

  // ── Case 2: Existing location chosen — show the summary card ───────────────
  if (locationMode === 'existing' && locationId) {
    return (
      <ServiceLocationCard
        location={locations.find((l) => l.id === locationId)}
        isPrimary={locationId === primaryLocationId}
        onSetPrimary={customerId ? () => setPrimary(locationId) : undefined}
        onEditAddress={() => picker.startEditLocation()}
        onChangeLocation={() => { picker.setLocationId(undefined); }}
        onNewAddress={() => startNewLocation()}
      />
    )
  }

  // ── Case 3: Select dropdown (no location chosen yet) ───────────────────────
  return (
    <>
      {locationMode === 'existing' && (
        <>
          <Select
            value={locationId ?? ''}
            onValueChange={onSelectChange}
          >
            <SelectTrigger id={`${idPrefix}-serviceLocationId`} className="w-full">
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
                const isPrimary = l.id === primaryLocationId
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
              {locationId === primaryLocationId ? (
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
                  onClick={() => setPrimary(locationId)}
                >
                  <Star className="size-3" />
                  Set as Primary
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Inline new / edit address form */}
      {(locationMode === 'edit' || locationMode === 'new') && (
        <div key={locationFormKey} className="mt-2 space-y-3 rounded-lg border bg-muted/20 p-3">
          {/* Row 1: Location Name + Gated */}
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`${idPrefix}-locName`} className="text-xs">Location Name</Label>
              <Input
                id={`${idPrefix}-locName`}
                value={locationEditName}
                onChange={(e) => setLocationEditName(e.target.value)}
                placeholder="e.g. Home or Office"
              />
            </div>
            <div className="flex items-center gap-1.5 pt-5">
              <Checkbox
                id={`${idPrefix}-locGated`}
                checked={locationGated}
                onCheckedChange={(c) => setLocationGated(c === true)}
              />
              <Label htmlFor={`${idPrefix}-locGated`} className="cursor-pointer text-sm">
                Gated Property
              </Label>
            </div>
          </div>

          {/* Row 2: Street Address + Unit */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-locAddr1`} className="text-xs">Street Address</Label>
              <AddressAutocomplete
                key={locationFormKey}
                id={`${idPrefix}-locAddr1`}
                defaultValue={newLocationAddr.addressLine1}
                placeholder="Street Address"
                onAddressSelect={(result) => setNewLocationAddr(result)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-locAddr2`} className="text-xs">Unit</Label>
              <Input
                id={`${idPrefix}-locAddr2`}
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
              <Label htmlFor={`${idPrefix}-locCity`} className="text-xs">City</Label>
              <Input
                id={`${idPrefix}-locCity`}
                value={newLocationAddr.city ?? ''}
                onChange={(e) => setNewLocationAddr((a) => ({ ...a, city: e.target.value }))}
                placeholder="City"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-locState`} className="text-xs">State</Label>
              <Input
                id={`${idPrefix}-locState`}
                value={newLocationAddr.state ?? ''}
                onChange={(e) => setNewLocationAddr((a) => ({ ...a, state: e.target.value }))}
                placeholder="State/Province"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-locZip`} className="text-xs">Zip</Label>
              <Input
                id={`${idPrefix}-locZip`}
                value={newLocationAddr.postalCode ?? ''}
                onChange={(e) => setNewLocationAddr((a) => ({ ...a, postalCode: e.target.value }))}
                placeholder="Zip/Postal Code"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {locationMode === 'edit' && locationId && (
              <>
                <button
                  type="button"
                  onClick={cancelLocationEdit}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingLocation}
                  onClick={saveEditedLocation}
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
                    onClick={() => picker.onSelectChange('')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← Use existing location
                  </button>
                )}
                {!disableStandaloneSave && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingLocation}
                    onClick={saveNewLocation}
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
  )
}
