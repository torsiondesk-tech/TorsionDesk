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
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
  type TemplateActionState,
} from './actions'
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
  initialTemplates,
  jobCategories,
}: {
  initialTemplates: TemplateRow[]
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
  const [deleting, setDeleting] = useState<TemplateRow | null>(null)

  // Sync server data into local state
  useEffect(() => {
    setTemplates(initialTemplates)
  }, [initialTemplates])

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 size-4" />
              Add Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
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
        <DialogContent className="sm:max-w-lg">
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
    </div>
  )
}

function TemplateFormInner({
  action,
  pending,
  state,
  jobCategories,
  initialTemplate,
  onCancel,
}: {
  action: (formData: FormData) => void
  pending: boolean
  state: TemplateActionState
  jobCategories: Array<{ id: string; name: string; parentId: string | null }>
  initialTemplate?: TemplateRow
  onCancel: () => void
}) {
  const [lineItems, setLineItems] = useState<TemplateFormLineItem[]>([])
  const [tasks, setTasks] = useState<TemplateFormTask[]>([])

  const topCategories = jobCategories.filter((c) => !c.parentId)
  const childCategories = jobCategories.filter((c) => c.parentId)

  const addLineItem = () =>
    setLineItems((prev) => [
      ...prev,
      { type: 'service', description: '', qty: '1', rate: '0', cost: '0' },
    ])

  const removeLineItem = (idx: number) =>
    setLineItems((prev) => prev.filter((_, i) => i !== idx))

  const updateLineItem = (
    idx: number,
    field: keyof TemplateFormLineItem,
    value: string,
  ) =>
    setLineItems((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })

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
    <form action={action} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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

      {/* Line Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Line Items</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addLineItem}>
            <Plus className="mr-1 size-3" /> Add Line Item
          </Button>
        </div>
        {lineItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">No line items yet.</p>
        ) : (
          <div className="space-y-2">
            {lineItems.map((li, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={li.type}
                  onChange={(e) =>
                    updateLineItem(i, 'type', e.target.value)
                  }
                  className="h-8 rounded-md border border-input bg-transparent px-1.5 text-xs"
                >
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                  <option value="discount">Discount</option>
                  <option value="expense">Expense</option>
                </select>
                <Input
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                  className="flex-1 text-xs"
                />
                <Input
                  placeholder="Qty"
                  value={li.qty}
                  onChange={(e) => updateLineItem(i, 'qty', e.target.value)}
                  className="w-16 text-xs"
                />
                <Input
                  placeholder="Rate"
                  value={li.rate}
                  onChange={(e) => updateLineItem(i, 'rate', e.target.value)}
                  className="w-20 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeLineItem(i)}
                >
                  <X className="size-3 text-destructive" />
                </Button>
              </div>
            ))}
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
