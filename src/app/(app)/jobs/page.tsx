import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listJobs, countJobsByTag } from '@/lib/jobs/jobs'
import { listJobCategories } from '@/lib/categories'
import { getCustomerById } from '@/lib/customers'
import { JobsTable } from './jobs-table'
import { JobsSidebar } from './jobs-sidebar'
import { JobsFilterSheet } from './jobs-filter-sheet'
import { JobsAdvancedSearch } from './jobs-advanced-search'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { STATUS_GROUPS, type JobStatusValue } from '@/lib/jobs/transitions'

const ALL_JOB_STATUSES = [
  ...STATUS_GROUPS.open,
  ...STATUS_GROUPS.in_progress,
  ...STATUS_GROUPS.closed,
]

function toJobStatus(value: string | undefined): JobStatusValue | undefined {
  if (!value) return undefined
  if (ALL_JOB_STATUSES.includes(value as JobStatusValue)) {
    return value as JobStatusValue
  }
  return undefined
}

interface JobsPageProps {
  searchParams: Promise<{
    bucket?: string | string[]
    tag?: string | string[]
    sort?: string | string[]
    dir?: string | string[]
    page?: string | string[]
    q?: string | string[]
    status?: string | string[]
    priority?: string | string[]
    category?: string | string[]
    from?: string | string[]
    to?: string | string[]
    tech?: string | string[]
    customer?: string | string[]
  }>
}

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0]
  return param
}

async function JobList({ searchParams, userId }: JobsPageProps & { userId: string }) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams
  const bucket = normalizeParam(params.bucket)
  const tag = normalizeParam(params.tag)
  const sort = normalizeParam(params.sort)
  const dir = normalizeParam(params.dir)
  const page = Math.max(0, parseInt(normalizeParam(params.page) ?? '0', 10) || 0)
  const q = normalizeParam(params.q)
  const status = toJobStatus(normalizeParam(params.status))
  const priority = normalizeParam(params.priority)
  const categoryId = normalizeParam(params.category)
  const dateFrom = normalizeParam(params.from)
  const dateTo = normalizeParam(params.to)
  const assigneeUserId = normalizeParam(params.tech)
  const customerId = normalizeParam(params.customer)

  const { rows, pageCount } = await listJobs(orgId, {
    page,
    pageSize: 25,
    bucket,
    tag,
    sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : undefined,
    userId,
    q,
    status,
    priority,
    categoryId,
    dateFrom,
    dateTo,
    assigneeUserId,
    customerId,
  })

  return (
    <JobsTable
      rows={rows}
      pageCount={pageCount}
      page={page}
      pageSize={25}
      bucket={bucket}
    />
  )
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const [tagCounts, categories, params] = await Promise.all([
    countJobsByTag(orgId),
    listJobCategories(orgId),
    searchParams,
  ])

  const bucket = normalizeParam(params.bucket)
  const isAdvancedSearch = bucket === 'advanced_search'

  // Pre-load customer name so the advanced-search customer combobox can display
  // an existing filter immediately.
  const customerId = normalizeParam(params.customer)
  let customerName: string | null = null
  if (customerId) {
    const customer = await getCustomerById(orgId, customerId)
    customerName = customer?.name ?? null
  }

  return (
    <div className="flex gap-6 animate-in fade-in-0 duration-300">
      {/* Nested left sidebar — desktop only */}
      <aside className="hidden lg:block w-60 shrink-0">
        <JobsSidebar tagCounts={tagCounts} />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              Manage your jobs and service calls.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <JobsFilterSheet tagCounts={tagCounts} />
            <Link href="/jobs/new">
              <Button size="sm">
                <Plus className="size-4" />
                New Job
              </Button>
            </Link>
          </div>
        </div>

        {isAdvancedSearch && (
          <JobsAdvancedSearch
            categories={categories}
            defaultCustomerLabel={customerName}
          />
        )}

        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-lg bg-muted">
              Loading jobs…
            </div>
          }
        >
          <JobList searchParams={searchParams} userId={userId} />
        </Suspense>
      </div>
    </div>
  )
}
