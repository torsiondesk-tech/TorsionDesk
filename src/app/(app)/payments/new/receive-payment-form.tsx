'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { recordPaymentAction } from '../actions'
import type { OpenInvoiceRow } from '../actions'

interface ReceivePaymentFormProps {
  orgId: string
  customerId: string
  openInvoices: OpenInvoiceRow[]
  paymentMethods: Array<{ id: string; name: string; isSystem: boolean; isActive: boolean; sortOrder: number }>
  defaultInvoiceId?: string
  defaultJobId?: string
  defaultJobNo?: number
  isDeposit?: boolean
}

function todayInputValue(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtMoney(value: string | number | null | undefined): string {
  if (value == null) return '$0.00'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

function toCents(value: string | number | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

export function ReceivePaymentForm({
  orgId,
  customerId,
  openInvoices,
  paymentMethods,
  defaultInvoiceId,
  defaultJobId,
  defaultJobNo,
  isDeposit,
}: ReceivePaymentFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [paymentAmount, setPaymentAmount] = useState('')
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [selectedMethodId, setSelectedMethodId] = useState('')
  const [receivedOn, setReceivedOn] = useState(todayInputValue())
  const [checkRefNo, setCheckRefNo] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const activeMethods = useMemo(
    () => paymentMethods.filter((m) => m.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [paymentMethods],
  )

  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId)

  useEffect(() => {
    const cents = toCents(paymentAmount)
    if (cents <= 0) {
      const reset: Record<string, string> = {}
      for (const inv of openInvoices) {
        reset[inv.id] = defaultInvoiceId === inv.id ? inv.balance : '0.00'
      }
      setAllocations(reset)
      return
    }
    let remaining = cents
    const newAllocs: Record<string, string> = {}
    for (const inv of openInvoices) {
      const balanceCents = toCents(inv.balance)
      const apply = Math.min(balanceCents, remaining)
      newAllocs[inv.id] = (apply / 100).toFixed(2)
      remaining = Math.max(0, remaining - apply)
    }
    setAllocations(newAllocs)
  }, [paymentAmount, openInvoices, defaultInvoiceId])

  const { totalOutstanding, totalApplied, owedAfterPayment, isOverApplied, isOverPayment } = useMemo(() => {
    const outstanding = openInvoices.reduce((sum, inv) => sum + toCents(inv.balance), 0) / 100
    const applied = Object.values(allocations).reduce((sum, v) => sum + toCents(v), 0) / 100
    const amount = toCents(paymentAmount) / 100
    return {
      totalOutstanding: outstanding,
      totalApplied: applied,
      owedAfterPayment: Math.max(0, outstanding - applied),
      isOverApplied: applied > amount + 0.001,
      isOverPayment: amount > outstanding + 0.001,
    }
  }, [openInvoices, allocations, paymentAmount])

  useEffect(() => {
    if (isOverApplied) {
      setError("Total to Be Applied can't exceed the Amount of Payment. Adjust the per-invoice amounts.")
    } else if (isOverPayment) {
      setError(`Amount of payment (${fmtMoney(paymentAmount)}) exceeds the total outstanding balance (${fmtMoney(totalOutstanding)}).`)
    } else {
      setError(null)
    }
  }, [isOverApplied, isOverPayment, paymentAmount, totalOutstanding])

  const handleAllocationChange = (invoiceId: string, value: string) => {
    setAllocations((prev) => ({ ...prev, [invoiceId]: value }))
  }

  const handleSubmit = () => {
    if (isOverApplied || isOverPayment) return
    const payload = {
      customerId,
      methodId: selectedMethodId,
      amount: paymentAmount,
      receivedOn,
      checkRefNo,
      receivedBy,
      memo,
      allocations: Object.entries(allocations)
        .filter(([, v]) => toCents(v) > 0)
        .map(([invoiceId, amountApplied]) => ({ invoiceId, amountApplied })),
    }

    startTransition(async () => {
      const result = await recordPaymentAction(orgId, payload)
      if (result.error || !result.paymentId) {
        toast.error(result.error ?? "Couldn't record the payment.")
        return
      }
      toast.success(`Payment #PAY-${result.paymentNo} recorded — $${Number(payload.amount).toFixed(2)} applied.`)
      router.push(`/payments/${result.paymentId}`)
    })
  }

  const handleDepositSubmit = () => {
    if (!defaultJobId) return
    const payload = {
      customerId,
      methodId: selectedMethodId,
      amount: paymentAmount,
      jobId: defaultJobId,
      receivedOn,
      checkRefNo,
      receivedBy,
      memo,
      allocations: [],
    }

    startTransition(async () => {
      const result = await recordPaymentAction(orgId, payload)
      if (result.error || !result.paymentId) {
        toast.error(result.error ?? "Couldn't record the deposit.")
        return
      }
      toast.success(
        `Deposit of $${Number(payload.amount).toFixed(2)} recorded on ${defaultJobNo != null ? `#JOB-${defaultJobNo}` : 'job'}.`,
      )
      router.push(`/payments/${result.paymentId}`)
    })
  }

  const isSquareMethod = selectedMethod?.name === 'On-Site Card (Square)'
  const isStripeMethod = selectedMethod?.name === 'Credit Card (Stripe)'
  const canSubmit =
    !pending &&
    selectedMethodId &&
    toCents(paymentAmount) > 0 &&
    !isOverApplied &&
    !isOverPayment &&
    !isSquareMethod

  if (isDeposit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => router.push(defaultJobId ? `/jobs/${defaultJobId}` : '/invoices')}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <h1 className="text-3xl font-semibold">Record Deposit</h1>
        <DepositForm />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Receive a Payment</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="method">Method</Label>
                <Select value={selectedMethodId} onValueChange={(v) => setSelectedMethodId(v ?? '')}>
                  <SelectTrigger id="method" className="w-full">
                    <SelectValue placeholder="Select a payment method">
                      {selectedMethodId
                        ? (activeMethods.find(m => m.id === selectedMethodId)?.name ?? selectedMethodId)
                        : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {activeMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isStripeMethod && (
                  <p className="text-sm text-muted-foreground">
                    A payment link will be sent — no manual entry needed.
                  </p>
                )}
                {isSquareMethod && (
                  <p className="text-sm text-destructive">
                    Available from the tech app only.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount of Payment</Label>
                <Input
                  id="amount"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="received-by">Received By</Label>
                  <Input
                    id="received-by"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    placeholder="e.g. Office"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="received-on">Received On</Label>
                  <Input
                    id="received-on"
                    type="date"
                    value={receivedOn}
                    onChange={(e) => setReceivedOn(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="check-ref">Check / Reference #</Label>
                <Input
                  id="check-ref"
                  value={checkRefNo}
                  onChange={(e) => setCheckRefNo(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memo">Memo</Label>
                <Input
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Optional note"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Open Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {openInvoices.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This customer has no open invoices to apply a payment to.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => router.push('/invoices')}>
                    Back to Invoices
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Invoice#</th>
                        <th className="px-3 py-2 font-medium">Invoice Date</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 text-right font-medium">Balance</th>
                        <th className="px-3 py-2 text-right font-medium">Amount To Apply</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {openInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="px-3 py-2 font-medium">{`INV-${inv.invoiceNo}`}</td>
                          <td className="px-3 py-2">{inv.invoiceDate ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtMoney(inv.total)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtMoney(inv.balance)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              className="w-32 text-right tabular-nums"
                              value={allocations[inv.id] ?? '0.00'}
                              onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                            />
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

        <div className="lg:sticky lg:top-4 h-fit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Outstanding</span>
                  <span className="tabular-nums">{fmtMoney(totalOutstanding)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount of Payment</span>
                  <span className="tabular-nums">{fmtMoney(paymentAmount || '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total to Be Applied</span>
                  <span className="tabular-nums">{fmtMoney(totalApplied)}</span>
                </div>
                <div className="my-2 h-px bg-border" />
                <div className="flex justify-between font-semibold">
                  <span>Owed After Payment</span>
                  <span className="tabular-nums">{fmtMoney(owedAfterPayment)}</span>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                className="w-full"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
                Record Payment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )

  function DepositForm() {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Deposit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-method">Method</Label>
              <Select value={selectedMethodId} onValueChange={(v) => setSelectedMethodId(v ?? '')}>
                <SelectTrigger id="deposit-method" className="w-full">
                  <SelectValue placeholder="Select a payment method">
                    {selectedMethodId
                      ? (activeMethods.find(m => m.id === selectedMethodId)?.name ?? selectedMethodId)
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeMethods
                    .filter((m) => !m.isSystem)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Amount</Label>
              <Input
                id="deposit-amount"
                type="number"
                step="1"
                min="0"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deposit-received-by">Received By</Label>
                <Input
                  id="deposit-received-by"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="e.g. Office"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit-received-on">Received On</Label>
                <Input
                  id="deposit-received-on"
                  type="date"
                  value={receivedOn}
                  onChange={(e) => setReceivedOn(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit-check-ref">Check / Reference #</Label>
              <Input
                id="deposit-check-ref"
                value={checkRefNo}
                onChange={(e) => setCheckRefNo(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit-memo">Memo</Label>
              <Input
                id="deposit-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Optional note"
              />
            </div>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-4 h-fit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Deposit Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Deposit Amount</span>
                  <span className="tabular-nums">{fmtMoney(paymentAmount || '0')}</span>
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!selectedMethodId || toCents(paymentAmount) <= 0 || pending}
                onClick={handleDepositSubmit}
              >
                {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
                Record Deposit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
}
