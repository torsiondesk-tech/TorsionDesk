import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPaymentAction } from '../actions'
import { Pencil } from 'lucide-react'

interface PaymentDetailPageProps {
  params: Promise<{ id: string }>
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function fmtMoney(value: string | number | null | undefined): string {
  if (value == null) return '$0.00'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

export default async function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) redirect('/sign-in')

  const { id } = await params
  const payment = await getPaymentAction(orgId, id)
  if (!payment) notFound()

  return (
    <div className="animate-in fade-in-0 duration-300 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          Payment #{`PAY-${payment.paymentNo}`}
        </h1>
        <Link href={`/payments/new?paymentId=${payment.id}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="size-4" />
            Edit Payment
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">From Customer</CardTitle>
            </CardHeader>
            <CardContent>
              {payment.customerId ? (
                <Link
                  href={`/customers/${payment.customerId}`}
                  className="text-lg font-medium hover:underline"
                >
                  {payment.customerName ?? 'Customer'}
                </Link>
              ) : (
                <span className="text-lg font-medium">{payment.customerName ?? '—'}</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Method</dt>
                  <dd>
                    <Badge variant="outline">{payment.method}</Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="font-semibold tabular-nums">{fmtMoney(payment.amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Received On</dt>
                  <dd>{fmtDate(payment.receivedOn)}</dd>
                </div>
                {payment.checkRefNo && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Check/Reference#</dt>
                    <dd>{payment.checkRefNo}</dd>
                  </div>
                )}
                {payment.transactionToken && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Transaction Token</dt>
                    <dd className="font-mono text-xs">{payment.transactionToken}</dd>
                  </div>
                )}
                {payment.squarePaymentId && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Square Payment ID</dt>
                    <dd className="font-mono text-xs">{payment.squarePaymentId}</dd>
                  </div>
                )}
                {payment.memo && (
                  <div className="pt-2">
                    <dt className="text-muted-foreground">Memo</dt>
                    <dd className="mt-1">{payment.memo}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            Entered {fmtDateTime(payment.enteredAt)} by {payment.enteredByUserId ?? '—'}
          </p>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Invoice Allocations</CardTitle>
            </CardHeader>
            <CardContent>
              {payment.allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoice allocations.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Invoice#</th>
                        <th className="px-3 py-2 font-medium">Customer</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 text-right font-medium">Amount Applied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payment.allocations.map((a) => (
                        <tr key={a.id}>
                          <td className="px-3 py-2">
                            <Link
                              href={`/invoices/${a.invoiceId}`}
                              className="font-medium hover:underline"
                            >
                              {`INV-${a.invoiceNo}`}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{payment.customerName ?? '—'}</td>
                          <td className="px-3 py-2">
                            {a.jobNo != null
                              ? `For Job(s): #JOB-${a.jobNo}`
                              : 'For invoice'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtMoney(a.amountApplied)}
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
      </div>
    </div>
  )
}
