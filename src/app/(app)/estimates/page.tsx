import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { EstimatesSidebar } from './estimates-sidebar'
import { EstimatesTable } from './estimates-table'
import { countEstimatesByStatus, listEstimatesAction } from './actions'

interface EstimatesPageProps {
  searchParams: Promise<{
    status?: string | string[]
    mine?: string | string[]
    sort?: string | string[]
    dir?: string | string[]
  }>
}

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0]
  return param
}

async function EstimateList({
  orgId,
  searchParams,
}: {
  orgId: string
  searchParams: EstimatesPageProps['searchParams']
}) {
  const params = await searchParams
  const status = normalizeParam(params.status)
  const sort = normalizeParam(params.sort)
  const dir = normalizeParam(params.dir)
  const { rows } = await listEstimatesAction(orgId, { status, sort, dir })
  return <EstimatesTable rows={rows as import('./estimates-table').EstimateRow[]} status={status} />
}

export default async function EstimatesPage({ searchParams }: EstimatesPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const statusCounts = await countEstimatesByStatus(orgId)

  return (
    <div className="flex gap-6 animate-in fade-in-0 duration-300">
      <aside className="hidden lg:block w-60 shrink-0">
        <EstimatesSidebar statusCounts={statusCounts} />
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Estimates</h1>
            <p className="text-sm text-muted-foreground">Track quotes, proposals, and closed/won work.</p>
          </div>
          <Link href="/estimates/new">
            <Button size="sm">
              <Plus className="size-4" />
              New Estimate
            </Button>
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-lg bg-muted">Loading estimates…</div>
          }
        >
          <EstimateList orgId={orgId} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}
