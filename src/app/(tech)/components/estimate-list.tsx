'use client'

import { useRouter } from 'next/navigation'
import { ClipboardList, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTechEstimates } from '@/app/(tech)/lib/use-tech-data'
import { EstimateCard } from './estimate-card'

interface EstimateListProps {
  orgId: string
  userId: string
}

export function EstimateList({ orgId }: EstimateListProps) {
  const router = useRouter()
  const estimates = useTechEstimates(orgId)

  if (estimates === undefined) {
    return (
      <div className="h-full overflow-y-auto overscroll-y-contain">
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (estimates.length === 0) {
    return (
      <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col items-center justify-center px-6 py-12 text-center">
        <ClipboardList className="size-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">No estimates</h1>
        <p className="mt-2 max-w-sm text-base text-muted-foreground">
          Create an estimate from a completed job, or pull down to refresh.
        </p>
        <Button
          className="mt-6 w-full max-w-xs"
          onClick={() => router.push('/tech/estimates/new')}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          New Estimate
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain">
      <div className="flex flex-col gap-3 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {estimates.map((estimate) => (
          <EstimateCard key={estimate.id} estimate={estimate} />
        ))}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push('/tech/estimates/new')}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          New Estimate
        </Button>
      </div>
    </div>
  )
}