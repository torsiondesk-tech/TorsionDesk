import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { getCustomerById } from '@/lib/customers'
import { withTenant } from '@/db/with-tenant'
import { jobs, serviceLocations } from '@/db/schema'
import { getInvoiceAction } from '../actions'
import { InvoiceDetailShell } from './invoice-detail-shell'

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

async function getServiceLocation(orgId: string, locationId: string | null) {
  if (!locationId) return null
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        addressLine1: serviceLocations.addressLine1,
        city: serviceLocations.city,
        state: serviceLocations.state,
        postalCode: serviceLocations.postalCode,
      })
      .from(serviceLocations)
      .where(and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.id, locationId)))
      .limit(1)
    return row ?? null
  })
}

async function getJobDetails(orgId: string, jobId: string) {
  return withTenant(orgId, async (tx) => {
    const [row] = await tx
      .select({
        jobNo: jobs.jobNo,
        startDate: jobs.startDate,
        poNumber: jobs.poNumber,
        description: jobs.description,
      })
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
      .limit(1)
    if (!row) return null
    return {
      jobNo: row.jobNo,
      startDate: row.startDate instanceof Date ? row.startDate.toISOString().slice(0, 10) : null,
      poNumber: row.poNumber ?? null,
      description: row.description ?? null,
    }
  })
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const { id } = await params
  const invoice = await getInvoiceAction(orgId, id)
  if (!invoice) notFound()

  const [customer, serviceLocation, billingLocation, jobDetails] = await Promise.all([
    getCustomerById(orgId, invoice.customerId),
    getServiceLocation(orgId, invoice.serviceLocationId),
    getServiceLocation(orgId, invoice.billingLocationId),
    getJobDetails(orgId, invoice.jobId),
  ])

  return (
    <div className="animate-in fade-in-0 duration-300">
      <InvoiceDetailShell
        invoice={invoice}
        customer={customer}
        serviceLocation={serviceLocation}
        billingLocation={billingLocation}
        jobDetails={jobDetails}
      />
    </div>
  )
}
