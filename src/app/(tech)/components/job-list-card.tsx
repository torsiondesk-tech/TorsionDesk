'use client'

import Link from 'next/link'
import { Phone, Mail, Clock, MapPin, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { statusBadgeVariant, statusLabel } from '@/lib/jobs/transitions'
import { formatPhone } from '@/lib/utils'
import type { JobRow } from '@/lib/jobs/jobs'

interface JobListCardProps {
  job: JobRow
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

function arrivalWindow(job: JobRow): string {
  if (job.arrivalWindowStart && job.arrivalWindowEnd) {
    return `${formatTime(job.arrivalWindowStart)} – ${formatTime(job.arrivalWindowEnd)}`
  }
  if (job.arrivalWindowStart) {
    return formatTime(job.arrivalWindowStart)
  }
  return 'All day'
}

function buildAddress(job: JobRow): { display: string; mapsUrl: string | null } {
  const parts: string[] = []
  if (job.addressLine1) parts.push(job.addressLine1)
  const cityLine = [job.city, job.state, job.postalCode].filter(Boolean).join(', ')
  if (cityLine) parts.push(cityLine)
  if (parts.length === 0) return { display: 'No service address', mapsUrl: null }
  const display = parts.join('\n')
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`
  return { display, mapsUrl }
}

export function JobListCard({ job }: JobListCardProps) {
  const { display: address, mapsUrl } = buildAddress(job)
  const timeWindow = arrivalWindow(job)

  return (
    <Link
      href={`/tech/jobs/${job.id}`}
      className="block touch-pan-y transition-transform duration-75 active:scale-[0.98]"
    >
      <Card className="p-4">
        <CardContent className="p-0 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold leading-tight">{job.customerName}</p>
              <p className="text-xs text-muted-foreground">Job #{job.jobNo}</p>
            </div>
            <Badge variant={statusBadgeVariant(job.status)} className="shrink-0">
              {statusLabel(job.status)}
            </Badge>
          </div>

          {mapsUrl ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.open(mapsUrl, '_blank')
              }}
              className="flex items-start gap-1.5 text-sm text-blue-600 dark:text-blue-400 whitespace-pre-line leading-snug hover:underline text-left"
            >
              <MapPin className="size-3.5 shrink-0 mt-0.5" />
              {address}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">{address}</p>
          )}

          <div className="flex flex-col gap-1">
            {job.contactPhone && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5 shrink-0" />
                {formatPhone(job.contactPhone)}
              </span>
            )}
            {job.contactEmail && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                <Mail className="size-3.5 shrink-0" />
                {job.contactEmail}
              </span>
            )}
            {job.startDate && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="size-3.5 shrink-0" />
                {job.startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              {timeWindow}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
