import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { Briefcase, MapPin, User, FileText, ClipboardList, Calendar, Clock } from 'lucide-react'
import { getJob } from '@/lib/jobs/jobs'
import { getEquipmentByServiceLocation } from '@/lib/customers'
import { getJobPhotoSignedUrls } from '@/lib/jobs/photos'
import { getJobSignatureSignedUrls } from '@/lib/jobs/signatures'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { statusBadgeVariant, statusLabel, type JobStatusValue } from '@/lib/jobs/transitions'
import { StatusBottomSheet } from '../../../components/status-bottom-sheet'
import { PhotoUploader } from '../../../components/photo-uploader'
import { TechSignaturePad } from '../../../components/tech-signature-pad'
import { CompletionNotes } from '../../../components/completion-notes'
import { EquipmentSection } from '../../../components/equipment-section'
import { TechLineItems } from '../../../components/tech-line-items'
import { type CachedEquipment } from '@/app/(tech)/lib/dexie'

interface TechJobDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TechJobDetailPage({ params }: TechJobDetailPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  const { id } = await params
  const job = await getJob(orgId, id)
  if (!job) {
    notFound()
  }

  const [signedPhotos, signedSignatures, serverEquipment] = await Promise.all([
    getJobPhotoSignedUrls(orgId, id),
    getJobSignatureSignedUrls(orgId, id),
    job.serviceLocation?.id
      ? getEquipmentByServiceLocation(orgId, job.serviceLocation.id)
      : Promise.resolve([]),
  ])

  const typedEquipment: CachedEquipment[] = serverEquipment.map((row) => ({
    id: row.id,
    tenantId: orgId,
    serviceLocationId: row.serviceLocationId,
    kind: row.kind,
    brand: row.brand ?? null,
    installDate: row.installDate ? toDateString(row.installDate) : null,
    warrantyExpires: row.warrantyExpires ? toDateString(row.warrantyExpires) : null,
    notes: row.notes ?? null,
    widthFt: row.widthFt ? String(row.widthFt) : null,
    heightFt: row.heightFt ? String(row.heightFt) : null,
    material: row.material ?? null,
    style: row.style ?? null,
    color: row.color ?? null,
    modelSeries: row.modelSeries ?? null,
    model: row.model ?? null,
    hp: row.hp ? String(row.hp) : null,
    serial: row.serial ?? null,
    wireSize: row.wireSize ? String(row.wireSize) : null,
    insideDiameter: row.insideDiameter ? String(row.insideDiameter) : null,
    length: row.length ? String(row.length) : null,
    windDirection: row.windDirection,
    cycleRating: row.cycleRating ?? null,
  }))

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Card className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Briefcase className="size-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm text-muted-foreground">Job #{job.jobNo}</p>
              <Badge variant={statusBadgeVariant(job.status)}>{statusLabel(job.status)}</Badge>
              {job.startDate && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <Calendar className="size-3.5 shrink-0" />
                  {job.startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              )}
              {(job.arrivalWindowStart || job.arrivalWindowEnd) && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" />
                  {job.arrivalWindowStart
                    ? job.arrivalWindowStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    : ''}
                  {job.arrivalWindowEnd
                    ? ` – ${job.arrivalWindowEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    : ''}
                </p>
              )}
            </div>
          </div>
          <StatusBottomSheet
            orgId={orgId}
            jobId={job.id}
            currentStatus={job.status as JobStatusValue}
          />
        </div>
      </Card>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="sign">Sign</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex flex-col gap-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <User className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Customer Info</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{job.customerName}</p>
              {job.contact && (
                <p className="text-sm text-muted-foreground">
                  {job.contact.firstName} {job.contact.lastName || ''}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Service Location</CardTitle>
            </CardHeader>
            <CardContent>
              {job.serviceLocation ? (() => {
                const loc = job.serviceLocation
                const parts = [
                  loc.addressLine1,
                  loc.addressLine2,
                  [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', '),
                ].filter(Boolean)
                const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`
                return (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline leading-relaxed"
                  >
                    {parts.map((line, i) => (
                      <span key={i} className="block">{line}</span>
                    ))}
                  </a>
                )
              })() : (
                <p className="text-sm text-muted-foreground">No service location on file.</p>
              )}
            </CardContent>
          </Card>

          <EquipmentSection
            orgId={orgId}
            serviceLocationId={job.serviceLocation?.id}
            serverEquipment={typedEquipment}
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
              <TechLineItems jobId={job.id} items={job.lineItems} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <PhotoUploader
            orgId={orgId}
            jobId={job.id}
            userId={userId}
            signedPhotos={signedPhotos}
          />
        </TabsContent>

        <TabsContent value="sign" className="mt-4">
          <TechSignaturePad
            orgId={orgId}
            jobId={job.id}
            userId={userId}
            savedSignatures={signedSignatures}
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

function toDateString(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return null
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
