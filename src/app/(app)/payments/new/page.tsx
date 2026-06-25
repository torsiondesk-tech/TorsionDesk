import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { withTenant } from '@/db/with-tenant'
import { jobs } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  listOpenInvoicesForCustomerAction,
  listPaymentMethodsAction,
  seedDefaultPaymentMethodsAction,
} from '../actions'
import { ReceivePaymentForm } from './receive-payment-form'

interface ReceivePaymentPageProps {
  searchParams: Promise<{
    customerId?: string
    invoiceId?: string
    jobId?: string
    type?: string
  }>
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

export default async function ReceivePaymentPage({ searchParams }: ReceivePaymentPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const { customerId, invoiceId, jobId, type } = await searchParams
  if (!customerId) redirect('/invoices')

  let openInvoicesResult: Awaited<ReturnType<typeof listOpenInvoicesForCustomerAction>>
  let methodsResult: Awaited<ReturnType<typeof listPaymentMethodsAction>>
  let jobNo: number | null
  try {
    ;[openInvoicesResult, methodsResult, jobNo] = await Promise.all([
      listOpenInvoicesForCustomerAction(orgId, customerId),
      listPaymentMethodsAction(orgId).then(async (m) => {
        if (m.methods.length === 0) {
          await seedDefaultPaymentMethodsAction(orgId)
          return listPaymentMethodsAction(orgId)
        }
        return m
      }),
      jobId ? getJobNo(orgId, jobId) : Promise.resolve(null),
    ])
  } catch (err) {
    return (
      <div className="p-8 font-mono text-sm">
        <p className="font-bold text-destructive">Server error (debug — will be removed):</p>
        <pre className="mt-2 whitespace-pre-wrap text-xs">{err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err)}</pre>
      </div>
    )
  }

  return (
    <ReceivePaymentForm
      orgId={orgId}
      customerId={customerId}
      openInvoices={openInvoicesResult.rows}
      paymentMethods={methodsResult.methods}
      defaultInvoiceId={invoiceId}
      defaultJobId={jobId}
      defaultJobNo={jobNo ?? undefined}
      isDeposit={type === 'deposit'}
    />
  )
}

