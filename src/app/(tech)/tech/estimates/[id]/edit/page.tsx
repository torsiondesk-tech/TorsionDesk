'use client'

import { useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { TimeWindowPicker } from '@/components/ui/time-window-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useTechContext } from '@/app/(tech)/components/sync-provider'
import { useTechEstimate, useTechReferenceData, useTechLocations } from '@/app/(tech)/lib/use-tech-data'
import { createTechDb } from '@/app/(tech)/lib/dexie'
import { updateTechEstimateMetaAction } from '@/app/(tech)/tech/estimates/actions'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const ESTIMATE_STATUSES = [
  'estimate_requested',
  'estimate_provided',
  'estimate_accepted',
  'estimate_won',
  'estimate_lost',
] as const

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold tracking-tight border-b pb-2 mt-2">
      {children}
    </h2>
  )
}

export default function TechEstimateEditPage() {
  const { orgId } = useTechContext()
  const params = useParams()
  const estimateId = params.id as string
  const router = useRouter()

  const estimate = useTechEstimate(orgId, estimateId)
  const referenceData = useTechReferenceData(orgId)
  const liveLocations = useTechLocations(orgId, estimate?.customerId ?? '')
  const db = useMemo(() => createTechDb(orgId), [orgId])

  // All fields start undefined = use cached value; tech sets them to change
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [description, setDescription] = useState<string | undefined>(undefined)
  const [notesForTechs, setNotesForTechs] = useState<string | undefined>(undefined)
  const [notes, setNotes] = useState<string | undefined>(undefined)
  const [internalNotes, setInternalNotes] = useState<string | undefined>(undefined)
  const [categoryId, setCategoryId] = useState<string | null | undefined>(undefined)
  const [serviceLocationId, setServiceLocationId] = useState<string | null | undefined>(undefined)
  const [contactId, setContactId] = useState<string | null | undefined>(undefined)
  const [poNumber, setPoNumber] = useState<string | undefined>(undefined)
  const [referralSourceId, setReferralSourceId] = useState<string | null | undefined>(undefined)
  const [assignedAgentId, setAssignedAgentId] = useState<string | null | undefined>(undefined)
  const [opportunityRating, setOpportunityRating] = useState<number | null | undefined>(undefined)
  const [followUpDate, setFollowUpDate] = useState<string | undefined>(undefined)
  const [expiryDate, setExpiryDate] = useState<string | undefined>(undefined)
  const [onSiteDate, setOnSiteDate] = useState<string | undefined>(undefined)
  const [arrivalWindowStart, setArrivalWindowStart] = useState<string | undefined>(undefined)
  const [arrivalWindowEnd, setArrivalWindowEnd] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  if (estimate === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!estimate) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">Estimate not found.</p>
        <Button variant="outline" onClick={() => router.push('/tech/estimates')}>
          Back to estimates
        </Button>
      </div>
    )
  }

  // Resolve current values: local state takes priority, fall back to cached
  const cur = {
    status: status ?? estimate.status,
    description: description ?? estimate.description ?? '',
    notesForTechs: notesForTechs ?? estimate.notesForTechs ?? '',
    notes: notes ?? estimate.notes ?? '',
    internalNotes: internalNotes ?? estimate.internalNotes ?? '',
    categoryId: categoryId === undefined ? estimate.categoryId : categoryId,
    serviceLocationId: serviceLocationId === undefined ? estimate.serviceLocationId : serviceLocationId,
    contactId: contactId === undefined ? estimate.contactId : contactId,
    poNumber: poNumber ?? estimate.poNumber ?? '',
    referralSourceId: referralSourceId === undefined ? estimate.referralSourceId : referralSourceId,
    assignedAgentId: assignedAgentId === undefined ? estimate.assignedAgentId : assignedAgentId,
    opportunityRating: opportunityRating === undefined ? estimate.opportunityRating : opportunityRating,
    followUpDate: followUpDate ?? estimate.followUpDate ?? '',
    expiryDate: expiryDate ?? estimate.expiryDate ?? '',
    onSiteDate: onSiteDate ?? estimate.onSiteDate ?? '',
    arrivalWindowStart: arrivalWindowStart ?? estimate.arrivalWindowStart ?? '',
    arrivalWindowEnd: arrivalWindowEnd ?? estimate.arrivalWindowEnd ?? '',
  }

  const categories = referenceData?.jobCategories ?? []
  const referralSources = referenceData?.referralSources ?? []
  const salesReps = referenceData?.salesReps ?? []
  const locations = liveLocations ?? []

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateTechEstimateMetaAction(estimateId, {
        status: cur.status,
        description: cur.description || null,
        notesForTechs: cur.notesForTechs || null,
        notes: cur.notes || null,
        internalNotes: cur.internalNotes || null,
        categoryId: cur.categoryId || null,
        serviceLocationId: cur.serviceLocationId || null,
        contactId: cur.contactId || null,
        poNumber: cur.poNumber || null,
        referralSourceId: cur.referralSourceId || null,
        assignedAgentId: cur.assignedAgentId || null,
        opportunityRating: cur.opportunityRating,
        followUpDate: cur.followUpDate || null,
        expiryDate: cur.expiryDate || null,
        onSiteDate: cur.onSiteDate || null,
        arrivalWindowStart: cur.arrivalWindowStart || null,
        arrivalWindowEnd: cur.arrivalWindowEnd || null,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      // Update Dexie so detail page reflects changes without waiting for sync
      await db.open()
      await db.estimates.update(estimateId, {
        status: cur.status,
        description: cur.description || null,
        notesForTechs: cur.notesForTechs || null,
        notes: cur.notes || null,
        internalNotes: cur.internalNotes || null,
        categoryId: cur.categoryId || null,
        serviceLocationId: cur.serviceLocationId || null,
        contactId: cur.contactId || null,
        poNumber: cur.poNumber || null,
        referralSourceId: cur.referralSourceId || null,
        assignedAgentId: cur.assignedAgentId || null,
        opportunityRating: cur.opportunityRating,
        followUpDate: cur.followUpDate || null,
        expiryDate: cur.expiryDate || null,
        onSiteDate: cur.onSiteDate || null,
        arrivalWindowStart: cur.arrivalWindowStart || null,
        arrivalWindowEnd: cur.arrivalWindowEnd || null,
      })
      toast.success('Estimate updated')
      router.push(`/tech/estimates/${estimateId}`)
    } catch {
      toast.error('Failed to update estimate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-5 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <Link
          href={`/tech/estimates/${estimateId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">EST-{estimate.estimateNo}</p>
        <h1 className="text-lg font-semibold">{estimate.customerName || 'Unknown customer'}</h1>
      </div>

      {/* ── Status ── */}
      <SectionTitle>Status</SectionTitle>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={cur.status} onValueChange={(v) => setStatus(v ?? undefined)}>
          <SelectTrigger>
            <SelectValue>
              <Badge variant={estimateStatusBadgeVariant(cur.status)}>
                {estimateStatusLabel(cur.status)}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ESTIMATE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <Badge variant={estimateStatusBadgeVariant(s)}>
                  {estimateStatusLabel(s)}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Project Details ── */}
      <SectionTitle>Project Details</SectionTitle>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={cur.description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the work or scope"
          className="text-base"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={cur.categoryId ?? ''} onValueChange={(v) => setCategoryId(v || null)}>
            <SelectTrigger className="text-base" id="category">
              <SelectValue placeholder="No category">
                {cur.categoryId ? categories.find((c) => c.id === cur.categoryId)?.name ?? cur.categoryId : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="po">PO Number</Label>
          <Input
            id="po"
            value={cur.poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="PO #"
            className="text-base"
          />
        </div>
      </div>

      {locations.length > 0 && (
        <div className="space-y-2">
          <Label>Service location</Label>
          <Select value={cur.serviceLocationId ?? ''} onValueChange={(v) => setServiceLocationId(v || null)}>
            <SelectTrigger className="text-base">
              <SelectValue placeholder="No location">
                {cur.serviceLocationId
                  ? (() => {
                      const loc = locations.find((l) => l.id === cur.serviceLocationId)
                      return loc ? [loc.name, loc.addressLine1, loc.city].filter(Boolean).join(' — ') : cur.serviceLocationId
                    })()
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No location</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {[loc.name, loc.addressLine1, loc.city].filter(Boolean).join(' — ') || loc.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="onSite">On-site date</Label>
          <Input
            id="onSite"
            type="date"
            value={cur.onSiteDate}
            onChange={(e) => setOnSiteDate(e.target.value)}
            className="text-base"
          />
        </div>
        <div className="space-y-2">
          <Label>Arrival window</Label>
          <TimeWindowPicker
            startValue={cur.arrivalWindowStart}
            endValue={cur.arrivalWindowEnd}
            onStartChange={setArrivalWindowStart}
            onEndChange={setArrivalWindowEnd}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notesForTechs">Notes for techs</Label>
        <Textarea
          id="notesForTechs"
          value={cur.notesForTechs}
          onChange={(e) => setNotesForTechs(e.target.value)}
          placeholder="Visible to technicians in the field"
          className="text-base"
          rows={2}
        />
      </div>

      {/* ── Sales Data ── */}
      <SectionTitle>Sales Data</SectionTitle>

      <div className="space-y-2">
        <Label>Opportunity rating</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setOpportunityRating(cur.opportunityRating === star ? null : star)}
              className="p-1"
            >
              <Star
                className={cn(
                  'size-6',
                  cur.opportunityRating && star <= cur.opportunityRating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground',
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="referralSource">Referral source</Label>
        <Select value={cur.referralSourceId ?? ''} onValueChange={(v) => setReferralSourceId(v || null)}>
          <SelectTrigger className="text-base" id="referralSource">
            <SelectValue placeholder="No source">
              {cur.referralSourceId ? referralSources.find((s) => s.id === cur.referralSourceId)?.name ?? cur.referralSourceId : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No source</SelectItem>
            {referralSources.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="salesRep">Sales rep</Label>
        <Select value={cur.assignedAgentId ?? ''} onValueChange={(v) => setAssignedAgentId(v || null)}>
          <SelectTrigger className="text-base" id="salesRep">
            <SelectValue placeholder="Unassigned">
              {cur.assignedAgentId ? salesReps.find((r) => r.id === cur.assignedAgentId)?.name ?? cur.assignedAgentId : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Unassigned</SelectItem>
            {salesReps.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="followUp">Follow-up date</Label>
          <Input
            id="followUp"
            type="date"
            value={cur.followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiry">Expiry date</Label>
          <Input
            id="expiry"
            type="date"
            value={cur.expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="text-base"
          />
        </div>
      </div>

      {/* ── Notes ── */}
      <SectionTitle>Notes</SectionTitle>

      <div className="space-y-2">
        <Label htmlFor="notes">Customer-facing notes</Label>
        <Textarea
          id="notes"
          value={cur.notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Shown on the estimate"
          className="text-base"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internalNotes">Internal notes</Label>
        <Textarea
          id="internalNotes"
          value={cur.internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="Not shown to the customer"
          className="text-base"
          rows={3}
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
        {saving ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  )
}
