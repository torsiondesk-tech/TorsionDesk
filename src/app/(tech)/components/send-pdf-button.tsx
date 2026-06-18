'use client'

import { useState } from 'react'
import { Mail, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { enqueueOutboxItem, flushOutbox } from '@/app/(tech)/lib/sync'
import { sendCustomerCommunicationAction } from '@/app/(tech)/tech/invoices/actions'
import { toast } from 'sonner'

interface SendPdfButtonProps {
  orgId: string
  userId: string
  kind: 'estimate' | 'invoice'
  refId: string
  customerEmail?: string | null
  customerPhone?: string | null
}

export function SendPdfButton({
  orgId,
  userId,
  kind,
  refId,
  customerEmail,
  customerPhone,
}: SendPdfButtonProps) {
  const online = useOnline()
  const [email, setEmail] = useState(true)
  const [sms, setSms] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSend() {
    if (!email && !sms) {
      toast.error('Choose email or text before sending')
      return
    }

    setBusy(true)

    try {
      const channels: Array<'email' | 'sms'> = []
      if (email) channels.push('email')
      if (sms) channels.push('sms')

      if (online) {
        for (const channel of channels) {
          const to = channel === 'email' ? customerEmail ?? '' : customerPhone ?? ''
          const result = await sendCustomerCommunicationAction({
            kind,
            refId,
            channel,
            to,
            subject: kind === 'invoice' ? 'Your invoice' : 'Your estimate',
          })
          if (!result.success) {
            toast.error(result.error)
            return
          }
        }
        toast.success('PDF sent')
      } else {
        for (const channel of channels) {
          await enqueueOutboxItem(orgId, {
            type: 'send_record',
            payload: { kind, refId, channel },
          })
        }
        toast.info('Queued to send when online')
      }

      void flushOutbox(orgId, userId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-sm font-medium">Send {kind === 'invoice' ? 'Invoice' : 'Estimate'} PDF</p>
      <div className="mb-4 flex gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="send-email"
            checked={email}
            onCheckedChange={(v) => setEmail(v === true)}
          />
          <Label htmlFor="send-email" className="flex items-center gap-1 text-sm">
            <Mail className="size-4" aria-hidden="true" /> Email
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="send-sms"
            checked={sms}
            onCheckedChange={(v) => setSms(v === true)}
          />
          <Label htmlFor="send-sms" className="flex items-center gap-1 text-sm">
            <MessageSquare className="size-4" aria-hidden="true" /> Text
          </Label>
        </div>
      </div>
      <Button onClick={handleSend} disabled={busy || (!email && !sms)} className="w-full">
        <Send className="mr-2 size-4" aria-hidden="true" />
        {online ? 'Send now' : 'Queue to send'}
      </Button>
    </div>
  )
}
