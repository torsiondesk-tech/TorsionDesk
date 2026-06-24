'use client'

import { useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useTechContext } from '@/app/(tech)/components/sync-provider'
import { useTechEstimate } from '@/app/(tech)/lib/use-tech-data'
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

export default function TechEstimateEditPage() {
  const { orgId } = useTechContext()
  const params = useParams()
  const estimateId = params.id as string
  const router = useRouter()

  const estimate = useTechEstimate(orgId, estimateId)
  const db = useMemo(() => createTechDb(orgId), [orgId])

  const [status, setStatus] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [followUpDate, setFollowUpDate] = useState<string | null>(null)
  const [expiryDate, setExpiryDate] = useState<string | null>(null)
  const [opportunityRating, setOpportunityRating] = useState<number | null | undefined>(undefined)
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

  const currentStatus = status ?? estimate.status
  const currentDescription = description ?? estimate.description ?? ''
  const currentNotes = notes ?? estimate.notes ?? ''
  const currentFollowUpDate = followUpDate ?? estimate.followUpDate ?? ''
  const currentExpiryDate = expiryDate ?? estimate.expiryDate ?? ''
  const currentRating = opportunityRating === undefined ? estimate.opportunityRating : opportunityRating

  async function handleSave() {
    if (!estimate) return

    const nextStatus = status ?? estimate.status
    const nextDescription = description ?? estimate.description ?? null
    const nextNotes = notes ?? estimate.notes ?? null
    const nextFollowUpDate = followUpDate ?? estimate.followUpDate ?? null
    const nextExpiryDate = expiryDate ?? estimate.expiryDate ?? null
    const nextRating = opportunityRating === undefined ? estimate.opportunityRating : opportunityRating

    const unchanged =
      nextStatus === estimate.status &&
      nextDescription === (estimate.description ?? null) &&
      nextNotes === (estimate.notes ?? null) &&
      nextFollowUpDate === (estimate.followUpDate ?? null) &&
      nextExpiryDate === (estimate.expiryDate ?? null) &&
      nextRating === estimate.opportunityRating

    if (unchanged) {
      router.back()
      return
    }

    setSaving(true)
    try {
      const result = await updateTechEstimateMetaAction(estimateId, {
        status: nextStatus,
        description: nextDescription || null,
        notes: nextNotes || null,
        followUpDate: nextFollowUpDate || null,
        expiryDate: nextExpiryDate || null,
        opportunityRating: nextRating,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      // Update Dexie cache so the detail page reflects changes immediately
      await db.open()
      await db.estimates.update(estimateId, {
        status: nextStatus,
        description: nextDescription || null,
        notes: nextNotes || null,
        followUpDate: nextFollowUpDate || null,
        expiryDate: nextExpiryDate || null,
        opportunityRating: nextRating,
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

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={currentStatus} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue>
              <Badge variant={estimateStatusBadgeVariant(currentStatus)}>
                {estimateStatusLabel(currentStatus)}
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

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={currentDescription}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the work or scope"
          className="text-base"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Opportunity rating</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() =>
                setOpportunityRating(currentRating === star ? null : star)
              }
              className="p-1"
            >
              <Star
                className={cn(
                  'size-6',
                  currentRating && star <= currentRating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground',
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="followUp">Follow-up date</Label>
          <Input
            id="followUp"
            type="date"
            value={currentFollowUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiry">Expiry date</Label>
          <Input
            id="expiry"
            type="date"
            value={currentExpiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="text-base"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={currentNotes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Shown on the estimate"
          className="text-base"
          rows={3}
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  )
}
