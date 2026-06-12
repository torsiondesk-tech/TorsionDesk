import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listCustomers } from '@/lib/customers'
import { CustomersTable } from './customers-table'
import { CustomersToolbar } from './customers-toolbar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

interface CustomersPageProps {
  searchParams: Promise<{
    q?: string | string[]
    status?: string | string[]
    city?: string | string[]
    tag?: string | string[]
    page?: string | string[]
    sort?: string | string[]
  }>
}

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0]
  return param
}

async function CustomerList({ searchParams }: CustomersPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams
  const q = normalizeParam(params.q)
  const status = normalizeParam(params.status)
  const city = normalizeParam(params.city)
  const tag = normalizeParam(params.tag)
  const sort = normalizeParam(params.sort)
  const page = Math.max(0, parseInt(normalizeParam(params.page) ?? '0', 10) || 0)

  const { rows, pageCount } = await listCustomers(orgId, {
    page,
    pageSize: 25,
    active: status ? status === 'active' : undefined,
    city,
    tag,
    q,
    sort,
  })

  return (
    <CustomersTable
      rows={rows}
      pageCount={pageCount}
      page={page}
      pageSize={25}
    />
  )
}

export default function CustomersPage({ searchParams }: CustomersPageProps) {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer book.
          </p>
        </div>
        <Link href="/customers/new">
          <Button size="sm">
            <Plus className="size-4" />
            New Customer
          </Button>
        </Link>
      </div>

      <CustomersToolbar />

      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-lg bg-muted">
            Loading customers…
          </div>
        }
      >
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
