import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { getCustomerById } from '@/lib/customers'
import { MergeCompare } from './merge-compare'

interface MergePageProps {
  searchParams: Promise<{
    a?: string | string[]
    b?: string | string[]
  }>
}

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0]
  return param
}

export default async function MergePage({ searchParams }: MergePageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams
  const aId = normalizeParam(params.a)
  const bId = normalizeParam(params.b)

  if (!aId || !bId) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <h1 className="text-2xl font-bold">Merge Customers</h1>
        <p className="text-muted-foreground">
          Select two customers to compare and merge.
        </p>
      </div>
    )
  }

  const [a, b] = await Promise.all([
    getCustomerById(orgId, aId),
    getCustomerById(orgId, bId),
  ])

  if (!a || !b) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in-0 duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Merge Customers</h1>
        <p className="text-sm text-muted-foreground">
          Pick which values to keep. The losing record will be archived.
        </p>
      </div>

      <MergeCompare a={a} b={b} />
    </div>
  )
}
