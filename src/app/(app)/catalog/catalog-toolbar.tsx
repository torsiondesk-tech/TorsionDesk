'use client'

import { useQueryState } from 'nuqs'
import { Input } from '@/components/ui/input'
import { useTransition } from 'react'

interface CatalogToolbarProps {
  categories: Array<{ id: string; name: string }>
  mode?: 'products' | 'services'
}

export function CatalogToolbar({ categories, mode = 'products' }: CatalogToolbarProps) {
  const isServices = mode === 'services'
  const [q, setQ] = useQueryState('q')
  const [category, setCategory] = useQueryState('category')
  const [minPrice, setMinPrice] = useQueryState('minPrice')
  const [maxPrice, setMaxPrice] = useQueryState('maxPrice')
  const [inventory, setInventory] = useQueryState('inventory')
  const [page, setPage] = useQueryState('page')
  const [isPending, startTransition] = useTransition()

  const handleSearch = (val: string) => {
    startTransition(() => {
      setQ(val || null)
      setPage(null)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder={isServices ? 'Search by name…' : 'Search by name or SKU…'}
        value={q ?? ''}
        onChange={(e) => {
          const v = e.currentTarget.value
          if (isPending) return
          handleSearch(v)
        }}
        className="max-w-sm"
      />

      <select
        value={category ?? ''}
        onChange={(e) => {
          const v = e.target.value
          startTransition(() => {
            setCategory(v || null)
            setPage(null)
          })
        }}
        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {!isServices && (
        <>
          <Input
            placeholder="Min price"
            type="text"
            value={minPrice ?? ''}
            onChange={(e) => {
              const v = e.currentTarget.value
              startTransition(() => {
                setMinPrice(v || null)
                setPage(null)
              })
            }}
            className="max-w-[120px]"
          />

          <Input
            placeholder="Max price"
            type="text"
            value={maxPrice ?? ''}
            onChange={(e) => {
              const v = e.currentTarget.value
              startTransition(() => {
                setMaxPrice(v || null)
                setPage(null)
              })
            }}
            className="max-w-[120px]"
          />

          <select
            value={inventory ?? ''}
            onChange={(e) => {
              const v = e.target.value
              startTransition(() => {
                setInventory(v || null)
                setPage(null)
              })
            }}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
          >
            <option value="">All items</option>
            <option value="true">Inventory only</option>
            <option value="false">Non-inventory</option>
          </select>
        </>
      )}
    </div>
  )
}
