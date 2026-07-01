'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Check,
  ChevronDown,
  Image,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Mail,
  Redo,
  Strikethrough,
  Undo,
  X,
} from 'lucide-react'
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

type Tab = 'body' | 'pics' | 'docs'

const DEFAULT_TEMPLATE_ID = '__default__'

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={cn(
        'rounded p-1.5 transition-colors',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

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

  // Template + Subject
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID)
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

  // Tiptap editor
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
    },
  })

  // Load defaults on open
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setToChips([])
    setToInput('')
    setSelectedTemplateId(DEFAULT_TEMPLATE_ID)
    setSubject('')
    setDefaultSubject('')
    editor?.commands.clearContent()
    setBccMe(false)
    setAttachPdf(true)
    setActiveTab('body')
    setSelectedPhotoIds([])
    setPhotos(null)
    setJobId(null)

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
      setSubject(defaultSubject)
      editor?.commands.clearContent()
      return
    }
    const tpl = templates.find((t) => t.id === id)
    if (tpl) {
      if (tpl.subject) setSubject(tpl.subject)
      editor?.commands.setContent(tpl.body ?? '')
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
      const rawHtml = editor?.getHTML() ?? ''
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
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
          <div className="overflow-y-auto flex-1 px-5 space-y-3 pb-2">
            {/* ── From + BCC ─────────────────────────────────────────── */}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">From</Label>
                <Select value="__from__" disabled>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue>{senderDisplay}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__from__">{senderDisplay}</SelectItem>
                  </SelectContent>
                </Select>
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
                    className="flex-1 min-w-36 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
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
                <SelectTrigger className="h-9">
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
                {(['body', 'pics', 'docs'] as Tab[]).map((tab) => (
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
                    {tab === 'body' ? 'Body' : tab === 'pics' ? 'Pics' : 'Docs'}
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
                  {/* Toolbar */}
                  <div className="flex items-center gap-0.5 border-b px-2 py-1 bg-muted/30">
                    <ToolbarBtn
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      active={editor?.isActive('bold') ?? false}
                      title="Bold"
                    >
                      <Bold className="size-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      active={editor?.isActive('italic') ?? false}
                      title="Italic"
                    >
                      <Italic className="size-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                      onClick={() => editor?.chain().focus().toggleStrike().run()}
                      active={editor?.isActive('strike') ?? false}
                      title="Strikethrough"
                    >
                      <Strikethrough className="size-3.5" />
                    </ToolbarBtn>
                    <div className="w-px h-4 bg-border mx-0.5" />
                    <ToolbarBtn
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}
                      active={editor?.isActive('bulletList') ?? false}
                      title="Bullet list"
                    >
                      <List className="size-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                      active={editor?.isActive('orderedList') ?? false}
                      title="Ordered list"
                    >
                      <ListOrdered className="size-3.5" />
                    </ToolbarBtn>
                    <div className="w-px h-4 bg-border mx-0.5" />
                    <ToolbarBtn
                      onClick={() => editor?.chain().focus().undo().run()}
                      active={false}
                      title="Undo"
                    >
                      <Undo className="size-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                      onClick={() => editor?.chain().focus().redo().run()}
                      active={false}
                      title="Redo"
                    >
                      <Redo className="size-3.5" />
                    </ToolbarBtn>
                    {selectedTemplateId === DEFAULT_TEMPLATE_ID && (
                      <span className="ml-auto text-[11px] text-muted-foreground pr-1">
                        Uses standard invoice layout when empty
                      </span>
                    )}
                  </div>
                  <div className="tiptap-content">
                    <EditorContent editor={editor} />
                  </div>
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
