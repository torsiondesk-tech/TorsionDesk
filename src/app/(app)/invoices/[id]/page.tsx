import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { getCustomerById } from '@/lib/customers'
import { withTenant } from '@/db/with-tenant'
import { jobs } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getInvoiceAction } from '../actions'
import { InvoiceDetailShell } from './invoice-detail-shell'

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

async function getJobNo(orgId: string, jobId: string): Promise<number | null> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({ jobNo: jobs.jobNo })
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))
      .limit(1)
    return rows[0]?.jobNo ?? null
  })
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const { id } = await params
  const invoice = await getInvoiceAction(orgId, id)
  if (!invoice) notFound()

  const [customer, jobNo] = await Promise.all([
    getCustomerById(orgId, invoice.customerId),
    getJobNo(orgId, invoice.jobId),
  ])

  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      <InvoiceDetailShell invoice={invoice} customer={customer} jobNo={jobNo ?? undefined} />
    </div>
  )
}
