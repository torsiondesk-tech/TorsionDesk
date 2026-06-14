import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listJobs, countJobsByTag } from '@/lib/jobs/jobs'
import { JobsTable } from './jobs-table'
import { JobsSidebar } from './jobs-sidebar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

interface JobsPageProps {
  searchParams: Promise<{
    bucket?: string | string[]
    tag?: string | string[]
    sort?: string | string[]
    dir?: string | string[]
    page?: string | string[]
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

  const { rows, pageCount } = await listJobs(orgId, {
    page,
    pageSize: 25,
    bucket,
    tag,
    sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : undefined,
    userId,
  })

  return (
    <JobsTable
      rows={rows}
      pageCount={pageCount}
      page={page}
      pageSize={25}
    />
  )
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const tagCounts = await countJobsByTag(orgId)

  return (
    <div className="flex gap-6 animate-in fade-in-0 duration-300">
      {/* Nested left sidebar */}
      <aside className="w-60 shrink-0">
        <JobsSidebar tagCounts={tagCounts} />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              Manage your jobs and service calls.
            </p>
          </div>
          <Link href="/jobs/new">
            <Button size="sm">
              <Plus className="size-4" />
              New Job
            </Button>
          </Link>
        </div>

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
