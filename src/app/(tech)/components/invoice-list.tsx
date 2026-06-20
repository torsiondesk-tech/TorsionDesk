'use client'

import { Receipt, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTechInvoices } from '@/app/(tech)/lib/use-tech-data'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { flushOutbox } from '@/app/(tech)/lib/sync'
import { InvoiceCard } from './invoice-card'

interface InvoiceListProps {
  orgId: string
  userId: string
}

export function InvoiceList({ orgId, userId }: InvoiceListProps) {
  const invoices = useTechInvoices(orgId)
  const online = useOnline()

  if (invoices === undefined) {
    return (
      <div className="h-full overflow-y-auto overscroll-y-contain">
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col items-center justify-center px-6 py-12 text-center">
        <Receipt className="size-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">No invoices</h1>
        <p className="mt-2 max-w-sm text-base text-muted-foreground">
          Invoices you create from jobs will appear here. Pull down to refresh.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {!online && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Offline — queued changes will sync when you reconnect.
          </div>
        )}
        {invoices.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} />
        ))}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => flushOutbox(orgId, userId)}
        >
          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
          Sync now
        </Button>
      </div>
    </div>
  )
}
