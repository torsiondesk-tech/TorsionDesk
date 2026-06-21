'use client'

import { useTechContext } from '../../components/sync-provider'
import { InvoiceList } from '../../components/invoice-list'

export default function TechInvoicesPage() {
  const { orgId, userId } = useTechContext()
  return <InvoiceList orgId={orgId} userId={userId} />
}
