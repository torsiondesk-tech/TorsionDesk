'use client'

import { useEffect, useRef, useState } from 'react'
import { CreditCard, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'
import { squarePaymentAction } from '@/app/(tech)/tech/invoices/actions'
import { toast } from 'sonner'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Square?: any
  }
}

interface SquarePayButtonProps {
  orgId: string
  userId: string
  invoiceId: string
  amount: number
}

export function SquarePayButton({ orgId, userId, invoiceId, amount }: SquarePayButtonProps) {
  const online = useOnline()
  const [loading, setLoading] = useState(false)
  const [manualNote, setManualNote] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!online || amount <= 0 || initializedRef.current || typeof window === 'undefined') return

    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID
    if (!appId || !locationId) {
      toast.error('Square is not configured')
      return
    }

    async function init() {
      if (!window.Square || !containerRef.current) return
      try {
        const payments = window.Square.payments(appId, locationId)
        const paymentRequest = payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: {
            amount: (amount / 100).toFixed(2),
            label: 'Invoice total',
          },
        })

        let tokenized = false

        async function onTokenize(source: { tokenize: () => Promise<{ status: string; token?: string; errors?: unknown }> }) {
          if (tokenized) return
          tokenized = true
          setLoading(true)
          try {
            const result = await source.tokenize()
            if (result.status !== 'OK' || !result.token) {
              toast.error('Payment tokenization failed')
              return
            }
            const actionResult = await squarePaymentAction({
              invoiceId,
              sourceId: result.token,
              amount,
            })
            if (!actionResult.success) {
              toast.error(actionResult.error)
            } else {
              toast.success('Payment accepted')
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Payment failed')
          } finally {
            setLoading(false)
            tokenized = false
          }
        }

        containerRef.current.innerHTML = ''

        const applePay = await payments.applePay(paymentRequest)
        const appleBtn = document.createElement('button')
        appleBtn.type = 'button'
        appleBtn.className = 'w-full'
        appleBtn.innerHTML = 'Pay with Apple Pay'
        appleBtn.addEventListener('click', () => onTokenize(applePay))
        containerRef.current.appendChild(appleBtn)

        const googlePay = await payments.googlePay(paymentRequest)
        const googleBtn = document.createElement('button')
        googleBtn.type = 'button'
        googleBtn.className = 'w-full'
        googleBtn.innerHTML = 'Pay with Google Pay'
        googleBtn.addEventListener('click', () => onTokenize(googlePay))
        containerRef.current.appendChild(googleBtn)

        const card = await payments.card()
        await card.attach(containerRef.current)
        const cardBtn = document.createElement('button')
        cardBtn.type = 'button'
        cardBtn.className = 'w-full mt-2'
        cardBtn.innerHTML = `Pay ${formatMoney(amount)}`
        cardBtn.addEventListener('click', () => onTokenize(card))
        containerRef.current.appendChild(cardBtn)

        initializedRef.current = true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load Square payments')
      }
    }

    if (window.Square) {
      void init()
    } else {
      const script = document.createElement('script')
      script.src = 'https://sandbox.web.squarecdn.com/v1/square.js'
      script.async = true
      script.onload = () => void init()
      script.onerror = () => toast.error('Could not load Square payments')
      document.body.appendChild(script)
      return () => {
        document.body.removeChild(script)
      }
    }
  }, [online, amount, invoiceId])

  async function handleManualPayment() {
    if (!manualNote.trim()) {
      toast.error('Add a note about the cash or check payment')
      return
    }
    await enqueueOutboxItem(orgId, {
      type: 'manual_payment',
      payload: {
        invoiceId,
        method: 'cash',
        note: manualNote.trim(),
      },
    })
    setManualNote('')
    toast.info('Manual payment note queued')
    void flushOutbox(orgId, userId)
  }

  if (!online) {
    return (
      <Card className="border-muted">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <CreditCard className="size-5 shrink-0" aria-hidden="true" />
            <p>
              <strong>No internet connection</strong> — collect cash or check, or ask the
              customer to pay online later.
            </p>
          </div>
          <Textarea
            placeholder="Cash/check payment note"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
          />
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleManualPayment}
            disabled={!manualNote.trim()}
          >
            Queue manual payment note
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (amount <= 0) {
    return (
      <Card className="border-muted">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Nothing to pay.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="size-4" aria-hidden="true" />
          Pay {formatMoney(amount)}
        </div>
        <div ref={containerRef} className="space-y-2" />
        {loading && (
          <p className="text-center text-sm text-muted-foreground">Processing…</p>
        )}
      </CardContent>
    </Card>
  )
}

function formatMoney(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}
