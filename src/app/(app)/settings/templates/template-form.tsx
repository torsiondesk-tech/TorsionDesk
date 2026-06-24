'use client'

import { useActionState, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
  getTemplateAction,
  searchProductsAction,
  searchServicesAction,
  type TemplateActionState,
} from './actions'
import {
  createEstimateTemplateAction,
  deleteEstimateTemplateAction,
} from '@/app/(app)/estimates/actions'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import type { EstimateTemplate } from '@/lib/estimates/templates'
import { Pencil, Trash2, Plus, X } from 'lucide-react'

export type TemplateRow = {
  id: string
  name: string
  categoryId: string | null
  categoryName: string | null
  description: string | null
}

export interface TemplateFormLineItem {
  type: 'product' | 'service' | 'discount' | 'expense'
  refId?: string | null
  title: string
  description: string
  qty: string
  rate: string
  cost: string
  taxItemId?: string | null
}

export interface TemplateFormTask {
  label: string
}

const createInitial: TemplateActionState = {}
const updateInitial: TemplateActionState = {}

export function TemplatesPage({
  orgId,
  initialTemplates,
  initialEstimateTemplates,
  jobCategories,
}: {
  orgId: string
  initialTemplates: TemplateRow[]
  initialEstimateTemplates: EstimateTemplate[]
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateRow[]>(initialTemplates)

  const [createState, createAction, createPending] = useActionState(
    createTemplateAction,
    createInitial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateTemplateAction,
    updateInitial,
  )

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [editingDetails, setEditingDetails] = useState<{
    lineItems: TemplateFormLineItem[]
    tasks: TemplateFormTask[]
  } | null>(null)
  const [deleting, setDeleting] = useState<TemplateRow | null>(null)

  // Sync server data into local state
  useEffect(() => {
    setTemplates(initialTemplates)
  }, [initialTemplates])

  // Fetch full template details when editing opens
  useEffect(() => {
    if (!editing) {
      setEditingDetails(null)
      return
    }
    let cancelled = false
    getTemplateAction(editing.id).then((detail) => {
      if (cancelled || !detail) return
      setEditingDetails({
        lineItems: detail.lineItems.map((li) => ({
          type: li.type,
          refId: li.refId,
          title: li.title ?? '',
          description: li.description,
          qty: li.qty,
          rate: li.rate,
          cost: li.cost,
          taxItemId: li.taxItemId,
        })),
        tasks: detail.tasks.map((t) => ({ label: t.label })),
      })
    })
    return () => { cancelled = true }
  }, [editing])

  // Close dialogs and refresh data on success
  useEffect(() => {
    if (createState.success) {
      setIsAddOpen(false)
      router.refresh()
    }
  }, [createState, router])

  useEffect(() => {
    if (updateState.success) {
      setEditing(null)
      setEditingDetails(null)
      router.refresh()
    }
  }, [updateState, router])

  const handleDelete = useCallback(
    async (id: string) => {
      const result = await deleteTemplateAction(id)
      if (result.success) {
        setDeleting(null)
        router.refresh()
      }
    },
    [router],
  )

  const isEmpty = templates.length === 0

  return (
    <Tabs defaultValue="jobs" className="space-y-4">
      <TabsList>
        <TabsTrigger value="jobs">Job Templates</TabsTrigger>
        <TabsTrigger value="estimates">Estimate Templates</TabsTrigger>
      </TabsList>

      <TabsContent value="jobs" className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="mr-2 size-4" />
                Add Template
              </Button>
            }
          />
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Job Template</DialogTitle>
              <DialogDescription>
                Create a reusable template with pre-filled line items and tasks.
              </DialogDescription>
            </DialogHeader>
            <TemplateFormInner
              action={createAction}
              pending={createPending}
              state={createState}
              jobCategories={jobCategories}
              onCancel={() => setIsAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">No templates yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Templates let you pre-fill line items and tasks when creating jobs.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Template
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-left font-semibold">Category</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map((tmpl) => (
                <tr key={tmpl.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2 font-medium">{tmpl.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {tmpl.categoryName ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit template"
                        onClick={() => setEditing(tmpl)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete template"
                        onClick={() => setDeleting(tmpl)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Template</DialogTitle>
            <DialogDescription>Update the template details, line items, and tasks.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <TemplateFormInner
              key={editing.id}
              action={updateAction}
              pending={updatePending}
              state={updateState}
              jobCategories={jobCategories}
              initialTemplate={editing}
              initialLineItems={editingDetails?.lineItems}
              initialTasks={editingDetails?.tasks}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              {deleting ? (
                <>
                  &quot;{deleting.name}&quot; will be removed. This can&apos;t be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) handleDelete(deleting.id)
              }}
            >
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>

      <TabsContent value="estimates" className="space-y-4">
        <EstimateTemplatesTab orgId={orgId} initialTemplates={initialEstimateTemplates} />
      </TabsContent>
    </Tabs>
  )
}

type SearchResult = {
  id: string
  name: string
  unitPrice: string | null
  unitCost: string | null
  description: string | null
}

function EstimateTemplatesTab({
  orgId,
  initialTemplates,
}: {
  orgId: string
  initialTemplates: EstimateTemplate[]
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState<EstimateTemplate[]>(initialTemplates)
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<EstimateTemplate | null>(null)

  useEffect(() => {
    setTemplates(initialTemplates)
  }, [initialTemplates])

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    setSaving(true)
    const result = await createEstimateTemplateAction(orgId, {
      name: name.trim(),
      description: description.trim() || undefined,
      lineItems: [],
      tasks: [],
    })
    setSaving(false)
    if (result.error) return
    setName('')
    setDescription('')
    setIsAdding(false)
    router.refresh()
  }, [orgId, name, description, router])

  const handleDelete = useCallback(async () => {
    if (!deleting) return
    const result = await deleteEstimateTemplateAction(orgId, deleting.id)
    if (result.success) {
      setDeleting(null)
      router.refresh()
    }
  }, [orgId, deleting, router])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="mr-2 size-4" />
          Add Estimate Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">No estimate templates yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Estimate templates pre-fill line items and tasks when creating estimates.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setIsAdding(true)}>
            <Plus className="mr-2 size-4" />
            Add Estimate Template
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-left font-semibold">Description</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map((tmpl) => (
                <tr key={tmpl.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2 font-medium">{tmpl.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{tmpl.description ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete estimate template"
                      onClick={() => setDeleting(tmpl)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Estimate Template</DialogTitle>
            <DialogDescription>Create a reusable template for estimates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="est-tmpl-name">Template Name</Label>
              <Input
                id="est-tmpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spring Replacement Estimate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="est-tmpl-desc">Description</Label>
              <Textarea
                id="est-tmpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Add Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              {deleting ? (
                <>
                  &quot;{deleting.name}&quot; will be removed. This can&apos;t be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SearchDropdown({
  kind,
  query,
  results,
  loading,
  onQueryChange,
  onSelect,
}: {
  kind: 'product' | 'service'
  query: string
  results: SearchResult[]
  loading: boolean
  onQueryChange: (q: string) => void
  onSelect: (r: SearchResult) => void
}) {
  return (
    <Combobox>
      <ComboboxInput
        className="w-full"
        placeholder={`Search ${kind}s…`}
        value={query}
        onChange={(e) => onQueryChange(e.currentTarget.value)}
        showTrigger={false}
        showClear={!!query}
      />
      <ComboboxContent>
        <ComboboxList>
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </div>
          )}
          {!loading &&
            results.map((r) => (
              <ComboboxItem
                key={r.id}
                value={r.id}
                onClick={() => onSelect(r)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ${parseFloat(r.unitPrice || '0').toFixed(2)}
                  </span>
                </div>
              </ComboboxItem>
            ))}
          {!loading && !results.length && query.trim() && (
            <ComboboxEmpty>No {kind}s found.</ComboboxEmpty>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function TemplateFormInner({
  action,
  pending,
  state,
  jobCategories,
  initialTemplate,
  initialLineItems,
  initialTasks,
  onCancel,
}: {
  action: (formData: FormData) => void
  pending: boolean
  state: TemplateActionState
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  initialTemplate?: TemplateRow
  initialLineItems?: TemplateFormLineItem[]
  initialTasks?: TemplateFormTask[]
  onCancel: () => void
}) {
  const [lineItems, setLineItems] = useState<TemplateFormLineItem[]>(initialLineItems ?? [])
  const [tasks, setTasks] = useState<TemplateFormTask[]>(initialTasks ?? [])

  // Inline add state
  const [inlineAdd, setInlineAdd] = useState<{
    type: 'product' | 'service' | 'discount' | 'expense'
    title: string
    description: string
    qty: string
    rate: string
    cost: string
    refId: string | null
  } | null>(null)
  const inlineAddSearch = useCatalogSearch()

  // Inline edit: index being edited
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<TemplateFormLineItem | null>(null)
  const inlineEditSearch = useCatalogSearch()

  // Sync async-loaded line items / tasks into form state when they arrive
  useEffect(() => {
    if (initialLineItems) setLineItems(initialLineItems)
  }, [initialLineItems])

  useEffect(() => {
    if (initialTasks) setTasks(initialTasks)
  }, [initialTasks])

  const topCategories = jobCategories.filter((c) => !c.parentId)
  const childCategories = jobCategories.filter((c) => c.parentId)

  const startInlineAdd = (type: 'product' | 'service' | 'discount' | 'expense') => {
    setInlineAdd({
      type,
      title: '',
      description: '',
      qty: '1',
      rate: type === 'discount' ? '' : '0',
      cost: '0',
      refId: null,
    })
    inlineAddSearch.setQuery('')
    inlineAddSearch.setResults([])
  }

  const handleInlineAddSelect = (result: SearchResult) => {
    if (!inlineAdd) return
    setInlineAdd({
      ...inlineAdd,
      title: result.name,
      description: result.description ?? '',
      rate: result.unitPrice ?? '0',
      cost: result.unitCost ?? '0',
      refId: result.id,
    })
    inlineAddSearch.setQuery(result.name)
    inlineAddSearch.setResults([])
  }

  const handleInlineAdd = () => {
    if (!inlineAdd || !inlineAdd.title.trim()) return
    const newItem: TemplateFormLineItem = {
      type: inlineAdd.type,
      refId: inlineAdd.refId,
      title: inlineAdd.title.trim(),
      description: inlineAdd.description.trim(),
      qty: inlineAdd.qty || '1',
      rate: inlineAdd.type === 'discount'
        ? `-${Math.abs(parseFloat(inlineAdd.rate || '0'))}`
        : (inlineAdd.rate || '0'),
      cost: inlineAdd.cost || '0',
    }
    setLineItems((prev) => [...prev, newItem])
    setInlineAdd(null)
    inlineAddSearch.setQuery('')
    inlineAddSearch.setResults([])
  }

  const startInlineEdit = (idx: number) => {
    const item = lineItems[idx]
    setEditIdx(idx)
    setEditForm({ ...item })
    inlineEditSearch.setQuery(item.title)
    inlineEditSearch.setResults([])
  }

  const handleInlineEditSelect = (result: SearchResult) => {
    if (!editForm) return
    setEditForm({
      ...editForm,
      title: result.name,
      description: result.description ?? '',
      rate: result.unitPrice ?? '0',
      cost: result.unitCost ?? '0',
      refId: result.id,
    })
    inlineEditSearch.setQuery(result.name)
    inlineEditSearch.setResults([])
  }

  const handleInlineEditSave = () => {
    if (editIdx === null || !editForm || !editForm.title.trim()) return
    const updated: TemplateFormLineItem = {
      ...editForm,
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      qty: editForm.qty || '1',
      rate: editForm.type === 'discount'
        ? `-${Math.abs(parseFloat(editForm.rate || '0'))}`
        : (editForm.rate || '0'),
      cost: editForm.cost || '0',
    }
    setLineItems((prev) => prev.map((li, i) => (i === editIdx ? updated : li)))
    setEditIdx(null)
    setEditForm(null)
    inlineEditSearch.setQuery('')
    inlineEditSearch.setResults([])
  }

  const removeLineItem = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx))
    if (editIdx === idx) {
      setEditIdx(null)
      setEditForm(null)
    }
  }

  const addTask = () => setTasks((prev) => [...prev, { label: '' }])
  const removeTask = (idx: number) =>
    setTasks((prev) => prev.filter((_, i) => i !== idx))
  const updateTask = (idx: number, value: string) =>
    setTasks((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], label: value }
      return next
    })

  return (
    <form action={action} className="space-y-4">
      {initialTemplate ? <input type="hidden" name="id" value={initialTemplate.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="tmpl-name">Template Name</Label>
        <Input
          id="tmpl-name"
          name="name"
          defaultValue={initialTemplate?.name ?? ''}
          placeholder="e.g. Spring Replacement"
          required
          minLength={1}
          maxLength={255}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tmpl-category">Category</Label>
        <select
          id="tmpl-category"
          name="categoryId"
          defaultValue={initialTemplate?.categoryId ?? ''}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Select category…</option>
          {topCategories.map((parent) => (
            <optgroup key={parent.id} label={parent.name}>
              <option value={parent.id}>{parent.name}</option>
              {childCategories
                .filter((c) => c.parentId === parent.id)
                .map((child) => (
                  <option key={child.id} value={child.id}>
                    &nbsp;&nbsp;{child.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tmpl-description">Description</Label>
        <Textarea
          id="tmpl-description"
          name="description"
          defaultValue={initialTemplate?.description ?? ''}
          placeholder="Optional description…"
          rows={2}
        />
      </div>

      {/* ── Line Items (job-page style inline add/edit) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Line Items</Label>
          {!inlineAdd && (
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => startInlineAdd('product')}>
                + Product
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => startInlineAdd('service')}>
                + Service
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => startInlineAdd('discount')}>
                + Discount
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => startInlineAdd('expense')}>
                + Expense
              </Button>
            </div>
          )}
        </div>

        {lineItems.length === 0 && !inlineAdd ? (
          <p className="text-xs text-muted-foreground">No line items yet.</p>
        ) : (
          <div className="space-y-1">
            {lineItems.map((li, i) => {
              const isEditing = editIdx === i
              if (isEditing && editForm) {
                const e = editForm
                const isCatalog = e.type === 'product' || e.type === 'service'
                return (
                  <div key={i} className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="space-y-2">
                      {isCatalog ? (
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {e.type === 'product' ? 'Product' : 'Service'} Search
                          </Label>
                          <SearchDropdown
                            kind={e.type as 'product' | 'service'}
                            query={inlineEditSearch.query}
                            results={inlineEditSearch.results}
                            loading={inlineEditSearch.loading}
                            onQueryChange={(q) => {
                              setEditForm({ ...e, title: q })
                              inlineEditSearch.search(q, e.type as 'product' | 'service')
                            }}
                            onSelect={handleInlineEditSelect}
                          />
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <select
                          value={e.type}
                          onChange={(ev) => setEditForm({ ...e, type: ev.target.value as TemplateFormLineItem['type'] })}
                          className="h-8 rounded-md border border-input bg-transparent px-1.5 text-xs"
                        >
                          <option value="product">Product</option>
                          <option value="service">Service</option>
                          <option value="discount">Discount</option>
                          <option value="expense">Expense</option>
                        </select>
                        <Input
                          placeholder="Title"
                          value={e.title}
                          onChange={(ev) => setEditForm({ ...e, title: ev.target.value })}
                          className="flex-1 text-xs font-medium"
                        />
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLineItem(i)}>
                          <X className="size-3 text-destructive" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Description"
                        value={e.description}
                        onChange={(ev) => setEditForm({ ...e, description: ev.target.value })}
                        className="text-xs text-muted-foreground"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                          <Input
                            type="number" min="0" step="0.01"
                            value={e.qty}
                            onChange={(ev) => setEditForm({ ...e, qty: ev.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Rate ($)</Label>
                          <Input
                            type="number" min="0" step="0.01"
                            value={e.rate}
                            onChange={(ev) => setEditForm({ ...e, rate: ev.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost ($)</Label>
                          <Input
                            type="number" min="0" step="0.01"
                            value={e.cost}
                            onChange={(ev) => setEditForm({ ...e, cost: ev.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={handleInlineEditSave}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditIdx(null)
                          setEditForm(null)
                          inlineEditSearch.setQuery('')
                          inlineEditSearch.setResults([])
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )
              }

              // Display row
              return (
                <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-16 shrink-0">
                    {li.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{li.title}</div>
                    {li.description && (
                      <div className="text-[10px] text-muted-foreground truncate">{li.description}</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{li.qty}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                    ${parseFloat(li.rate || '0').toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => startInlineEdit(i)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLineItem(i)}>
                      <X className="size-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {/* Inline add row */}
            {inlineAdd && (
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="space-y-2">
                  {inlineAdd.type === 'product' || inlineAdd.type === 'service' ? (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {inlineAdd.type === 'product' ? 'Product' : 'Service'} Search
                      </Label>
                      <SearchDropdown
                        kind={inlineAdd.type as 'product' | 'service'}
                        query={inlineAddSearch.query}
                        results={inlineAddSearch.results}
                        loading={inlineAddSearch.loading}
                        onQueryChange={(q) => {
                          setInlineAdd({ ...inlineAdd, title: q })
                          inlineAddSearch.search(q, inlineAdd.type as 'product' | 'service')
                        }}
                        onSelect={handleInlineAddSelect}
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <select
                      value={inlineAdd.type}
                      onChange={(e) => setInlineAdd({ ...inlineAdd, type: e.target.value as TemplateFormLineItem['type'] })}
                      className="h-8 rounded-md border border-input bg-transparent px-1.5 text-xs"
                    >
                      <option value="product">Product</option>
                      <option value="service">Service</option>
                      <option value="discount">Discount</option>
                      <option value="expense">Expense</option>
                    </select>
                    <Input
                      placeholder="Title"
                      value={inlineAdd.title}
                      onChange={(e) => setInlineAdd({ ...inlineAdd, title: e.target.value })}
                      className="flex-1 text-xs font-medium"
                    />
                  </div>
                  <Input
                    placeholder="Description"
                    value={inlineAdd.description}
                    onChange={(e) => setInlineAdd({ ...inlineAdd, description: e.target.value })}
                    className="text-xs text-muted-foreground"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                      <Input
                        type="number" min="0" step="0.01"
                        value={inlineAdd.qty}
                        onChange={(e) => setInlineAdd({ ...inlineAdd, qty: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Rate ($)</Label>
                      <Input
                        type="number" min="0" step="0.01"
                        value={inlineAdd.rate}
                        onChange={(e) => setInlineAdd({ ...inlineAdd, rate: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost ($)</Label>
                      <Input
                        type="number" min="0" step="0.01"
                        value={inlineAdd.cost}
                        onChange={(e) => setInlineAdd({ ...inlineAdd, cost: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={handleInlineAdd}>
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setInlineAdd(null)
                      inlineAddSearch.setQuery('')
                      inlineAddSearch.setResults([])
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Add buttons at bottom of list */}
            {!inlineAdd && (
              <div className="flex items-center gap-1 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => startInlineAdd('product')}>
                  + Product
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => startInlineAdd('service')}>
                  + Service
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => startInlineAdd('discount')}>
                  + Discount
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => startInlineAdd('expense')}>
                  + Expense
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tasks</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addTask}>
            <Plus className="mr-1 size-3" /> Add Task
          </Button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Task description"
                  value={t.label}
                  onChange={(e) => updateTask(i, e.target.value)}
                  className="flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeTask(i)}
                >
                  <X className="size-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        type="hidden"
        name="lineItemsJson"
        value={JSON.stringify(lineItems)}
      />
      <input type="hidden" name="tasksJson" value={JSON.stringify(tasks)} />

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : initialTemplate ? 'Save Changes' : 'Add Template'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function useCatalogSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  async function search(q: string, kind: 'product' | 'service') {
    if (!q.trim()) {
      setResults([])
      setQuery('')
      return
    }
    setQuery(q)
    setLoading(true)
    try {
      const rows = kind === 'product'
        ? await searchProductsAction(q)
        : await searchServicesAction(q)
      setResults(rows)
    } finally {
      setLoading(false)
    }
  }

  return { query, results, loading, search, setQuery, setResults }
}
