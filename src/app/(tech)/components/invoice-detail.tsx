'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { useTechInvoice } from '@/app/(tech)/lib/use-tech-data'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'
import { createInvoiceFromJobAction } from '@/app/(tech)/tech/invoices/actions'
import { SendPdfButton } from './send-pdf-button'
import { SquarePayButton } from './square-pay-button'
import { toast } from 'sonner'

interface InvoiceDetailProps {
  orgId: string
  userId: string
  invoiceId: string
  jobId?: string
}

function formatMoney(cents: number | null): string {
  if (cents === null || isNaN(cents)) return '—'
  return '$' + (cents / 100).toFixed(2)
}

export function InvoiceDetail({ orgId, userId, invoiceId, jobId }: InvoiceDetailProps) {
  const invoice = useTechInvoice(orgId, invoiceId)
  const online = useOnline()
  const router = useRouter()

  async function handleCreateInvoice() {
    if (!jobId) return
    if (online) {
      const result = await createInvoiceFromJobAction(jobId)
      if (!result.success) {
        toast.error(result.error)
      } else {
        toast.success('Invoice created')
        router.push('/tech/invoices')
      }
    } else {
      await enqueueOutboxItem(orgId, {
        type: 'invoice_create',
        payload: { jobId },
      })
      toast.info('Queued invoice creation — will sync when online')
    }
  }

  if (invoice === undefined) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">Loading invoice…</div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <Receipt className="size-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Invoice not found</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Pull down to refresh or create an invoice from a completed job.
        </p>
        <Button className="mt-6" onClick={() => router.push('/tech/invoices')}>
          Back to invoices
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain flex flex-col gap-4 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Link
        href="/tech/invoices"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{invoice.invoiceNo || 'Invoice'}</p>
            <h1 className="text-lg font-semibold truncate">
              {invoice.customerName || 'Unknown customer'}
            </h1>
            <Badge variant="secondary" className="mt-1">{invoice.status}</Badge>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{formatMoney(invoice.total)}</p>
            {invoice.balance !== null && invoice.balance !== invoice.total && (
              <p className="text-sm text-muted-foreground">Balance {formatMoney(invoice.balance)}</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Issued:</span> {invoice.issuedAt || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Due:</span> {invoice.dueAt || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Paid:</span> {invoice.paidAt || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Notes:</span> {invoice.notes || '—'}
          </p>
        </CardContent>
      </Card>

      {jobId && (
        <Button onClick={handleCreateInvoice} className="w-full">
          Create Invoice
        </Button>
      )}

      <SendPdfButton
        orgId={orgId}
        userId={userId}
        kind="invoice"
        refId={invoice.id}
        customerEmail={null}
        customerPhone={null}
      />

      <SquarePayButton
        orgId={orgId}
        userId={userId}
        invoiceId={invoice.id}
        amount={invoice.balance ?? invoice.total ?? 0}
      />
    </div>
  )
}
