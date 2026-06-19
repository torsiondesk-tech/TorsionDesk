'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CachedInvoice } from '@/app/(tech)/lib/dexie'

interface InvoiceCardProps {
  invoice: CachedInvoice
}

function formatMoney(cents: number | null): string {
  if (cents === null || isNaN(cents)) return '—'
  return '$' + (cents / 100).toFixed(2)
}

export function InvoiceCard({ invoice }: InvoiceCardProps) {
  return (
    <Link href={`/tech/invoices/${invoice.id}`} className="block touch-pan-y transition-transform duration-75 active:scale-[0.98]">
      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold truncate">
                {invoice.customerName || 'Unknown customer'}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {invoice.invoiceNo || 'Invoice'}
              </p>
              <p className="text-sm text-muted-foreground">
                Total: {formatMoney(invoice.total)}
                {invoice.balance !== null && invoice.balance !== invoice.total && (
                  <span className="ml-2">Balance: {formatMoney(invoice.balance)}</span>
                )}
              </p>
            </div>
            <Badge variant="secondary">{invoice.status}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
