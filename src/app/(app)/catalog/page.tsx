import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listProducts, listServices, listProductCategories } from '@/lib/catalog'
import { ProductsTable } from './products-table'
import { ServicesTable } from './services-table'
import { CatalogToolbar } from './catalog-toolbar'
import { CatalogTabs } from './catalog-tabs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

interface CatalogPageProps {
  searchParams: Promise<{
    q?: string | string[]
    category?: string | string[]
    minPrice?: string | string[]
    maxPrice?: string | string[]
    inventory?: string | string[]
    sort?: string | string[]
    page?: string | string[]
    tab?: string | string[]
  }>
}

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0]
  return param
}

async function ProductList({ searchParams }: CatalogPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams
  const q = normalizeParam(params.q)
  const categoryId = normalizeParam(params.category)
  const minPrice = normalizeParam(params.minPrice)
  const maxPrice = normalizeParam(params.maxPrice)
  const inventory = normalizeParam(params.inventory)
  const sort = normalizeParam(params.sort)
  const page = Math.max(0, parseInt(normalizeParam(params.page) ?? '0', 10) || 0)

  const { rows, pageCount } = await listProducts(orgId, {
    page,
    pageSize: 25,
    categoryId,
    q,
    minPrice,
    maxPrice,
    inventoryItem: inventory === 'true' ? true : inventory === 'false' ? false : undefined,
    sort,
  })

  return (
    <ProductsTable
      rows={rows}
      pageCount={pageCount}
      page={page}
      pageSize={25}
    />
  )
}

async function ServiceList({ searchParams }: CatalogPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams
  const q = normalizeParam(params.q)
  const categoryId = normalizeParam(params.category)
  const sort = normalizeParam(params.sort)
  const page = Math.max(0, parseInt(normalizeParam(params.page) ?? '0', 10) || 0)

  const { rows, pageCount } = await listServices(orgId, {
    page,
    pageSize: 25,
    categoryId,
    q,
    sort,
  })

  return (
    <ServicesTable
      rows={rows}
      pageCount={pageCount}
      page={page}
      pageSize={25}
    />
  )
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams
  const tab = normalizeParam(params.tab) ?? 'products'
  const isServices = tab === 'services'

  const categories = await listProductCategories(orgId)

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Manage your products and services.
          </p>
        </div>
        <Link href={isServices ? '/catalog/services/new' : '/catalog/products/new'}>
          <Button size="sm">
            <Plus className="size-4" />
            {isServices ? 'New Service' : 'New Product'}
          </Button>
        </Link>
      </div>

      <CatalogTabs active={isServices ? 'services' : 'products'} />

      {!isServices && <CatalogToolbar categories={categories} />}

      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-lg bg-muted">
            Loading {isServices ? 'services' : 'products'}…
          </div>
        }
      >
        {isServices ? (
          <ServiceList searchParams={searchParams} />
        ) : (
          <ProductList searchParams={searchParams} />
        )}
      </Suspense>
    </div>
  )
}
