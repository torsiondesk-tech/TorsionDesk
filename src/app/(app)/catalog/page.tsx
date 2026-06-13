import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listProducts, listServices, listProductCategories } from '@/lib/catalog'
import { CatalogClient } from './catalog-client'

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

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const params = await searchParams
  const tab = normalizeParam(params.tab) ?? 'products'
  const isServices = tab === 'services'

  const categories = await listProductCategories(orgId)

  const q = normalizeParam(params.q)
  const categoryId = normalizeParam(params.category)
  const sort = normalizeParam(params.sort)
  const page = Math.max(0, parseInt(normalizeParam(params.page) ?? '0', 10) || 0)

  let productData = { rows: [] as Awaited<ReturnType<typeof listProducts>>['rows'], pageCount: 0 }
  let serviceData = { rows: [] as Awaited<ReturnType<typeof listServices>>['rows'], pageCount: 0 }

  if (isServices) {
    serviceData = await listServices(orgId, {
      page,
      pageSize: 25,
      categoryId,
      q,
      sort,
    })
  } else {
    const minPrice = normalizeParam(params.minPrice)
    const maxPrice = normalizeParam(params.maxPrice)
    const inventory = normalizeParam(params.inventory)

    productData = await listProducts(orgId, {
      page,
      pageSize: 25,
      categoryId,
      q,
      minPrice,
      maxPrice,
      inventoryItem: inventory === 'true' ? true : inventory === 'false' ? false : undefined,
      sort,
    })
  }

  return (
    <CatalogClient
      initialProductRows={productData.rows}
      initialProductPageCount={productData.pageCount}
      initialServiceRows={serviceData.rows}
      initialServicePageCount={serviceData.pageCount}
      categories={categories}
      initialTab={isServices ? 'services' : 'products'}
      initialPage={page}
    />
  )
}
