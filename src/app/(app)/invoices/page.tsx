import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { InvoicesSidebar } from './invoices-sidebar'
import { InvoicesTable } from './invoices-table'
import { countInvoicesByStatus, listInvoicesAction } from './actions'
import { computeArAging } from '@/lib/invoices/ar-aging'

interface InvoicesPageProps {
  searchParams: Promise<{
    status?: string | string[]
    sort?: string | string[]
    dir?: string | string[]
  }>
}

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0]
  return param
}

async function InvoiceList({
  orgId,
  searchParams,
}: {
  orgId: string
  searchParams: InvoicesPageProps['searchParams']
}) {
  const params = await searchParams
  const status = normalizeParam(params.status)
  const { rows } = await listInvoicesAction(orgId, status)
  return <InvoicesTable rows={rows} orgId={orgId} status={status} />
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const [statusCounts, arAging] = await Promise.all([
    countInvoicesByStatus(orgId),
    computeArAging(orgId),
  ])

  return (
    <div className="flex gap-6 animate-in fade-in-0 duration-300">
      <aside className="hidden lg:block w-60 shrink-0">
        <InvoicesSidebar statusCounts={statusCounts} arAging={arAging} />
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Unpaid, paid, and overdue invoices with live AR aging.
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-lg bg-muted">Loading invoices…</div>
          }
        >
          <InvoiceList orgId={orgId} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}
