import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { ServiceForm } from '../../service-form'
import { getServiceById, listProductCategories } from '@/lib/catalog'

interface EditServicePageProps {
  params: Promise<{ id: string }>
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const { id } = await params
  const service = await getServiceById(orgId, id)
  if (!service) notFound()

  const categories = await listProductCategories(orgId)

  return (
    <div className="space-y-6">
      <ServiceForm
        mode="edit"
        initial={{
          id: service.id,
          name: service.name,
          categoryId: service.categoryId,
          unitPrice: service.unitPrice ?? '',
          unitCost: service.unitCost ?? undefined,
          description: service.description ?? undefined,
          active: service.active ?? true,
        }}
        categories={categories}
      />
    </div>
  )
}
