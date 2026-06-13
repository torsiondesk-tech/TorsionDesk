import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { ProductForm } from '../../product-form'
import { getProductById, listProductCategories } from '@/lib/catalog'

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const { id } = await params
  const product = await getProductById(orgId, id)
  if (!product) notFound()

  const categories = await listProductCategories(orgId)

  return (
    <div className="space-y-6">
      <ProductForm
        mode="edit"
        initial={{
          id: product.id,
          name: product.name,
          categoryId: product.categoryId,
          model: product.model ?? undefined,
          sku: product.sku ?? undefined,
          upc: product.upc ?? undefined,
          partNo: product.partNo ?? undefined,
          type: product.type ?? undefined,
          unitPrice: product.unitPrice ?? '',
          unitCost: product.unitCost ?? undefined,
          active: product.active ?? true,
          inventoryItem: product.inventoryItem ?? false,
          salesDescription: product.salesDescription ?? undefined,
          purchaseDescription: product.purchaseDescription ?? undefined,
          vendor1Name: product.vendor1Name ?? undefined,
          vendor1Price: product.vendor1Price ?? undefined,
          vendor2Name: product.vendor2Name ?? undefined,
          vendor2Price: product.vendor2Price ?? undefined,
          vendor3Name: product.vendor3Name ?? undefined,
          vendor3Price: product.vendor3Price ?? undefined,
        }}
        categories={categories}
      />
    </div>
  )
}
