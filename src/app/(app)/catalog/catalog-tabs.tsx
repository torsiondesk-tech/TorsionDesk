'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function CatalogTabs({ active }: { active: 'products' | 'services' }) {
  return (
    <Tabs defaultValue={active}>
      <TabsList variant="line">
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
