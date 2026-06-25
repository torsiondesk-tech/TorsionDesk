'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Banknote,
  CreditCard,
  Copy,
  Download,
  FileDown,
  Link as LinkIcon,
  Loader2,
  Mail,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { invoiceStatusBadgeVariant } from '@/lib/invoices/status'
import { toast } from 'sonner'
import {
  deleteInvoiceAction,
  generateStripePaymentLinkAction,
  sendInvoiceAction,
  type getInvoiceAction,
} from '../actions'
import type { customers } from '@/db/schema'

interface InvoiceDetailShellProps {
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoiceAction>>>
  customer: typeof customers.$inferSelect | null
  jobNo?: number
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

function fmtMoney(value: string | null | undefined): string {
  if (!value) return '$0.00'
  const n = Number(value)
  if (Number.isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

function lineTotal(qty: string | null, rate: string | null): string {
  const q = Number(qty ?? '0')
  const r = Number(rate ?? '0')
  if (Number.isNaN(q) || Number.isNaN(r)) return '0.00'
  return (q * r).toFixed(2)
}

export function InvoiceDetailShell({ invoice, customer, jobNo }: InvoiceDetailShellProps) {
  const router = useRouter()
  const [paymentLinkUrl, setPaymentLinkUrl] = useState(invoice.paymentLinkUrl)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const totalNum = Number(invoice.total)
  const balanceNum = Number(invoice.balance)
  const paidNum = totalNum - balanceNum

  const statusVariant = invoiceStatusBadgeVariant(
    Math.round(balanceNum * 100),
    Math.round(totalNum * 100),
    invoice.dueDate ? new Date(invoice.dueDate) : null,
  )

  const handleCopyLink = async () => {
    if (!paymentLinkUrl) return
    try {
      await navigator.clipboard.writeText(paymentLinkUrl)
      toast('Payment link copied.')
    } catch {
      toast.error('Could not copy link.')
    }
  }

  const handleGenerateLink = async () => {
    setGeneratingLink(true)
    try {
      const result = await generateStripePaymentLinkAction(invoice.tenantId, invoice.id)
      if (result.error || !result.url) {
        toast.error(
          result.error ??
            "Couldn't generate the payment link. Refresh and try again — the invoice is saved.",
        )
        return
      }
      setPaymentLinkUrl(result.url)
      toast('Payment link generated.')
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleEmail = async () => {
    try {
      await sendInvoiceAction(invoice.tenantId, invoice.id)
      toast('Invoice email arrives in a later release. The PDF is ready to download and the payment link is ready to copy.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send invoice.')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const result = await deleteInvoiceAction(invoice.tenantId, invoice.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      router.push('/invoices')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete invoice.')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Invoice #{`INV-${invoice.invoiceNo}`}
          </h1>
          <Badge variant={statusVariant}>{invoice.status}</Badge>
        </div>
        {customer && (
          <Link
            href={`/customers/${customer.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {customer.name}
          </Link>
        )}
      </div>

      {typeof jobNo === 'number' && (
        <p className="text-sm text-muted-foreground">
          For Job{' '}
          <Link
            href={`/jobs/${invoice.jobId}`}
            className="font-medium text-foreground hover:underline"
          >
            #{`JOB-${jobNo}`}
          </Link>
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Left: line items */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 font-medium">Qty</th>
                        <th className="px-3 py-2 font-medium">Rate</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoice.lineItems.map((li) => (
                        <tr key={li.id}>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              {li.title ? (
                                <>
                                  <span className="font-medium">{li.title}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {li.description}
                                  </span>
                                </>
                              ) : (
                                <span>{li.description ?? '—'}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">{li.qty ?? '—'}</td>
                          <td className="px-3 py-2">{fmtMoney(li.rate)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            ${lineTotal(li.qty, li.rate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: actions + meta + totals + history */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/payments/new?invoiceId=${invoice.id}&customerId=${invoice.customerId}`}
              passHref
            >
              <Button size="sm" className="gap-2">
                <Banknote className="size-4" />
                Receive Payment
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleEmail}>
              <Mail className="size-4" />
              Email Invoice
            </Button>
            <Link href={`/api/invoices/${invoice.id}/pdf`} target="_blank" passHref>
              <Button variant="outline" size="sm" className="gap-2">
                <FileDown className="size-4" />
                Download PDF
              </Button>
            </Link>
          </div>

          {/* Meta sidebar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Invoice#</dt>
                  <dd className="font-medium">{`INV-${invoice.invoiceNo}`}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Invoice Date</dt>
                  <dd>{fmtDate(invoice.invoiceDate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Payment Terms</dt>
                  <dd>{invoice.paymentTermsDays ? `Net ${invoice.paymentTermsDays} days` : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sent By</dt>
                  <dd>—</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sent On</dt>
                  <dd>—</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email Opened</dt>
                  <dd>—</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Stripe Payment Link */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Payment Link</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentLinkUrl ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={paymentLinkUrl}
                    readOnly
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    aria-label="Copy payment link"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleGenerateLink}
                  disabled={generatingLink}
                >
                  {generatingLink ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LinkIcon className="size-4" />
                  )}
                  Generate Payment Link
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Total</span>
                  <span className="tabular-nums">{fmtMoney(invoice.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="tabular-nums">{fmtMoney(paidNum.toFixed(2))}</span>
                </div>
                <div className="my-2 h-px bg-border" />
                <div className="flex justify-between font-semibold">
                  <span>Balance Due</span>
                  <span className={balanceNum > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                    {fmtMoney(invoice.balance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Payment#</th>
                        <th className="px-3 py-2 font-medium">Method</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Received On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoice.allocations.map((a) => (
                        <tr key={a.id}>
                          <td className="px-3 py-2">
                            <Link
                              href={`/payments/${a.paymentId}`}
                              className="font-medium hover:underline"
                            >
                              {`PAY-${a.paymentNo}`}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{a.method}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtMoney(a.amountApplied)}
                          </td>
                          <td className="px-3 py-2">{fmtDate(a.receivedOn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete invoice */}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete Invoice
                </Button>
              }
            />
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete this invoice?</DialogTitle>
                <DialogDescription>
                  Invoice {`#INV-${invoice.invoiceNo}`} and its line items will be permanently
                  removed. Recorded payments stay on the ledger and become unallocated. This
                  can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="mr-1 size-4 animate-spin" />}
                  Delete Invoice
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
