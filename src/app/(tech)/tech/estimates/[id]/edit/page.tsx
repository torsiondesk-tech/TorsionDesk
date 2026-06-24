'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { updateTechEstimateStatusAction } from '@/app/(tech)/tech/estimates/actions'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
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
  const [status, setStatus] = useState<string | null>(null)
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

  async function handleSave() {
    if (!estimate) return
    const nextStatus = status ?? estimate.status
    if (nextStatus === estimate.status) {
      router.back()
      return
    }

    setSaving(true)
    try {
      const result = await updateTechEstimateStatusAction(estimateId, nextStatus)
      if (!result.success) {
        toast.error(result.error)
        return
      }
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

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  )
}
