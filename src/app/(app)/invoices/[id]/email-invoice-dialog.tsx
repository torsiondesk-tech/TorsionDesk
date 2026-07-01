'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getInvoiceEmailDefaults, sendInvoiceAction } from '../actions'
import { listTemplatesAction } from '@/app/(app)/settings/communication-templates/actions'
import type { CommunicationTemplate } from '@/app/(app)/settings/communication-templates/actions'

interface Props {
  invoice: { id: string; tenantId: string; invoiceNo: number }
  open: boolean
  onOpenChange: (v: boolean) => void
}

interface Defaults {
  to: string | null
  subject: string
  senderDisplay: string
  currentUserEmail: string | null
}

const DEFAULT_TEMPLATE_ID = '__default__'

export function EmailInvoiceDialog({ invoice, open, onOpenChange }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [loading, setLoading] = useState(false)
  const [defaults, setDefaults] = useState<Defaults | null>(null)
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])

  // Form state
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID)
  const [bccMe, setBccMe] = useState(false)
  const [attachPdf, setAttachPdf] = useState(true)

  // Load defaults and templates when dialog opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      getInvoiceEmailDefaults(invoice.tenantId, invoice.id),
      listTemplatesAction(invoice.tenantId, 'invoice'),
    ])
      .then(([d, t]) => {
        setDefaults(d)
        setTemplates(t)
        setTo(d.to ?? '')
        setSubject(d.subject)
        setBody('')
        setSelectedTemplateId(DEFAULT_TEMPLATE_ID)
        setBccMe(false)
        setAttachPdf(true)
      })
      .finally(() => setLoading(false))
  }, [open, invoice.tenantId, invoice.id])

  function handleTemplateChange(templateId: string | null) {
    const id = templateId ?? DEFAULT_TEMPLATE_ID
    setSelectedTemplateId(id)
    if (id === DEFAULT_TEMPLATE_ID) {
      setSubject(defaults?.subject ?? '')
      setBody('')
      return
    }
    const tpl = templates.find((t) => t.id === id)
    if (tpl) {
      if (tpl.subject) setSubject(tpl.subject)
      setBody(tpl.body ?? '')
    }
  }

  function handleSend() {
    startTransition(async () => {
      const result = await sendInvoiceAction(invoice.tenantId, invoice.id, {
        to: to.trim() || undefined,
        bcc: bccMe && defaults?.currentUserEmail ? defaults.currentUserEmail : undefined,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
        attachPdf,
      })
      if (result.success) {
        toast('Invoice email sent.')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Failed to send email.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Email Invoice #{invoice.invoiceNo}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* From (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">From</Label>
              <p className="text-sm text-foreground">{defaults?.senderDisplay ?? '—'}</p>
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <Label htmlFor="email-to" className="text-xs font-medium">
                To
              </Label>
              <Input
                id="email-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            {/* Template */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_TEMPLATE_ID}>Invoice (Default)</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="email-subject" className="text-xs font-medium">
                Subject
              </Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Invoice subject line"
              />
            </div>

            {/* Body — only shown / editable when a custom template is selected */}
            {selectedTemplateId !== DEFAULT_TEMPLATE_ID && (
              <div className="space-y-1.5">
                <Label htmlFor="email-body" className="text-xs font-medium">
                  Message
                </Label>
                <Textarea
                  id="email-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Email body text…"
                  className="resize-none text-sm"
                />
              </div>
            )}

            {selectedTemplateId === DEFAULT_TEMPLATE_ID && (
              <p className="text-xs text-muted-foreground">
                Uses the standard invoice email layout with PDF attachment.
              </p>
            )}

            {/* Options row */}
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={bccMe}
                  onCheckedChange={(v) => setBccMe(!!v)}
                />
                <span className="text-sm">
                  BCC Me{defaults?.currentUserEmail ? ` (${defaults.currentUserEmail})` : ''}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={attachPdf}
                  onCheckedChange={(v) => setAttachPdf(!!v)}
                />
                <span className="text-sm">Attach as PDF</span>
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading || isPending || !to.trim()}>
            {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
