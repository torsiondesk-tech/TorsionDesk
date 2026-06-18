import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { Briefcase, MapPin, User, FileText, ClipboardList } from 'lucide-react'
import { getJob } from '@/lib/jobs/jobs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { statusBadgeVariant, statusLabel, type JobStatusValue } from '@/lib/jobs/transitions'
import { StatusBottomSheet } from '../../../components/status-bottom-sheet'

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

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Briefcase className="size-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm text-muted-foreground">Job #{job.jobNo}</p>
              <Badge variant={statusBadgeVariant(job.status)}>{statusLabel(job.status)}</Badge>
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
              {job.serviceLocation ? (
                <div className="text-sm text-muted-foreground">
                  <p>{job.serviceLocation.addressLine1}</p>
                  {job.serviceLocation.addressLine2 && <p>{job.serviceLocation.addressLine2}</p>}
                  <p>
                    {job.serviceLocation.city}, {job.serviceLocation.state} {job.serviceLocation.postalCode}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No service location on file.</p>
              )}
            </CardContent>
          </Card>

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
              {job.lineItems.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {job.lineItems.map((item) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span>{item.description}</span>
                      <span className="tabular-nums">{item.qty} x {item.rate}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No line items on this job.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <p className="p-4 text-center text-sm text-muted-foreground">Photo capture added in the next wave.</p>
        </TabsContent>
        <TabsContent value="sign" className="mt-4">
          <p className="p-4 text-center text-sm text-muted-foreground">Signature capture added in the next wave.</p>
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <p className="p-4 text-center text-sm text-muted-foreground">Completion notes added in the next wave.</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
