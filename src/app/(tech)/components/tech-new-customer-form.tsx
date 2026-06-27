'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { createTechCustomerAction } from '@/app/(tech)/tech/customers/actions'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { searchPlacesAction, getPlaceDetailsAction, type PlaceSuggestion } from '@/lib/places-actions'
import { formatPhoneInput, capitalizeWords } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  orgId: string
}

export function TechNewCustomerForm({ orgId }: Props) {
  const router = useRouter()
  const db = useMemo(() => createTechDb(orgId), [orgId])

  const [name, setName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneExt, setPhoneExt] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [predictions, setPredictions] = useState<PlaceSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  function handleAddressInput(val: string) {
    setAddress(val)
    setCity('')
    setState('')
    setZip('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 3) {
      setPredictions([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlacesAction(val)
      setPredictions(results)
      setShowDropdown(results.length > 0)
    }, 300)
  }

  async function handleAddressSelect(suggestion: PlaceSuggestion) {
    setShowDropdown(false)
    setPredictions([])
    const details = await getPlaceDetailsAction(suggestion.placeId)
    if (details) {
      setAddress(details.addressLine1)
      setCity(details.city)
      setState(details.state)
      setZip(details.postalCode)
    } else {
      setAddress(suggestion.description.split(',')[0].trim())
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Customer name is required')
      return
    }
    setSaving(true)
    const result = await createTechCustomerAction({
      name: name.trim(),
      contactFirstName: firstName.trim() || null,
      contactLastName: lastName.trim() || null,
      phone: phone || null,
      phoneExt: phoneExt || null,
      email: email.trim() || null,
      addressLine1: address || null,
      city: city || null,
      state: state || null,
      postalCode: zip || null,
    })
    if (!result.success) {
      toast.error(result.error)
      setSaving(false)
      return
    }
    await db.open()
    await db.customers.put({
      id: result.customerId,
      tenantId: orgId,
      name: name.trim(),
      accountNo: null,
      primaryPhone: phone || null,
      primaryCity: city || null,
    })
    if (result.locationId) {
      await db.serviceLocations.put({
        id: result.locationId,
        tenantId: orgId,
        customerId: result.customerId,
        name: null,
        addressLine1: address || null,
        addressLine2: null,
        city: city || null,
        state: state || null,
        postalCode: zip || null,
        country: null,
        latitude: null,
        longitude: null,
        gated: false,
      })
    }
    toast.success('Customer created')
    router.push('/tech/jobs')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cust-name">Customer Name *</Label>
            <Input
              id="cust-name"
              value={name}
              onChange={(e) => setName(capitalizeWords(e.target.value))}
              autoCapitalize="words"
              placeholder="e.g. Smith Residence or Acme Corp"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first-name">First Name</Label>
              <Input
                id="first-name"
                value={firstName}
                onChange={(e) => setFirstName(capitalizeWords(e.target.value))}
                autoCapitalize="words"
                placeholder="John"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last-name">Last Name</Label>
              <Input
                id="last-name"
                value={lastName}
                onChange={(e) => setLastName(capitalizeWords(e.target.value))}
                autoCapitalize="words"
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <div className="flex items-center gap-2">
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(555) 000-0000"
                className="flex-1"
              />
              <Input
                value={phoneExt}
                onChange={(e) => setPhoneExt(e.target.value.replace(/\D/g, ''))}
                placeholder="Ext"
                className="w-16"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">Service Location</p>

          <div className="relative flex flex-col gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => handleAddressInput(e.target.value)}
              placeholder="123 Main St"
              autoComplete="off"
            />
            {showDropdown && predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-background shadow-lg">
                {predictions.map((p) => (
                  <button
                    key={p.placeId}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={() => handleAddressSelect(p)}
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Springfield"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="IL"
                maxLength={2}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zip">Zip Code</Label>
            <Input
              id="zip"
              inputMode="numeric"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="62701"
              maxLength={10}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? 'Saving…' : 'Create Customer'}
        </Button>
      </div>
    </form>
  )
}
