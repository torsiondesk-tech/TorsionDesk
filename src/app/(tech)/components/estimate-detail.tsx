'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardList, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TimeWindowPicker } from '@/components/ui/time-window-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { useTechEstimate, usePendingEstimateConversion } from '@/app/(tech)/lib/use-tech-data'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'
import { convertEstimateToJobAction } from '@/app/(tech)/tech/estimates/actions'
import { estimateStatusBadgeVariant, estimateStatusLabel } from '@/lib/estimates/status'
import { toast } from 'sonner'

interface EstimateDetailProps {
  orgId: string
  userId: string
  estimateId: string
}

function formatMoney(cents: number | null): string {
  if (cents === null || isNaN(cents)) return '—'
  return '$' + (cents / 100).toFixed(2)
}

export function EstimateDetail({ orgId, userId, estimateId }: EstimateDetailProps) {
  const estimate = useTechEstimate(orgId, estimateId)
  const pending = usePendingEstimateConversion(orgId, estimateId)
  const online = useOnline()
  const router = useRouter()

  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [converting, setConverting] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(estimate?.onSiteDate ?? '')
  const [scheduledTimeStart, setScheduledTimeStart] = useState(estimate?.arrivalWindowStart ?? '')
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState(estimate?.arrivalWindowEnd ?? '')
  const [conversionNote, setConversionNote] = useState('')

  async function confirmConvert() {
    const input = {
      scheduledDate: scheduledDate || null,
      scheduledTimeStart: scheduledTimeStart || null,
      scheduledTimeEnd: scheduledTimeEnd || null,
      note: conversionNote || null,
    }

    setConverting(true)
    try {
      if (online) {
        const result = await convertEstimateToJobAction(estimateId, input)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        toast.success('Estimate converted to job')
        router.push('/tech/jobs')
      } else {
        await enqueueOutboxItem(orgId, {
          type: 'estimate_conversion',
          payload: { estimateId, ...input },
        })
        toast.info('Queued conversion — will sync when online')
        setConvertDialogOpen(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not convert estimate.')
    } finally {
      setConverting(false)
      if (online) setConvertDialogOpen(false)
    }
  }

  function openConvertDialog() {
    setScheduledDate(estimate?.onSiteDate ?? '')
    setScheduledTimeStart(estimate?.arrivalWindowStart ?? '')
    setScheduledTimeEnd(estimate?.arrivalWindowEnd ?? '')
    setConversionNote('')
    setConvertDialogOpen(true)
  }

  if (estimate === undefined) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Loading estimate…
      </div>
    )
  }

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <ClipboardList className="size-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Estimate not found</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Pull down to refresh or create a new estimate.
        </p>
        <Button
          className="mt-6"
          onClick={() => router.push('/tech/estimates')}
        >
          Back to estimates
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <Link
          href="/tech/estimates"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
        <Link href={`/tech/estimates/${estimateId}/edit`}>
          <Button variant="outline" size="sm" type="button">
            <Pencil className="size-3.5 mr-1" aria-hidden="true" />
            Edit
          </Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">EST-{estimate.estimateNo}</p>
            <h1 className="text-lg font-semibold truncate">
              {estimate.customerName || 'Unknown customer'}
            </h1>
            <Badge variant={estimateStatusBadgeVariant(estimate.status)} className="mt-1">
              {estimateStatusLabel(estimate.status)}
            </Badge>
          </div>
          {pending > 0 && (
            <Badge variant="default">Conversion pending</Badge>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Description:</span>{' '}
            {estimate.description || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Value:</span> {formatMoney(estimate.value)}
          </p>
          {estimate.opportunityRating != null && (
            <p>
              <span className="text-muted-foreground">Rating:</span>{' '}
              {'★'.repeat(estimate.opportunityRating)}{'☆'.repeat(5 - estimate.opportunityRating)}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Follow-up:</span>{' '}
            {estimate.followUpDate || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Expires:</span>{' '}
            {estimate.expiryDate || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Notes:</span> {estimate.notes || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Created:</span>{' '}
            {estimate.createdAt ? new Date(estimate.createdAt).toLocaleDateString() : '—'}
          </p>
        </CardContent>
      </Card>

      <Button
        onClick={openConvertDialog}
        disabled={pending > 0}
        className="w-full"
      >
        {pending > 0 ? 'Conversion queued…' : 'Convert to Job'}
      </Button>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Job</DialogTitle>
            <DialogDescription>
              Schedule the appointment before converting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tech-convert-date">Scheduled Date</Label>
              <Input
                id="tech-convert-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank to leave the job unscheduled.</p>
            </div>

            {scheduledDate && (
              <div className="space-y-1.5">
                <Label>Arrival Window</Label>
                <TimeWindowPicker
                  startValue={scheduledTimeStart}
                  endValue={scheduledTimeEnd}
                  onStartChange={setScheduledTimeStart}
                  onEndChange={setScheduledTimeEnd}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="tech-convert-note">Note for Techs</Label>
              <Textarea
                id="tech-convert-note"
                placeholder="Add a note about this appointment..."
                value={conversionNote}
                onChange={(e) => setConversionNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)} disabled={converting}>
              Cancel
            </Button>
            <Button onClick={confirmConvert} disabled={converting}>
              {converting && <Loader2 className="mr-1 size-4 animate-spin" />}
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}