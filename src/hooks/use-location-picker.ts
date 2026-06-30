'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ParsedAddress } from '@/lib/places-actions'
import {
  getCustomerLocations,
  createServiceLocation,
  updateServiceLocation,
} from '@/app/(app)/jobs/actions'
import { setPrimaryLocationAction } from '@/app/(app)/customers/actions'

export interface LocationAddrState extends Partial<ParsedAddress> {
  addressLine2?: string
}

export interface CustomerLocation {
  id: string
  name: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  gated: boolean | null
}

export type LocationMode = 'existing' | 'new' | 'edit'

export interface LocationFormFields {
  serviceLocationId: string
  newLocationName: string
  newLocationAddress1: string
  newLocationAddress2: string
  newLocationCity: string
  newLocationState: string
  newLocationZip: string
  newLocationGated: string
  newLocationLat: string
  newLocationLng: string
}

export interface LocationPayloadFields {
  serviceLocationId: string | null
  newLocationName: string
  newLocationAddress1: string
  newLocationAddress2: string
  newLocationCity: string
  newLocationState: string
  newLocationPostalCode: string
  newLocationGated: boolean
}

export interface UseLocationPickerResult {
  locationMode: LocationMode
  locationId: string | undefined
  locations: CustomerLocation[]
  primaryLocationId: string | null
  newLocationAddr: LocationAddrState
  locationEditName: string
  locationGated: boolean
  locationFormKey: number
  savingLocation: boolean
  locationError: string | null

  setLocationId: (id: string | undefined) => void
  setNewLocationAddr: React.Dispatch<React.SetStateAction<LocationAddrState>>
  setLocationEditName: (name: string) => void
  setLocationGated: (gated: boolean) => void
  /** Push fetched locations into the hook after a customer-change fetch */
  hydrate: (locations: CustomerLocation[], primaryLocationId: string | null) => void
  startNewLocation: () => void
  startEditLocation: () => void
  cancelLocationEdit: () => void
  resetForCustomerChange: () => void
  onSelectChange: (value: string | null) => void
  saveNewLocation: () => Promise<void>
  saveEditedLocation: () => Promise<void>
  setPrimary: (locationId: string) => Promise<void>
  /** Serialize state as hidden-input name→value pairs for job-form's native <form action> */
  toFormFields: () => LocationFormFields
  /** Serialize state as JSON-payload fields for estimate-form's buildPayload() */
  toPayloadFields: () => LocationPayloadFields
}

export function useLocationPicker(opts: {
  customerId: string | null | undefined
  initialLocationId?: string | null
  initialPrimaryLocationId?: string | null
}): UseLocationPickerResult {
  const customerIdRef = useRef(opts.customerId)
  customerIdRef.current = opts.customerId

  const [locationMode, setLocationMode] = useState<LocationMode>(
    opts.initialLocationId ? 'existing' : 'new',
  )
  const [locationId, setLocationId] = useState<string | undefined>(
    opts.initialLocationId ?? undefined,
  )
  const [locations, setLocations] = useState<CustomerLocation[]>([])
  const [primaryLocationId, setPrimaryLocationId] = useState<string | null>(
    opts.initialPrimaryLocationId ?? null,
  )
  const [newLocationAddr, setNewLocationAddr] = useState<LocationAddrState>({})
  const [locationEditName, setLocationEditName] = useState('')
  const [locationGated, setLocationGated] = useState(false)
  const [locationFormKey, setLocationFormKey] = useState(0)
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const hydrate = useCallback((locs: CustomerLocation[], primaryId: string | null) => {
    setLocations(locs)
    setPrimaryLocationId(primaryId)
  }, [])

  // Sync edit form fields when an existing location is selected (for 'edit' mode)
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

  const startNewLocation = useCallback(() => {
    setLocationMode('new')
    setLocationId(undefined)
    setNewLocationAddr({})
    setLocationEditName('')
    setLocationGated(false)
    setLocationError(null)
  }, [])

  const startEditLocation = useCallback(() => {
    setLocationMode('edit')
  }, [])

  const cancelLocationEdit = useCallback(() => {
    setLocationFormKey((k) => k + 1)
    setLocationMode('existing')
    setLocationError(null)
  }, [])

  const resetForCustomerChange = useCallback(() => {
    setLocationId(undefined)
    setLocations([])
    setPrimaryLocationId(null)
    setLocationMode('existing')
    setLocationEditName('')
    setLocationGated(false)
    setNewLocationAddr({})
    setLocationError(null)
  }, [])

  const onSelectChange = useCallback((val: string | null) => {
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
  }, [])

  const saveNewLocation = useCallback(async () => {
    const customerId = customerIdRef.current
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
      const { locations: refreshed, primaryLocationId: refreshedPrimary } =
        await getCustomerLocations(customerId)
      hydrate(refreshed, refreshedPrimary)
      setLocationId(result.id)
      setLocationMode('existing')
      setNewLocationAddr({})
      setLocationEditName('')
      setLocationGated(false)
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingLocation(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newLocationAddr, locationEditName, locationGated, hydrate])

  const saveEditedLocation = useCallback(async () => {
    if (!locationId) {
      setLocationError('No location selected.')
      return
    }
    if (!newLocationAddr.addressLine1?.trim()) {
      setLocationError('Street address is required.')
      return
    }
    const customerId = customerIdRef.current
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
      if (customerId) {
        const { locations: refreshed, primaryLocationId: refreshedPrimary } =
          await getCustomerLocations(customerId)
        hydrate(refreshed, refreshedPrimary)
      }
      setLocationMode('existing')
      setLocationError(null)
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingLocation(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, newLocationAddr, locationEditName, locationGated, hydrate])

  const setPrimary = useCallback(async (locId: string) => {
    const customerId = customerIdRef.current
    if (!customerId) return
    const result = await setPrimaryLocationAction(customerId, locId)
    if (result.success) setPrimaryLocationId(locId)
  }, [])

  const toFormFields = useCallback((): LocationFormFields => ({
    serviceLocationId: locationId ?? '',
    newLocationName: locationEditName,
    newLocationAddress1: newLocationAddr.addressLine1 ?? '',
    newLocationAddress2: newLocationAddr.addressLine2 ?? '',
    newLocationCity: newLocationAddr.city ?? '',
    newLocationState: newLocationAddr.state ?? '',
    newLocationZip: newLocationAddr.postalCode ?? '',
    // Use 'true'/'false' strings — zod preprocesses as v === 'true' || v === true
    newLocationGated: locationGated ? 'true' : 'false',
    newLocationLat: newLocationAddr.latitude ?? '',
    newLocationLng: newLocationAddr.longitude ?? '',
  }), [locationId, locationEditName, newLocationAddr, locationGated])

  const toPayloadFields = useCallback((): LocationPayloadFields => ({
    serviceLocationId: locationId ?? null,
    newLocationName: locationEditName,
    newLocationAddress1: newLocationAddr.addressLine1 ?? '',
    newLocationAddress2: newLocationAddr.addressLine2 ?? '',
    newLocationCity: newLocationAddr.city ?? '',
    newLocationState: newLocationAddr.state ?? '',
    newLocationPostalCode: newLocationAddr.postalCode ?? '',
    newLocationGated: locationGated,
  }), [locationId, locationEditName, newLocationAddr, locationGated])

  return {
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

    setLocationId,
    setNewLocationAddr,
    setLocationEditName,
    setLocationGated,
    hydrate,
    startNewLocation,
    startEditLocation,
    cancelLocationEdit,
    resetForCustomerChange,
    onSelectChange,
    saveNewLocation,
    saveEditedLocation,
    setPrimary,
    toFormFields,
    toPayloadFields,
  }
}
