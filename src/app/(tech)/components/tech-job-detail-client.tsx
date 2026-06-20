'use client'

import { useParams } from 'next/navigation'
import { FileText, ClipboardList, Calendar, Clock, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { statusBadgeVariant, statusLabel, type JobStatusValue } from '@/lib/jobs/transitions'
import { StatusBottomSheet } from './status-bottom-sheet'
import { PhotoUploader } from './photo-uploader'
import { TechSignaturePad } from './tech-signature-pad'
import { CompletionNotes } from './completion-notes'
import { EquipmentSection } from './equipment-section'
import { TechLineItems } from './tech-line-items'
import { TechContactCard } from './tech-contact-card'
import { TechLocationCard } from './tech-location-card'
import { JobDescription } from './job-description'
import { useTechJob, useTechLocations, useTechEquipmentByLocation } from '@/app/(tech)/lib/use-tech-data'
import { parseCalendarDate } from '@/lib/utils'

interface TechJobDetailClientProps {
  orgId: string
  userId: string
}

export function TechJobDetailClient({ orgId, userId }: TechJobDetailClientProps) {
  const params = useParams()
  const jobId = params.id as string

  const job = useTechJob(orgId, jobId)
  const customerLocations = useTechLocations(orgId, job?.customerId)
  const equipment = useTechEquipmentByLocation(orgId, job?.serviceLocationId ?? null)

  if (job === undefined || customerLocations === undefined || equipment === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-base text-muted-foreground">Job not found or not synced to this device.</p>
      </div>
    )
  }

  // Build the ServiceLocation shape from the matching cached location
  const rawLocation = customerLocations.find((loc) => loc.id === job.serviceLocationId) ?? null
  const serviceLocation = rawLocation
    ? {
        id: rawLocation.id,
        name: rawLocation.name ?? null,
        addressLine1: rawLocation.addressLine1 ?? null,
        addressLine2: rawLocation.addressLine2 ?? null,
        city: rawLocation.city ?? null,
        state: rawLocation.state ?? null,
        postalCode: rawLocation.postalCode ?? null,
      }
    : null

  const availableLocations = customerLocations.map((loc) => ({
    id: loc.id,
    name: loc.name ?? null,
    addressLine1: loc.addressLine1 ?? null,
    addressLine2: loc.addressLine2 ?? null,
    city: loc.city ?? null,
    state: loc.state ?? null,
    postalCode: loc.postalCode ?? null,
  }))

  // Build a minimal ContactInfo from cached phone/email — name falls back to customer name
  const contact =
    job.contactId || job.contactPhone || job.contactEmail
      ? {
          id: job.contactId ?? 'cached',
          firstName: job.customerName ?? 'Customer',
          lastName: null as string | null,
          phones: job.contactPhone
            ? [{ id: 'p0', number: job.contactPhone, isPrimary: true as boolean | null }]
            : [],
          emails: job.contactEmail
            ? [{ id: 'e0', address: job.contactEmail, isPrimary: true as boolean | null }]
            : [],
        }
      : null

  const startDate = job.startDate ? parseCalendarDate(job.startDate) : null
  const arrivalStart = job.arrivalWindowStart ? new Date(job.arrivalWindowStart) : null
  const arrivalEnd = job.arrivalWindowEnd ? new Date(job.arrivalWindowEnd) : null

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Job #{job.jobNo}</h1>
          <Badge variant={statusBadgeVariant(job.status as JobStatusValue)} className="w-fit text-sm px-2.5 py-0.5">
            {statusLabel(job.status as JobStatusValue)}
          </Badge>
          {startDate && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="size-3.5 shrink-0" />
              {startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          )}
          {(arrivalStart || arrivalEnd) && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              {arrivalStart ? arrivalStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
              {arrivalEnd ? ` – ${arrivalEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
            </p>
          )}
        </div>
        <StatusBottomSheet
          orgId={orgId}
          jobId={job.id}
          currentStatus={job.status as JobStatusValue}
        />
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="sign">Sign</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex flex-col gap-4 mt-4">
          <TechContactCard
            jobId={job.id}
            customerId={job.customerId}
            customerName={job.customerName ?? ''}
            contact={contact}
          />

          <TechLocationCard
            jobId={job.id}
            customerId={job.customerId}
            serviceLocation={serviceLocation}
            availableLocations={availableLocations}
          />

          <JobDescription jobId={job.id} initialDescription={job.description} />

          <EquipmentSection
            orgId={orgId}
            jobId={job.id}
            serviceLocationId={job.serviceLocationId ?? undefined}
            serverEquipment={equipment}
          />

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Office Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {job.notesForTechs || 'No office notes for this job.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <TechLineItems jobId={job.id} items={[]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <PhotoUploader
            orgId={orgId}
            jobId={job.id}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="sign" className="mt-4">
          <TechSignaturePad
            orgId={orgId}
            jobId={job.id}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <CompletionNotes
            orgId={orgId}
            jobId={job.id}
            initialNotes={job.completionNotes}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
