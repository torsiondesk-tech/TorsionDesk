'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { useTechCustomers, useTechLocations } from '@/app/(tech)/lib/use-tech-data'
import { createTechDb, type CachedCustomer, type CachedLocation } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type EstimateCreatePayload } from '@/app/(tech)/lib/sync'
import { createEstimateAction, type CreateEstimateInput } from '@/app/(tech)/tech/estimates/actions'
import { formatPhoneInput } from '@/lib/utils'
import { toast } from 'sonner'

interface EstimateLineItem {
  id: string
  name: string
  qty: string
  unitPrice: string
}

interface EstimateFormProps {
  orgId: string
  userId: string
  initialCustomers?: CachedCustomer[]
  initialLocations?: CachedLocation[]
}

function formatMoney(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}

export function EstimateForm({
  orgId,
  userId,
  initialCustomers = [],
  initialLocations = [],
}: EstimateFormProps) {
  const db = useMemo(() => createTechDb(orgId), [orgId])
  const liveCustomers = useTechCustomers(orgId)
  const [customerId, setCustomerId] = useState('')
  const liveLocations = useTechLocations(orgId, customerId || null)
  const online = useOnline()
  const router = useRouter()

  // Seed server-fetched data into Dexie so the form works offline too.
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

  const customersReady = liveCustomers !== undefined
  const locationsReady = liveLocations !== undefined
  const customers = customersReady ? liveCustomers : initialCustomers
  const locations = useMemo(() => {
    const fromLive = locationsReady ? liveLocations : []
    const fromInitial = initialLocations.filter((loc) => loc.customerId === customerId)
    const map = new Map<string, CachedLocation>()
    for (const loc of [...fromInitial, ...fromLive]) {
      map.set(loc.id, loc)
    }
    return Array.from(map.values())
  }, [locationsReady, liveLocations, initialLocations, customerId])

  const [serviceLocationId, setServiceLocationId] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [description, setDescription] = useState('')
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([])
  const [followUpDate, setFollowUpDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', qty: '', unitPrice: '' },
    ])
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  function updateLineItem(id: string, patch: Partial<EstimateLineItem>) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  function totalCents(): number {
    return lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty || '0')
      const price = parseFloat(item.unitPrice || '0')
      return sum + Math.round(qty * price * 100)
    }, 0)
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
    const input: CreateEstimateInput = {
      customerId,
      serviceLocationId: serviceLocationId || null,
      contactName: contactName.trim() || null,
      contactPhone: contactPhone.trim() || null,
      description: description.trim(),
      lineItems: lineItems.map((item) => ({
        name: item.name.trim(),
        qty: item.qty,
        unitPrice: item.unitPrice,
      })),
      followUpDate: followUpDate || null,
      expiryDate: expiryDate || null,
      notes: notes.trim() || null,
      internalNotes: internalNotes.trim() || null,
    }

    if (online) {
      const result = await createEstimateAction(input)
      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success('Estimate created')
        router.push('/tech/estimates')
      }
    } else {
      await enqueueOutboxItem(orgId, {
        type: 'estimate_create',
        payload: { input } satisfies EstimateCreatePayload,
      })
      toast.info('Queued estimate — will sync when online')
      router.push('/tech/estimates')
    }

    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="customer">Customer</Label>
        <select
          id="customer"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value)
            setServiceLocationId('')
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-base"
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Service location</Label>
        <select
          id="location"
          value={serviceLocationId}
          onChange={(e) => setServiceLocationId(e.target.value)}
          disabled={!customerId}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-base disabled:opacity-50"
        >
          <option value="">
            {customerId ? 'Select location' : 'Select a customer first'}
          </option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {[location.name, location.addressLine1, location.city]
                .filter(Boolean)
                .join(' — ')}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact name</Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact name"
            className="text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">Contact phone</Label>
          <Input
            id="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(formatPhoneInput(e.target.value))}
            placeholder="(555) 000-0000"
            className="text-base"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Spring replacement estimate"
          className="text-base"
          required
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Line items</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Add item
            </Button>
          </div>
          {lineItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          )}
          {lineItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
            >
              <div>
                <Label htmlFor={`name-${item.id}`} className="sr-only">
                  Item name
                </Label>
                <Input
                  id={`name-${item.id}`}
                  value={item.name}
                  onChange={(e) =>
                    updateLineItem(item.id, { name: e.target.value })
                  }
                  placeholder="Item name"
                  className="text-base"
                />
              </div>
              <div>
                <Label htmlFor={`qty-${item.id}`} className="sr-only">
                  Qty
                </Label>
                <Input
                  id={`qty-${item.id}`}
                  value={item.qty}
                  onChange={(e) =>
                    updateLineItem(item.id, { qty: e.target.value })
                  }
                  placeholder="Qty"
                  className="w-20 text-base"
                />
              </div>
              <div>
                <Label htmlFor={`price-${item.id}`} className="sr-only">
                  Unit price
                </Label>
                <Input
                  id={`price-${item.id}`}
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateLineItem(item.id, { unitPrice: e.target.value })
                  }
                  placeholder="Price"
                  className="w-28 text-base"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => removeLineItem(item.id)}
                aria-label="Remove item"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          {lineItems.length > 0 && (
            <p className="text-sm font-medium text-right">
              Total: {formatMoney(totalCents())}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Customer-facing notes"
          className="text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internalNotes">Internal notes</Label>
        <Textarea
          id="internalNotes"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Internal notes"
          className="text-base"
        />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Create Estimate'}
      </Button>
    </form>
  )
}