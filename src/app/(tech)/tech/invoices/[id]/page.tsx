import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { InvoiceDetail } from '../../../components/invoice-detail'

interface TechInvoiceDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ jobId?: string }>
}

export default async function TechInvoiceDetailPage({
  params,
  searchParams,
}: TechInvoiceDetailPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  const { id } = await params
  const { jobId } = await searchParams
  return <InvoiceDetail orgId={orgId} userId={userId} invoiceId={id} jobId={jobId} />
}
