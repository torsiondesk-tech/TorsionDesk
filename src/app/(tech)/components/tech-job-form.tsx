'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { useTechCustomers, useTechLocations } from '@/app/(tech)/lib/use-tech-data'
import { createTechDb, type CachedCustomer, type CachedLocation } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type JobCreatePayload } from '@/app/(tech)/lib/sync'
import { createTechJobAction } from '@/app/(tech)/tech/jobs/actions'
import { toISODate } from '@/lib/utils'
import { toast } from 'sonner'

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

  const customers = liveCustomers !== undefined ? liveCustomers : initialCustomers
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
    const input = {
      customerId,
      serviceLocationId: serviceLocationId || null,
      description: description.trim(),
      startDate: startDate || null,
    }

    if (online) {
      const result = await createTechJobAction(input)
      if (!result.success) {
        toast.error(result.error)
        setSaving(false)
        return
      }
      toast.success('Job created')
      router.push('/tech/jobs')
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
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
            {customerId ? 'Select location (optional)' : 'Select a customer first'}
          </option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {[loc.name, loc.addressLine1, loc.city].filter(Boolean).join(' — ')}
            </option>
          ))}
        </select>
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
