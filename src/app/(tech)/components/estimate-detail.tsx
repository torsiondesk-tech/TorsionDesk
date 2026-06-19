'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { useTechEstimate, usePendingEstimateConversion } from '@/app/(tech)/lib/use-tech-data'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'
import { convertEstimateToJobAction } from '@/app/(tech)/tech/estimates/actions'
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

  async function handleConvert() {
    if (online) {
      const result = await convertEstimateToJobAction(estimateId)
      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success('Estimate converted to job')
        router.push('/tech/jobs')
      }
    } else {
      await enqueueOutboxItem(orgId, {
        type: 'estimate_conversion',
        payload: { estimateId },
      })
      toast.info('Queued conversion — will sync when online')
    }
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
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Link
        href="/tech/estimates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Estimate</p>
            <h1 className="text-lg font-semibold truncate">
              {estimate.customerName || 'Unknown customer'}
            </h1>
            <Badge variant="secondary" className="mt-1">{estimate.status}</Badge>
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
        </CardContent>
      </Card>

      <Button
        onClick={handleConvert}
        disabled={pending > 0}
        className="w-full"
      >
        {pending > 0 ? 'Conversion queued…' : 'Convert to Job'}
      </Button>
    </div>
  )
}