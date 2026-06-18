import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Receipt } from 'lucide-react'

export default async function TechInvoicesPage() {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) {
    redirect('/sign-in')
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Receipt className="size-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold">No invoices</h1>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">
        Invoices you create from jobs will appear here. Pull down to refresh.
      </p>
    </div>
  )
}
