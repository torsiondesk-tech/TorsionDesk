'use client'

import { useEffect, useState, useTransition } from 'react'
import { useQueryState } from 'nuqs'
import { ProductsTable } from './products-table'
import { ServicesTable } from './services-table'
import { CatalogToolbar } from './catalog-toolbar'
import { CatalogTabs } from './catalog-tabs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { listProductsAction, listServicesAction } from './actions'
import type { ProductRow, ServiceRow } from '@/lib/catalog'

interface CatalogClientProps {
  initialProductRows: ProductRow[]
  initialProductPageCount: number
  initialServiceRows: ServiceRow[]
  initialServicePageCount: number
  categories: Array<{ id: string; name: string }>
  initialTab: 'products' | 'services'
  initialPage: number
}

export function CatalogClient({
  initialProductRows,
  initialProductPageCount,
  initialServiceRows,
  initialServicePageCount,
  categories,
  initialTab,
  initialPage,
}: CatalogClientProps) {
  const [tab, setTab] = useQueryState('tab', {
    defaultValue: initialTab,
    parse: (v) => (v === 'services' ? 'services' : 'products'),
  })
  const [q] = useQueryState('q')
  const [category] = useQueryState('category')
  const [minPrice] = useQueryState('minPrice')
  const [maxPrice] = useQueryState('maxPrice')
  const [inventory] = useQueryState('inventory')
  const [sort] = useQueryState('sort')
  const [page] = useQueryState('page')

  const isServices = tab === 'services'

  const [productRows, setProductRows] = useState<ProductRow[]>(initialProductRows)
  const [productPageCount, setProductPageCount] = useState(initialProductPageCount)
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>(initialServiceRows)
  const [servicePageCount, setServicePageCount] = useState(initialServicePageCount)
  const [isPending, startTransition] = useTransition()

  const currentPage = Math.max(0, parseInt(page ?? String(initialPage), 10) || 0)

  // Refetch products when filters change
  useEffect(() => {
    if (isServices) return
    startTransition(() => {
      listProductsAction({
        page: currentPage,
        pageSize: 25,
        categoryId: category ?? undefined,
        q: q ?? undefined,
        minPrice: minPrice ?? undefined,
        maxPrice: maxPrice ?? undefined,
        inventory: inventory ?? undefined,
        sort: sort ?? undefined,
      }).then((data) => {
        setProductRows(data.rows)
        setProductPageCount(data.pageCount)
      })
    })
  }, [q, category, minPrice, maxPrice, inventory, sort, page, isServices, currentPage])

  // Refetch services when filters change
  useEffect(() => {
    if (!isServices) return
    startTransition(() => {
      listServicesAction({
        page: currentPage,
        pageSize: 25,
        categoryId: category ?? undefined,
        q: q ?? undefined,
        sort: sort ?? undefined,
      }).then((data) => {
        setServiceRows(data.rows)
        setServicePageCount(data.pageCount)
      })
    })
  }, [q, category, sort, page, isServices, currentPage])

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

      <div data-pending={isPending}>
        {isServices ? (
          <ServicesTable
            rows={serviceRows}
            pageCount={servicePageCount}
            page={currentPage}
            pageSize={25}
          />
        ) : (
          <ProductsTable
            rows={productRows}
            pageCount={productPageCount}
            page={currentPage}
            pageSize={25}
          />
        )}
      </div>
    </div>
  )
}
