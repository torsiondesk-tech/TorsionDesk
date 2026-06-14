'use client'

import { useActionState, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CustomerSearch } from '@/components/customer-search'
import { TagSelect, type TagOption } from '@/components/tag-select'
import {
  createJob,
  updateJob,
  type JobActionState,
  getCustomerContacts,
  getCustomerLocations,
} from '../actions'
import { StatusDropdown } from './status-dropdown'
import { LineItems } from './line-items'

export interface JobFormLineItem {
  id?: string
  type: 'product' | 'service' | 'discount' | 'expense'
  refId?: string | null
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
  tagIds?: string[]
  assigneeUserIds?: string[]
  lineItems?: JobFormLineItem[]
}

interface ReferenceData {
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  jobSources: Array<{ id: string; name: string }>
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  availableTags: TagOption[]
  productCategories: Array<{ id: string; name: string }>
  orgMembers: Array<{ id: string; label: string }>
}

interface JobFormProps {
  mode: 'create' | 'edit'
  initial?: JobFormData
  referenceData: ReferenceData
  defaults?: {
    customerId?: string
    contactId?: string
    locationId?: string
  }
}

export function JobForm({ mode, initial, referenceData, defaults }: JobFormProps) {
  const router = useRouter()
  const action = mode === 'create' ? createJob : updateJob
  const [state, formAction, pending] = useActionState<JobActionState, FormData>(
    action,
    {},
  )

  // Redirect on create success
  useEffect(() => {
    if (state.success && state.id) {
      router.push(`/jobs/${state.id}`)
    }
  }, [state, router])

  // Booleans
  const [multiDay, setMultiDay] = useState(initial?.multiDay ?? false)
  const [requiresFollowUp, setRequiresFollowUp] = useState(
    initial?.requiresFollowUp ?? false,
  )
  const [isRepeating, setIsRepeating] = useState(initial?.isRepeating ?? false)

  // Customer + dependent selects
  const [customerId, setCustomerId] = useState<string | undefined>(
    initial?.customerId ?? defaults?.customerId ?? undefined,
  )
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '')
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([])
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; addressLine1: string | null; city: string | null }>
  >([])

  const [contactId, setContactId] = useState<string | undefined>(
    initial?.contactId ?? defaults?.contactId ?? undefined,
  )
  const [locationId, setLocationId] = useState<string | undefined>(
    initial?.serviceLocationId ?? defaults?.locationId ?? undefined,
  )

  // Line items state (synced from initial or local)
  const [lineItems, setLineItems] = useState<JobFormLineItem[]>(
    initial?.lineItems ?? [],
  )

  // Sync line items from server props after router.refresh()
  useEffect(() => {
    if (initial?.lineItems) {
      setLineItems(initial.lineItems)
    }
  }, [initial?.lineItems])

  // Fetch contacts and locations when customer changes
  useEffect(() => {
    if (!customerId) {
      setContacts([])
      setLocations([])
      return
    }
    let cancelled = false
    ;(async () => {
      const [c, l] = await Promise.all([
        getCustomerContacts(customerId),
        getCustomerLocations(customerId),
      ])
      if (!cancelled) {
        setContacts(c)
        setLocations(l)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerId])

  const handleCustomerChange = useCallback((id: string | null) => {
    if (id) {
      setCustomerId(id)
      setContactId(undefined)
      setLocationId(undefined)
    } else {
      setCustomerId(undefined)
      setContacts([])
      setLocations([])
      setContactId(undefined)
      setLocationId(undefined)
    }
  }, [])

  const defaultTags = referenceData.availableTags.filter((t) =>
    initial?.tagIds?.includes(t.id),
  )

  const title = mode === 'create' ? 'New Job' : `Edit Job`
  const cta = mode === 'create' ? 'Create Job' : 'Save Job'

  // Build hierarchical categories for select
  const topCategories = referenceData.jobCategories.filter((c) => !c.parentId)
  const childCategories = referenceData.jobCategories.filter((c) => c.parentId)

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in-0 duration-300">
      <form action={formAction} className="space-y-6">
        {mode === 'edit' && initial?.id && (
          <input type="hidden" name="id" value={initial.id} />
        )}
        <input type="hidden" name="customerId" value={customerId ?? ''} />
        <input
          type="hidden"
          name="lineItems"
          value={JSON.stringify(lineItems)}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          {/* ── LEFT PANEL: Details ── */}
          <div className="space-y-5 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Details</h2>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <CustomerSearch
                name="customerIdDisplay"
                defaultValue={customerId}
                defaultLabel={customerName}
                onChange={handleCustomerChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactId">Contact</Label>
              <select
                id="contactId"
                name="contactId"
                value={contactId ?? ''}
                onChange={(e) => setContactId(e.target.value || undefined)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Select contact…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceLocationId">Service Location</Label>
              <select
                id="serviceLocationId"
                name="serviceLocationId"
                value={locationId ?? ''}
                onChange={(e) => setLocationId(e.target.value || undefined)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Select location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.addressLine1 && ` — ${l.addressLine1}`}
                    {l.city && `, ${l.city}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Job Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={initial?.categoryId ?? ''}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Select category…</option>
                {topCategories.map((parent) => (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={parent.id}>{parent.name}</option>
                    {childCategories
                      .filter((c) => c.parentId === parent.id)
                      .map((child) => (
                        <option key={child.id} value={child.id}>
                          &nbsp;&nbsp;{child.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
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
              <select
                id="jobSourceId"
                name="jobSourceId"
                defaultValue={initial?.jobSourceId ?? ''}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Select source…</option>
                {referenceData.jobSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedAgentId">Agent / Rep</Label>
              <Input
                id="assignedAgentId"
                name="assignedAgentId"
                defaultValue={initial?.assignedAgentId ?? ''}
                placeholder="Assigned agent or rep"
              />
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
                <Badge variant="outline">Unscheduled</Badge>
              ) : initial?.id ? (
                <StatusDropdown
                  jobId={initial.id}
                  currentStatus={initial.status ?? 'unscheduled'}
                />
              ) : (
                <Badge variant="outline">Unscheduled</Badge>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={initial?.startDate ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={initial?.endDate ?? ''}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="arrivalWindowStart">Arrival Window Start</Label>
                <Input
                  id="arrivalWindowStart"
                  name="arrivalWindowStart"
                  type="datetime-local"
                  defaultValue={initial?.arrivalWindowStart ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrivalWindowEnd">Arrival Window End</Label>
                <Input
                  id="arrivalWindowEnd"
                  name="arrivalWindowEnd"
                  type="datetime-local"
                  defaultValue={initial?.arrivalWindowEnd ?? ''}
                />
              </div>
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
              <select
                id="priority"
                name="priority"
                defaultValue={initial?.priority ?? ''}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Select priority…</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigneeUserIds">Assigned Techs</Label>
              <select
                id="assigneeUserIds"
                name="assigneeUserIds"
                multiple
                defaultValue={initial?.assigneeUserIds ?? []}
                className="h-24 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {referenceData.orgMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Hold Ctrl/Cmd to select multiple
              </p>
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
              <select
                id="billingType"
                name="billingType"
                defaultValue={initial?.billingType ?? 'single_invoice'}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="single_invoice">Single Invoice</option>
                <option value="progress_billing">Progress Billing</option>
                <option value="no_charge">No Charge</option>
              </select>
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
                  <select
                    id="repeatFrequency"
                    name="repeatFrequency"
                    defaultValue={initial?.repeatFrequency ?? ''}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    <option value="">Select frequency…</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
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
          </div>
        </div>

        {/* ── LINE ITEMS (full-width below grid) ── */}
        <LineItems
          jobId={mode === 'edit' ? initial?.id : undefined}
          items={lineItems}
          onChange={setLineItems}
          referenceData={referenceData}
        />

        {/* ── FORM FOOTER ── */}
        <div className="flex items-center gap-3 pt-2">
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : cta}
          </Button>
        </div>
      </form>
    </div>
  )
}
