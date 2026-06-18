import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { InvoiceList } from '../../components/invoice-list'

export default async function TechInvoicesPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  return <InvoiceList orgId={orgId} userId={userId} />
}
