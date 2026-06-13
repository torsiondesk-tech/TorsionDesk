'use client'

import { useQueryState } from 'nuqs'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function CatalogTabs({ active }: { active: 'products' | 'services' }) {
  const [, setTab] = useQueryState('tab')

  return (
    <Tabs
      value={active}
      onValueChange={(v) => {
        setTab(v === 'products' ? null : v)
      }}
    >
      <TabsList variant="line">
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
