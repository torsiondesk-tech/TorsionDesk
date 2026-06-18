'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { statusBadgeVariant, statusLabel } from '@/lib/jobs/transitions'
import type { JobRow } from '@/lib/jobs/jobs'

interface JobListCardProps {
  job: JobRow
}

function arrivalWindow(job: JobRow): string {
  if (job.arrivalWindowStart && job.arrivalWindowEnd) {
    return `${job.arrivalWindowStart} – ${job.arrivalWindowEnd}`
  }
  if (job.arrivalWindowStart) {
    return job.arrivalWindowStart
  }
  return 'All day'
}

export function JobListCard({ job }: JobListCardProps) {
  return (
    <Link href={`/tech/jobs/${job.id}`} className="block">
      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">{job.customerName}</p>
              <p className="text-sm text-muted-foreground truncate">
                {job.city || 'No service address'}
              </p>
              <p className="text-sm text-muted-foreground">{arrivalWindow(job)}</p>
            </div>
            <Badge variant={statusBadgeVariant(job.status)}>{statusLabel(job.status)}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
