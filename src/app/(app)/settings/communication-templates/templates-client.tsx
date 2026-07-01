'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
} from './actions'
import type { CommunicationTemplate } from './actions'

const CATEGORIES = [
  { value: 'invoice',  label: 'Invoice' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'job',      label: 'Job' },
  { value: 'general',  label: 'General' },
] as const

type Category = typeof CATEGORIES[number]['value'] | 'all'

const CATEGORY_LABELS: Record<string, string> = {
  invoice: 'Invoice',
  estimate: 'Estimate',
  job: 'Job',
  general: 'General',
}

interface TemplateFormState {
  name: string
  category: string
  channel: string
  subject: string
  body: string
}

const EMPTY_FORM: TemplateFormState = {
  name: '',
  category: 'invoice',
  channel: 'email',
  subject: '',
  body: '',
}

interface Props {
  orgId: string
  initialTemplates: CommunicationTemplate[]
}

export function TemplatesClient({ orgId, initialTemplates }: Props) {
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState(initialTemplates)
  const [activeCategory, setActiveCategory] = useState<Category>('all')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const visible = activeCategory === 'all'
    ? templates
    : templates.filter((t) => t.category === activeCategory)

  const byCategory = CATEGORIES.map((cat) => ({
    ...cat,
    templates: templates.filter((t) => t.category === cat.value),
  }))

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, category: activeCategory === 'all' ? 'invoice' : activeCategory })
    setDialogOpen(true)
  }

  function openEdit(tpl: CommunicationTemplate) {
    setEditingId(tpl.id)
    setForm({
      name: tpl.name,
      category: tpl.category,
      channel: tpl.channel,
      subject: tpl.subject ?? '',
      body: tpl.body ?? '',
    })
    setDialogOpen(true)
  }

  function openDelete(id: string) {
    setDeleteId(id)
    setDeleteDialogOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      if (editingId) {
        const result = await updateTemplateAction(orgId, editingId, {
          name: form.name,
          category: form.category as 'invoice' | 'estimate' | 'job' | 'general',
          channel: form.channel as 'email' | 'sms',
          subject: form.subject || null,
          body: form.body || null,
        })
        if (result.success) {
          setTemplates((prev) =>
            prev.map((t) =>
              t.id === editingId
                ? { ...t, name: form.name, category: form.category, channel: form.channel, subject: form.subject || null, body: form.body || null }
                : t,
            ),
          )
          toast('Template updated.')
          setDialogOpen(false)
        } else {
          toast.error(result.error ?? 'Failed to update template.')
        }
      } else {
        const result = await createTemplateAction(orgId, {
          name: form.name,
          category: form.category as 'invoice' | 'estimate' | 'job' | 'general',
          channel: form.channel as 'email' | 'sms',
          subject: form.subject || null,
          body: form.body || null,
          sortOrder: 0,
        })
        if (result.success && result.id) {
          const now = new Date()
          setTemplates((prev) => [
            ...prev,
            {
              id: result.id!,
              tenantId: orgId,
              name: form.name,
              category: form.category,
              channel: form.channel,
              subject: form.subject || null,
              body: form.body || null,
              sortOrder: 0,
              createdAt: now,
              updatedAt: now,
            },
          ])
          toast('Template created.')
          setDialogOpen(false)
        } else {
          toast.error(result.error ?? 'Failed to create template.')
        }
      }
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      const result = await deleteTemplateAction(orgId, deleteId)
      if (result.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== deleteId))
        toast('Template deleted.')
      } else {
        toast.error(result.error ?? 'Failed to delete template.')
      }
      setDeleteDialogOpen(false)
      setDeleteId(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...CATEGORIES.map((c) => c.value)] as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={[
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            ].join(' ')}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
          </button>
        ))}
        <Button size="sm" className="ml-auto gap-1" onClick={openCreate}>
          <Plus className="size-3.5" />
          New template
        </Button>
      </div>

      {/* Template list */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No templates yet.{' '}
          <button onClick={openCreate} className="underline underline-offset-2">
            Create one.
          </button>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {visible.map((tpl) => (
            <div key={tpl.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tpl.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {CATEGORY_LABELS[tpl.category] ?? tpl.category} · {tpl.channel === 'email' ? 'Email' : 'SMS'}
                  {tpl.subject ? ` · ${tpl.subject}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => openEdit(tpl)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => openDelete(tpl.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit template' : 'New template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name" className="text-xs font-medium">Name</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Invoice — Summer Promotion"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? f.category }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Channel</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm((f) => ({ ...f, channel: v ?? f.channel }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject" className="text-xs font-medium">Subject</Label>
              <Input
                id="tpl-subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Email subject line"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-body" className="text-xs font-medium">Body</Label>
              <Textarea
                id="tpl-body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={7}
                placeholder="Message body text…"
                className="resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending || !form.name.trim()}>
              {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {editingId ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
