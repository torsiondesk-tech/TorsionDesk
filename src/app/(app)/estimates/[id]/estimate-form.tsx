'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CustomerSearch } from '@/components/customer-search'
import { TagSelect, type TagOption } from '@/components/tag-select'
import { TechSelect } from '@/components/tech-select'
import {
  GroupedLineItems,
  type LineItemGroup,
  type LineItemRow,
} from '@/components/line-items/grouped-line-items'
import { StarPicker } from '@/components/line-items/star-picker'
import {
  createOfficeEstimateAction,
  updateEstimateAction,
  convertEstimateToJobAction,
  sendEstimateAction,
  applyEstimateTemplateAction,
  getCustomerContacts,
  getCustomerLocations,
} from '../actions'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import { computeEstimateTotals } from '@/lib/estimates/totals'
import { toISODate } from '@/lib/utils'
import { toast } from 'sonner'
import { FileDown, Mail, Send, Plus, Loader2 } from 'lucide-react'
import type { EstimateTemplate } from '@/lib/estimates/templates'
import type { getEstimateAction } from '../actions'

interface ReferenceData {
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  jobSources: Array<{ id: string; name: string }>
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  availableTags: TagOption[]
  productCategories: Array<{ id: string; name: string }>
  orgMembers: Array<{ id: string; label: string }>
}

interface EstimateFormProps {
  mode: 'create' | 'edit'
  orgId: string
  userId: string
  estimateId?: string
  initial?: Awaited<ReturnType<typeof getEstimateAction>> & { customerName?: string | null }
  referenceData: ReferenceData
  estimateTemplates: EstimateTemplate[]
  role?: string | null
}

const ESTIMATE_STATUSES = [
  'estimate_requested',
  'estimate_provided',
  'estimate_accepted',
  'estimate_won',
  'estimate_lost',
]

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  if (typeof d === 'string') return d.slice(0, 10)
  const isUtcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  return isUtcMidnight ? d.toISOString().slice(0, 10) : toISODate(d)
}

function toTimeInputValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function formatMoney(n: number): string {
  return `$${(n / 100).toFixed(2)}`
}

export function EstimateForm({
  mode,
  orgId,
  estimateId,
  initial,
  referenceData,
  estimateTemplates,
  role,
}: EstimateFormProps) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [converting, setConverting] = React.useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = React.useState(false)

  // ── Core form state ──
  const [customerId, setCustomerId] = React.useState<string | null>(initial?.estimate.customerId ?? null)
  const [customerName, setCustomerName] = React.useState<string>(initial?.customerName ?? '')
  const [contactId, setContactId] = React.useState<string | null>(initial?.estimate.contactId ?? null)
  const [serviceLocationId, setServiceLocationId] = React.useState<string | null>(initial?.estimate.serviceLocationId ?? null)
  const [categoryId, setCategoryId] = React.useState<string | null>(initial?.estimate.categoryId ?? null)
  const [description, setDescription] = React.useState(initial?.estimate.description ?? '')
  const [poNumber, setPoNumber] = React.useState(initial?.estimate.poNumber ?? '')
  const [opportunityRating, setOpportunityRating] = React.useState<number | null>(initial?.estimate.opportunityRating ?? null)
  const [status, setStatus] = React.useState(initial?.estimate.status ?? 'estimate_requested')
  const [referralSourceId, setReferralSourceId] = React.useState<string | null>(initial?.estimate.referralSourceId ?? null)
  const [expiryDate, setExpiryDate] = React.useState(toDateInputValue(initial?.estimate.expiryDate))
  const [followUpDate, setFollowUpDate] = React.useState(toDateInputValue(initial?.estimate.followUpDate))
  const [onSiteDate, setOnSiteDate] = React.useState(toDateInputValue(initial?.estimate.onSiteDate))
  const [arrivalWindowStart, setArrivalWindowStart] = React.useState(toTimeInputValue(initial?.estimate.arrivalWindowStart))
  const [arrivalWindowEnd, setArrivalWindowEnd] = React.useState(toTimeInputValue(initial?.estimate.arrivalWindowEnd))
  const [notesForTechs, setNotesForTechs] = React.useState(initial?.estimate.notesForTechs ?? '')
  const [notes, setNotes] = React.useState(initial?.estimate.notes ?? '')
  const [internalNotes, setInternalNotes] = React.useState(initial?.estimate.internalNotes ?? '')
  const [assignedAgentId, setAssignedAgentId] = React.useState<string | null>(initial?.estimate.assignedAgentId ?? null)
  const [tagIds, setTagIds] = React.useState<string[]>(initial?.tagIds ?? [])
  const [assigneeUserIds, setAssigneeUserIds] = React.useState<string[]>(initial?.assigneeUserIds ?? [])

  // ── Dependent selects ──
  const [contacts, setContacts] = React.useState<Array<{ id: string; firstName: string; lastName: string | null }>>([])
  const [locations, setLocations] = React.useState<
    Array<{
      id: string
      name: string | null
      addressLine1: string | null
      city: string | null
      state: string | null
      postalCode: string | null
    }>
  >([])
  const [contactsLoading, setContactsLoading] = React.useState(false)
  const [locationsLoading, setLocationsLoading] = React.useState(false)

  React.useEffect(() => {
    if (!customerId) {
      setContacts([])
      setLocations([])
      setContactsLoading(false)
      setLocationsLoading(false)
      return
    }
    setContactsLoading(true)
    setLocationsLoading(true)
    getCustomerContacts(customerId).then((res) => {
      setContacts(res.contacts)
      setContactsLoading(false)
    })
    getCustomerLocations(customerId).then((res) => {
      setLocations(res.locations)
      setLocationsLoading(false)
    })
  }, [customerId])

  // ── Line items & groups ──
  const initialGroups: LineItemGroup[] =
    initial?.groups.map((g) => ({ id: g.id, name: g.name, sortOrder: g.sortOrder ?? 0 })) ?? []
  const initialItems: LineItemRow[] =
    initial?.lineItems.map((li) => ({
      id: li.id,
      type: (li.type ?? 'service') as LineItemRow['type'],
      refId: li.refId,
      title: li.title ?? null,
      description: li.description ?? '',
      qty: String(li.qty ?? '1'),
      rate: String(li.rate ?? '0'),
      cost: String(li.cost ?? '0'),
      taxItemId: li.taxItemId,
      groupId: li.groupId ?? null,
    })) ?? []

  const [groups, setGroups] = React.useState<LineItemGroup[]>(initialGroups)
  const [lineItems, setLineItems] = React.useState<LineItemRow[]>(initialItems)

  // ── Template application ──
  const [selectedTemplateId, setSelectedTemplateId] = React.useState('')
  const [applyingTemplate, setApplyingTemplate] = React.useState(false)

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return
    setApplyingTemplate(true)
    try {
      const result = await applyEstimateTemplateAction(orgId, selectedTemplateId)
      if (result.groups.length > 0) {
        const groupIdMap = new Map<string, string>()
        const nextGroups: LineItemGroup[] = result.groups.map((g) => {
          const newId = crypto.randomUUID()
          groupIdMap.set(g.id, newId)
          return { id: newId, name: g.name, sortOrder: g.sortOrder }
        })
        setGroups(nextGroups)
        setLineItems(
          result.lineItems.map((li) => ({
            id: crypto.randomUUID(),
            type: li.type,
            refId: li.refId,
            title: li.title,
            description: li.description,
            qty: li.qty,
            rate: li.rate,
            cost: li.cost,
            taxItemId: li.taxItemId,
            groupId: li.groupId ? groupIdMap.get(li.groupId) ?? null : null,
          })),
        )
      } else {
        setGroups([])
        setLineItems(
          result.lineItems.map((li) => ({
            id: crypto.randomUUID(),
            type: li.type,
            refId: li.refId,
            title: li.title,
            description: li.description,
            qty: li.qty,
            rate: li.rate,
            cost: li.cost,
            taxItemId: li.taxItemId,
            groupId: null,
          })),
        )
      }
      toast.success('Template applied')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not apply template')
    } finally {
      setApplyingTemplate(false)
    }
  }

  // ── Totals ──
  const totals = React.useMemo(
    () =>
      computeEstimateTotals(
        lineItems.map((li) => ({
          type: li.type,
          qty: li.qty,
          rate: li.rate,
          cost: li.cost,
          taxRate: null,
          groupId: li.groupId ?? null,
        })),
        groups,
      ),
    [lineItems, groups],
  )

  // ── Save ──
  const buildPayload = () => ({
    customerId: customerId ?? '',
    contactId,
    serviceLocationId,
    categoryId,
    description,
    poNumber,
    opportunityRating,
    referralSourceId,
    expiryDate,
    followUpDate,
    onSiteDate,
    arrivalWindowStart,
    arrivalWindowEnd,
    notesForTechs,
    notes,
    internalNotes,
    assignedAgentId,
    tagIds,
    assigneeUserIds,
    lineItems: JSON.stringify(lineItems),
    groups: JSON.stringify(groups),
  })

  const handleSave = async () => {
    if (!customerId) {
      toast.error('Customer is required.')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (mode === 'create') {
        const result = await createOfficeEstimateAction(orgId, payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Estimate created')
        router.push(`/estimates/${result.id}`)
      } else {
        if (!estimateId) return
        const result = await updateEstimateAction(orgId, estimateId, payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Estimate saved')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Convert to job ──
  const handleConvert = async () => {
    if (!estimateId) return
    setConverting(true)
    try {
      const result = await convertEstimateToJobAction(orgId, estimateId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Converted to job')
      router.push(`/jobs/${result.jobId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not convert estimate.')
    } finally {
      setConverting(false)
      setConvertDialogOpen(false)
    }
  }

  // ── Email stub ──
  const handleEmail = async () => {
    if (!estimateId) {
      toast('Email sending arrives in a later release. The estimate PDF is ready to download.')
      return
    }
    try {
      await sendEstimateAction(orgId, estimateId)
      toast('Email sending arrives in a later release. The estimate PDF is ready to download.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send estimate.')
    }
  }

  const isLost = status === 'estimate_lost'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {mode === 'create' ? 'New Estimate' : `Estimate #EST-${initial?.estimate.estimateNo ?? ''}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customerName || 'Select a customer to begin'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'edit' && estimateId && (
            <>
              <Link href={`/api/estimates/${estimateId}/pdf`} target="_blank" passHref>
                <Button variant="outline" size="sm" type="button">
                  <FileDown className="mr-1 size-4" />
                  Download PDF
                </Button>
              </Link>
              <Button variant="outline" size="sm" type="button" onClick={handleEmail}>
                <Mail className="mr-1 size-4" />
                Email Estimate
              </Button>
              <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
                <DialogTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="outline"
                      size="sm"
                      disabled={isLost}
                      type="button"
                    >
                      <Send className="mr-1 size-4" />
                      Convert to Job
                    </Button>
                  )}
                />
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Convert to Job?</DialogTitle>
                    <DialogDescription>
                      This creates a new job from this estimate, copies the line items and groups, and marks the estimate as Won.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleConvert} disabled={converting}>
                      {converting && <Loader2 className="mr-1 size-4 animate-spin" />}
                      Convert
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
            Save Estimate
          </Button>
        </div>
      </div>

      {/* Template selector (edit only, or create too) */}
      {estimateTemplates.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border p-3">
          <Select value={selectedTemplateId} onValueChange={(v) => setSelectedTemplateId(v ?? '')}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Apply a template…">
                {selectedTemplateId
                  ? estimateTemplates.find((t) => t.id === selectedTemplateId)?.name ?? selectedTemplateId
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {estimateTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleApplyTemplate}
            disabled={!selectedTemplateId || applyingTemplate}
          >
            {applyingTemplate ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      )}

      {/* Two-panel form */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Project Specs */}
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Project Specs</h2>

          <div className="space-y-2">
            <Label>Customer *</Label>
            <CustomerSearch
              defaultValue={customerId ?? undefined}
              defaultLabel={customerName ?? undefined}
              onChange={(id) => {
                setCustomerId(id)
                setContactId(null)
                setServiceLocationId(null)
                setCustomerName('')
              }}
              onReplaceIntent={(char) => {
                setCustomerName(char)
                setCustomerId(null)
              }}
            />
            <input type="hidden" name="customerId" value={customerId ?? ''} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select
                value={contactId ?? ''}
                onValueChange={(v) => setContactId(v || null)}
                disabled={!customerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact">
                    {contactId
                      ? (() => {
                          const c = contacts.find((x) => x.id === contactId)
                          if (c) return `${c.firstName} ${c.lastName ?? ''}`.trim()
                          if (contactsLoading) return 'Loading…'
                          return contactId
                        })()
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No contact</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service Location</Label>
              <Select
                value={serviceLocationId ?? ''}
                onValueChange={(v) => setServiceLocationId(v || null)}
                disabled={!customerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location">
                    {serviceLocationId
                      ? (() => {
                          const l = locations.find((x) => x.id === serviceLocationId)
                          if (l) return l.name || [l.addressLine1, l.city, l.state].filter(Boolean).join(', ')
                          if (locationsLoading) return 'Loading…'
                          return serviceLocationId
                        })()
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No location</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name || [l.addressLine1, l.city, l.state].filter(Boolean).join(', ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId ?? ''} onValueChange={(v) => setCategoryId(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category">
                    {categoryId
                      ? referenceData.jobCategories.find((c) => c.id === categoryId)?.name ?? categoryId
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No category</SelectItem>
                  {referenceData.jobCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>PO Number</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO #" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
            onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work or scope"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>On-site Visit Date</Label>
              <Input type="date" value={onSiteDate} onChange={(e) => setOnSiteDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Arrival Window</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={arrivalWindowStart}
                  onChange={(e) => setArrivalWindowStart(e.target.value)}
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="time"
                  value={arrivalWindowEnd}
                  onChange={(e) => setArrivalWindowEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assigned Techs</Label>
            <TechSelect
              members={referenceData.orgMembers}
              defaultSelected={assigneeUserIds}
              onChange={setAssigneeUserIds}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagSelect
              availableTags={referenceData.availableTags}
              defaultSelected={referenceData.availableTags.filter((t) => tagIds.includes(t.id))}
              onChange={(selected) => setTagIds(selected.map((t) => t.id))}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes for Techs</Label>
            <Textarea
              value={notesForTechs}
              onChange={(e) => setNotesForTechs(e.target.value)}
              placeholder="Visible to technicians in the field"
              rows={3}
            />
          </div>
        </div>

        {/* Sales Data */}
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Sales Data</h2>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger>
                <SelectValue>{estimateStatusLabel(status)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ESTIMATE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center gap-2">
                      <Badge variant={estimateStatusBadgeVariant(s)}>{estimateStatusLabel(s)}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Opportunity Rating</Label>
            <StarPicker value={opportunityRating} onChange={setOpportunityRating} />
          </div>

          <div className="space-y-2">
            <Label>Referral Source</Label>
            <Select
              value={referralSourceId ?? ''}
              onValueChange={(v) => setReferralSourceId(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source">
                  {referralSourceId
                    ? referenceData.jobSources.find((s) => s.id === referralSourceId)?.name ?? referralSourceId
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No source</SelectItem>
                {referenceData.jobSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Follow-up Date</Label>
              <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sales Rep</Label>
            <Select
              value={assignedAgentId ?? ''}
              onValueChange={(v) => setAssignedAgentId(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select rep">
                  {assignedAgentId
                    ? referenceData.orgMembers.find((m) => m.id === assignedAgentId)?.label ?? assignedAgentId
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {referenceData.orgMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Not shown on the customer-facing PDF"
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-xl font-semibold">Line Items</h2>
        <GroupedLineItems
          groups={groups}
          lineItems={lineItems}
          onChange={(nextGroups, nextItems) => {
            setGroups(nextGroups)
            setLineItems(nextItems)
          }}
          referenceData={{
            taxItems: referenceData.taxItems,
            productCategories: referenceData.productCategories,
          }}
          role={role}
          jobId={estimateId}
        />

        {/* Totals */}
        <div className="rounded-lg border p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Products</p>
              <p className="font-medium">{formatMoney(parseFloat(totals.products) * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Services</p>
              <p className="font-medium">{formatMoney(parseFloat(totals.services) * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Discount</p>
              <p className="font-medium">{formatMoney(parseFloat(totals.discount) * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taxes</p>
              <p className="font-medium">{formatMoney(parseFloat(totals.taxes) * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold">{formatMoney(parseFloat(totals.estimateTotal) * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cost</p>
              <p className="font-medium">{formatMoney(parseFloat(totals.estimateCost) * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gross Profit</p>
              <p className="font-medium">{formatMoney(parseFloat(totals.grossProfit) * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gross Profit %</p>
              <p className="font-medium">{totals.grossProfitPct ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
