'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useTechContext } from '../../../components/sync-provider'
import { InvoiceDetail } from '../../../components/invoice-detail'

export default function TechInvoiceDetailPage() {
  const { orgId, userId } = useTechContext()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const jobId = searchParams.get('jobId') ?? undefined
  return <InvoiceDetail orgId={orgId} userId={userId} invoiceId={id} jobId={jobId} />
}
