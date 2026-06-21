'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useTechContext } from '../../../components/sync-provider'
import { InvoiceDetail } from '../../../components/invoice-detail'

function InvoiceDetailContent() {
  const { orgId, userId } = useTechContext()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const jobId = searchParams.get('jobId') ?? undefined
  return <InvoiceDetail orgId={orgId} userId={userId} invoiceId={id} jobId={jobId} />
}

export default function TechInvoiceDetailPage() {
  return (
    <Suspense>
      <InvoiceDetailContent />
    </Suspense>
  )
}
