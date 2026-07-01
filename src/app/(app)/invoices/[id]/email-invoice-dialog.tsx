'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Image, Loader2, Mail, X } from 'lucide-react'
import { RichTextEditor, type RichTextEditorHandle } from '@/components/rich-text-editor'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getInvoiceEmailDefaults,
  getJobPhotosForEmailAction,
  sendInvoiceAction,
} from '../actions'
import { previewTemplateAction } from './preview-template-action'
import { listTemplatesAction } from '@/app/(app)/settings/communication-templates/actions'
import type { CommunicationTemplate } from '@/app/(app)/settings/communication-templates/actions'

interface Props {
  invoice: { id: string; tenantId: string; invoiceNo: number }
  open: boolean
  onOpenChange: (v: boolean) => void
}

interface ContactInfo {
  id: string
  name: string
  email: string
}

interface PhotoInfo {
  id: string
  url: string
}

type Tab = 'body' | 'pics' | 'docs' | 'preview'

const DEFAULT_TEMPLATE_ID = '__default__'

export function EmailInvoiceDialog({ invoice, open, onOpenChange }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  // From / sender info
  const [fromEmail, setFromEmail] = useState('')
  const [senderDisplay, setSenderDisplay] = useState('')

  // To — chip-based multi-select
  const [toChips, setToChips] = useState<string[]>([])
  const [toInput, setToInput] = useState('')
  const [contactsOpen, setContactsOpen] = useState(false)
  const [customerContacts, setCustomerContacts] = useState<ContactInfo[]>([])
  const toInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<RichTextEditorHandle>(null)

  // Template + Subject
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID)
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState('Invoice (Default)')
  const [subject, setSubject] = useState('')
  const [defaultSubject, setDefaultSubject] = useState('')

  // Options
  const [bccMe, setBccMe] = useState(false)
  const [attachPdf, setAttachPdf] = useState(true)

  // Tabs + Photos
  const [activeTab, setActiveTab] = useState<Tab>('body')
  const [jobId, setJobId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoInfo[] | null>(null)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])

  // Preview
  const [preview, setPreview] = useState<{
    subject: string
    bodyHtml: string
    unknownTags: string[]
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load defaults on open
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setToChips([])
    setToInput('')
    setSelectedTemplateId(DEFAULT_TEMPLATE_ID)
    setSelectedTemplateLabel('Invoice (Default)')
    setSubject('')
    setDefaultSubject('')
    editorRef.current?.clearContent()
    setBccMe(false)
    setAttachPdf(true)
    setActiveTab('body')
    setSelectedPhotoIds([])
    setPhotos(null)
    setJobId(null)
    setPreview(null)
    setPreviewLoading(false)

    Promise.all([
      getInvoiceEmailDefaults(invoice.tenantId, invoice.id),
      listTemplatesAction(invoice.tenantId, 'invoice'),
    ])
      .then(([d, tpls]) => {
        setFromEmail(d.fromEmail)
        setSenderDisplay(d.senderDisplay)
        setCustomerContacts(d.customerContacts)
        setJobId(d.jobId)
        setTemplates(tpls)
        setToChips(d.to ? [d.to] : [])
        setSubject(d.subject)
        setDefaultSubject(d.subject)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice.tenantId, invoice.id])

  // Lazy-load photos when Pics tab is first opened
  useEffect(() => {
    if (activeTab !== 'pics' || photos !== null || !jobId || photosLoading) return
    setPhotosLoading(true)
    getJobPhotosForEmailAction(invoice.tenantId, jobId)
      .then(setPhotos)
      .finally(() => setPhotosLoading(false))
  }, [activeTab, photos, jobId, photosLoading, invoice.tenantId])

  // Render preview when the Preview tab is active or content changes while previewing
  useEffect(() => {
    if (activeTab !== 'preview') return
    setPreviewLoading(true)
    const bodyHtml = editorRef.current?.getHTML() ?? ''
    previewTemplateAction(invoice.tenantId, invoice.id, {
      subject,
      bodyHtml: bodyHtml && bodyHtml !== '<p></p>' ? bodyHtml : null,
    })
      .then(setPreview)
      .catch(() => toast.error('Could not generate preview.'))
      .finally(() => setPreviewLoading(false))
  }, [activeTab, subject, invoice.tenantId, invoice.id])

  function addEmail(email: string) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) return
    if (toChips.includes(trimmed)) return
    setToChips((prev) => [...prev, trimmed])
  }

  function removeChip(email: string) {
    setToChips((prev) => prev.filter((e) => e !== email))
  }

  function handleToKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addEmail(toInput)
      setToInput('')
    } else if (e.key === 'Backspace' && !toInput && toChips.length > 0) {
      setToChips((prev) => prev.slice(0, -1))
    }
  }

  function handleTemplateChange(templateId: string | null) {
    const id = templateId ?? DEFAULT_TEMPLATE_ID
    setSelectedTemplateId(id)
    if (id === DEFAULT_TEMPLATE_ID) {
      setSelectedTemplateLabel('Invoice (Default)')
      setSubject(defaultSubject)
      editorRef.current?.clearContent()
      return
    }
    const tpl = templates.find((t) => t.id === id)
    if (tpl) {
      setSelectedTemplateLabel(tpl.name)
      if (tpl.subject) setSubject(tpl.subject)
      editorRef.current?.setContent(tpl.body ?? '')
    }
  }

  function togglePhoto(id: string) {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  function handleSend() {
    if (toChips.length === 0) return
    startTransition(async () => {
      const [primaryTo, ...extraTo] = toChips
      const rawHtml = editorRef.current?.getHTML() ?? ''
      const hasBody = rawHtml && rawHtml !== '<p></p>' && rawHtml.trim() !== ''

      const result = await sendInvoiceAction(invoice.tenantId, invoice.id, {
        to: primaryTo,
        toExtra: extraTo.length ? extraTo : undefined,
        bcc: bccMe ? fromEmail : undefined,
        subject: subject.trim() || undefined,
        bodyHtml: hasBody ? rawHtml : undefined,
        attachPdf,
        photoIds: selectedPhotoIds.length ? selectedPhotoIds : undefined,
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
      <DialogContent className="w-full max-w-xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" />
            Email Invoice #{invoice.invoiceNo}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 space-y-3 pb-2">
            {/* ── From + BCC ─────────────────────────────────────────── */}
            <div className="flex items-end gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">From</Label>
                <div className="flex h-9 w-full items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground truncate opacity-70 select-none">
                  {senderDisplay || '—'}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer mb-1.5 shrink-0">
                <Checkbox checked={bccMe} onCheckedChange={(v) => setBccMe(!!v)} />
                <span className="text-sm">BCC Me</span>
              </label>
            </div>

            {/* ── To chips ───────────────────────────────────────────── */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">To</Label>
              <div className="flex items-start gap-2">
                <div
                  className="flex-1 flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2 min-h-9 cursor-text focus-within:ring-1 focus-within:ring-ring"
                  onClick={() => toInputRef.current?.focus()}
                >
                  {toChips.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeChip(email)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    ref={toInputRef}
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={handleToKeyDown}
                    onBlur={() => {
                      if (toInput) {
                        addEmail(toInput)
                        setToInput('')
                      }
                    }}
                    className="flex-1 min-w-0 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
                    placeholder={toChips.length === 0 ? 'customer@example.com' : ''}
                  />
                </div>

                {customerContacts.length > 0 && (
                  <Popover open={contactsOpen} onOpenChange={setContactsOpen}>
                    <PopoverTrigger
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 gap-1 shrink-0')}
                    >
                      Other Contacts
                      <ChevronDown className="size-3" />
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-1" align="end">
                      {customerContacts.map((c) => (
                        <button
                          key={c.email}
                          type="button"
                          onClick={() => {
                            addEmail(c.email)
                            setContactsOpen(false)
                          }}
                          className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        >
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            {/* ── Template ───────────────────────────────────────────── */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="w-full h-9">
                  <span className="truncate text-sm">{selectedTemplateLabel}</span>
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

            {/* ── Subject ────────────────────────────────────────────── */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Invoice subject line"
                className="h-9"
              />
            </div>

            {/* ── Body / Pics / Docs tabs ────────────────────────────── */}
            <div className="space-y-0">
              <div className="flex border-b">
                {(['body', 'pics', 'docs', 'preview'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors capitalize',
                      activeTab === tab
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab === 'body' ? 'Body' : tab === 'pics' ? 'Pics' : tab === 'docs' ? 'Docs' : 'Preview'}
                    {tab === 'pics' && selectedPhotoIds.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold w-4 h-4">
                        {selectedPhotoIds.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {activeTab === 'body' && (
                <div className="rounded-b-md rounded-tr-md border border-t-0">
                  <RichTextEditor ref={editorRef} minHeight="160px" />
                  {selectedTemplateId === DEFAULT_TEMPLATE_ID && (
                    <p className="px-3 pb-2 pt-1 text-[11px] text-muted-foreground">
                      Leave empty to use the standard invoice email layout with PDF.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'pics' && (
                <div className="border border-t-0 rounded-b-md rounded-tr-md min-h-[160px]">
                  {photosLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : !photos || photos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                      <Image className="size-8 opacity-30" />
                      <p className="text-sm">No photos on this job.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 p-3">
                      {photos.map((photo) => {
                        const selected = selectedPhotoIds.includes(photo.id)
                        return (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => togglePhoto(photo.id)}
                            className={cn(
                              'relative aspect-square overflow-hidden rounded-md border-2 transition-all',
                              selected ? 'border-primary shadow-sm' : 'border-transparent hover:border-muted-foreground/30',
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.url}
                              alt="Job photo"
                              className="object-cover w-full h-full"
                            />
                            {selected && (
                              <div className="absolute inset-0 bg-primary/10 flex items-end justify-end p-1">
                                <div className="bg-primary rounded-full p-0.5">
                                  <Check className="size-2.5 text-primary-foreground" />
                                </div>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {selectedPhotoIds.length > 0 && (
                    <p className="text-xs text-muted-foreground px-3 pb-2">
                      {selectedPhotoIds.length} photo{selectedPhotoIds.length !== 1 ? 's' : ''} will be attached (max 5).
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="border border-t-0 rounded-b-md rounded-tr-md flex items-center justify-center h-40 text-muted-foreground">
                  <p className="text-sm">No documents on this job.</p>
                </div>
              )}

              {activeTab === 'preview' && (
                <div className="border border-t-0 rounded-b-md rounded-tr-md min-h-[160px] max-h-[320px] overflow-y-auto p-3 space-y-3">
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : preview ? (
                    <>
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Subject</p>
                        <p className="text-sm">{preview.subject || '<em className="text-muted-foreground">No subject</em>'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Body</p>
                        <div
                          className="text-sm"
                          dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                        />
                      </div>
                      {preview.unknownTags.length > 0 && (
                        <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          Unknown tags: {preview.unknownTags.join(', ')}
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>

            {/* ── Attach as PDF ──────────────────────────────────────── */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <Checkbox checked={attachPdf} onCheckedChange={(v) => setAttachPdf(!!v)} />
              <span className="text-sm">Attach as PDF</span>
            </label>
          </div>
        )}

        <DialogFooter className="px-5 py-3 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || isPending || toChips.length === 0}
          >
            {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
