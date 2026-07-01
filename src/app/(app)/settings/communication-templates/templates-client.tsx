'use client'

import { useRef, useState, useTransition } from 'react'
import { ChevronRight, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor, type RichTextEditorHandle } from '@/components/rich-text-editor'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
} from './actions'
import { TagPicker } from './tag-picker'
import type { CommunicationTemplate } from './actions'

// ── Sidebar tree structure ─────────────────────────────────────────────────────

const TEMPLATE_TYPES = [
  { category: 'invoice',  channel: 'email', label: 'Invoice Email' },
  { category: 'invoice',  channel: 'sms',   label: 'Invoice Text Message' },
  { category: 'estimate', channel: 'email', label: 'Estimate Email' },
  { category: 'estimate', channel: 'sms',   label: 'Estimate Text Message' },
  { category: 'job',      channel: 'email', label: 'Job/WO Email' },
  { category: 'job',      channel: 'sms',   label: 'Job/WO Text Message' },
  { category: 'general',  channel: 'email', label: 'General Email' },
  { category: 'general',  channel: 'sms',   label: 'General Text Message' },
] as const

type TypeKey = string
function typeKey(category: string, channel: string): TypeKey {
  return `${category}:${channel}`
}

// ── Editor form ────────────────────────────────────────────────────────────────

interface FormState {
  name: string
  category: string
  channel: string
  subject: string
  body: string
}

type EditorMode = 'new' | 'edit'
interface EditorTarget {
  mode: EditorMode
  id?: string
  category: string
  channel: string
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  orgId: string
  initialTemplates: CommunicationTemplate[]
}

export function TemplatesClient({ orgId, initialTemplates }: Props) {
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState(initialTemplates)
  const [expanded, setExpanded] = useState<Set<TypeKey>>(new Set())
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const [form, setForm] = useState<FormState>({
    name: '', category: 'invoice', channel: 'email', subject: '', body: '',
  })
  const editorRef = useRef<RichTextEditorHandle>(null)
  const subjectInputRef = useRef<HTMLInputElement>(null)

  function toggleExpanded(key: TypeKey) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectTemplate(tpl: CommunicationTemplate) {
    setTarget({ mode: 'edit', id: tpl.id, category: tpl.category, channel: tpl.channel })
    setForm({
      name: tpl.name,
      category: tpl.category,
      channel: tpl.channel,
      subject: tpl.subject ?? '',
      body: tpl.body ?? '',
    })
  }

  function openCreate(category: string, channel: string) {
    setTarget({ mode: 'new', category, channel })
    setForm({ name: '', category, channel, subject: '', body: '' })
    setExpanded((prev) => new Set([...prev, typeKey(category, channel)]))
  }

  function handleCancel() {
    setTarget(null)
  }

  function insertBodyTag(tag: string) {
    editorRef.current?.insertContent(tag)
  }

  function insertSubjectTag(tag: string) {
    const input = subjectInputRef.current
    if (!input) {
      setForm((f) => ({ ...f, subject: f.subject + tag }))
      return
    }
    const start = input.selectionStart ?? form.subject.length
    const end = input.selectionEnd ?? start
    const before = form.subject.slice(0, start)
    const after = form.subject.slice(end)
    const next = before + tag + after
    setForm((f) => ({ ...f, subject: next }))
    requestAnimationFrame(() => {
      input.selectionStart = input.selectionEnd = start + tag.length
      input.focus()
    })
  }

  function handleSave() {
    startTransition(async () => {
      const body = form.body || null
      if (target?.mode === 'edit' && target.id) {
        const result = await updateTemplateAction(orgId, target.id, {
          name: form.name,
          category: form.category as 'invoice' | 'estimate' | 'job' | 'general',
          channel: form.channel as 'email' | 'sms',
          subject: form.subject || null,
          body,
        })
        if (result.success) {
          setTemplates((prev) =>
            prev.map((t) =>
              t.id === target.id
                ? { ...t, name: form.name, subject: form.subject || null, body }
                : t,
            ),
          )
          toast('Template saved.')
        } else {
          toast.error(result.error ?? 'Failed to save.')
        }
      } else if (target?.mode === 'new') {
        const result = await createTemplateAction(orgId, {
          name: form.name,
          category: form.category as 'invoice' | 'estimate' | 'job' | 'general',
          channel: form.channel as 'email' | 'sms',
          subject: form.subject || null,
          body,
          sortOrder: 0,
        })
        if (result.success && result.id) {
          const now = new Date()
          const newTpl: CommunicationTemplate = {
            id: result.id!,
            tenantId: orgId,
            name: form.name,
            category: form.category,
            channel: form.channel,
            subject: form.subject || null,
            body,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          }
          setTemplates((prev) => [...prev, newTpl])
          toast('Template created.')
          setTarget({ mode: 'edit', id: result.id, category: form.category, channel: form.channel })
        } else {
          toast.error(result.error ?? 'Failed to create.')
        }
      }
    })
  }

  function handleDelete() {
    if (target?.mode !== 'edit' || !target.id) return
    const id = target.id
    startTransition(async () => {
      const result = await deleteTemplateAction(orgId, id)
      if (result.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id))
        setTarget(null)
        toast('Template deleted.')
      } else {
        toast.error(result.error ?? 'Failed to delete.')
      }
    })
  }

  const editorKey =
    target?.mode === 'edit' ? `edit-${target.id}` : `new-${target?.category}-${target?.channel}`

  const typeLabel = target
    ? (TEMPLATE_TYPES.find(
        (t) => t.category === target.category && t.channel === target.channel,
      )?.label ?? '')
    : ''

  return (
    <div className="flex border rounded-lg overflow-hidden" style={{ minHeight: '580px' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 border-r overflow-y-auto bg-muted/20">
        {TEMPLATE_TYPES.map(({ category, channel, label }) => {
          const key = typeKey(category, channel)
          const typeTemplates = templates.filter(
            (t) => t.category === category && t.channel === channel,
          )
          const isOpen = expanded.has(key)

          return (
            <div key={key} className="border-b last:border-b-0">
              {/* Row header */}
              <div className="flex items-center gap-1 px-2 py-2">
                <button
                  onClick={() => toggleExpanded(key)}
                  className="flex-1 flex items-center gap-1.5 text-left text-sm font-medium min-w-0 text-foreground hover:text-primary transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
                      isOpen && 'rotate-90',
                    )}
                  />
                  <span className="truncate">{label}</span>
                  {typeTemplates.length > 0 && (
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground pr-1">
                      {typeTemplates.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openCreate(category, channel)
                  }}
                  className="shrink-0 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="size-3" />
                  New
                </button>
              </div>

              {/* Expanded template list */}
              {isOpen && typeTemplates.length > 0 && (
                <div className="pb-1">
                  {typeTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl)}
                      className={cn(
                        'w-full text-left pl-7 pr-3 py-1.5 text-sm truncate transition-colors',
                        target?.id === tpl.id
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Editor panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!target ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground select-none">
            Select a template or click "+ New" to get started.
          </div>
        ) : (
          <div className="p-6 space-y-5 max-w-2xl">
            {/* Header */}
            <div>
              <h3 className="text-base font-semibold">
                {target.mode === 'new' ? 'New template' : form.name || 'Edit template'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{typeLabel}</p>
            </div>

            {/* Template Name */}
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name" className="text-xs font-medium">
                Template Name
              </Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Invoice — Summer Promotion"
              />
            </div>

            {/* Subject (email only) */}
            {form.channel === 'email' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-subject" className="text-xs font-medium">
                    When Emailed, Subject Line
                  </Label>
                  <TagPicker
                    category={form.category as 'invoice' | 'estimate' | 'job' | 'general'}
                    channel={form.channel as 'email' | 'sms'}
                    mode="subject"
                    onInsertTag={insertSubjectTag}
                  />
                </div>
                <Input
                  ref={subjectInputRef}
                  id="tpl-subject"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Invoice {Invoice:Number} from {Company:Name}"
                />
              </div>
            )}

            {/* Rich text body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Body</Label>
                <TagPicker
                  category={form.category as 'invoice' | 'estimate' | 'job' | 'general'}
                  channel={form.channel as 'email' | 'sms'}
                  mode="body"
                  onInsertTag={insertBodyTag}
                />
              </div>
              <RichTextEditor
                ref={editorRef}
                key={editorKey}
                value={form.body}
                onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                minHeight="280px"
              />
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between pt-3 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isPending || target.mode === 'new'}
              >
                {isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Delete Template
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isPending || !form.name.trim()}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                  Save Template
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
