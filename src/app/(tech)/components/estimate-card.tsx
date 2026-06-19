'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CachedEstimate } from '@/app/(tech)/lib/dexie'

interface EstimateCardProps {
  estimate: CachedEstimate
}

function formatMoney(cents: number | null): string {
  if (cents === null || isNaN(cents)) return '—'
  return '$' + (cents / 100).toFixed(2)
}

export function EstimateCard({ estimate }: EstimateCardProps) {
  return (
    <Link href={`/tech/estimates/${estimate.id}`} className="block touch-pan-y transition-transform duration-75 active:scale-[0.98]">
      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold truncate">
                {estimate.customerName || 'Unknown customer'}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {estimate.description || 'No description'}
              </p>
              <p className="text-sm text-muted-foreground">{formatMoney(estimate.value)}</p>
            </div>
            <Badge variant="secondary">{estimate.status}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}