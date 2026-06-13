'use client'

import { useActionState, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createJobCategoryAction,
  updateJobCategoryAction,
  deleteJobCategoryAction,
  type JobCategoryActionState,
} from './actions'
import type { JobCategoryRow } from '@/lib/categories'
import { Pencil, Trash2, Plus } from 'lucide-react'

type CategoryWithParent = JobCategoryRow

const createInitial: JobCategoryActionState = {}
const updateInitial: JobCategoryActionState = {}

export function CategoryForm({
  initialCategories,
}: {
  initialCategories: CategoryWithParent[]
}) {
  const [categories, setCategories] = useState<CategoryWithParent[]>(initialCategories)
  const [createState, createAction, createPending] = useActionState(
    createJobCategoryAction,
    createInitial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateJobCategoryAction,
    updateInitial,
  )

  const router = useRouter()

  // Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryWithParent | null>(null)
  const [deleting, setDeleting] = useState<CategoryWithParent | null>(null)

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
      const result = await deleteJobCategoryAction(id)
      if (result.success) {
        setCategories((prev) => prev.filter((c) => c.id !== id))
        setDeleting(null)
      }
    },
    [],
  )

  // Build a parent label map for display
  const parentMap = new Map<string, string>()
  for (const c of categories) {
    parentMap.set(c.id, c.name)
  }

  const isEmpty = categories.length === 0

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex items-center justify-between">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 size-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Job Category</DialogTitle>
              <DialogDescription>
                Create a new category. Select a parent to make it a sub-category.
              </DialogDescription>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name</Label>
                <Input
                  id="add-name"
                  name="name"
                  placeholder="e.g. Residential"
                  required
                  minLength={1}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-parentId">Parent Category</Label>
                <Select name="parentId">
                  <SelectTrigger id="add-parentId" aria-label="Select a parent category">
                    <SelectValue placeholder="Select a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {'  '.repeat(cat.depth)}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave blank for a top-level category.
                </p>
              </div>

              {createState.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {createState.error}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="submit" disabled={createPending}>
                  {createPending ? 'Adding…' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">No job categories yet.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            Add Category
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-left font-semibold">Parent</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center gap-2"
                      style={{ paddingLeft: `${cat.depth * 1.25}rem` }}
                    >
                      {cat.name}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {cat.parentId ? parentMap.get(cat.parentId) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit category"
                        onClick={() => setEditing(cat)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete category"
                        onClick={() => setDeleting(cat)}
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Job Category</DialogTitle>
            <DialogDescription>Update the name or parent of this category.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form action={updateAction} className="space-y-4">
              <input type="hidden" name="id" value={editing.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editing.name}
                  required
                  minLength={1}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-parentId">Parent Category</Label>
                <Select name="parentId" defaultValue={editing.parentId ?? ''}>
                  <SelectTrigger id="edit-parentId" aria-label="Select a parent category">
                    <SelectValue placeholder="Select a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Top level —</SelectItem>
                    {categories
                      .filter((c) => c.id !== editing.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {'  '.repeat(cat.depth)}
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave blank for a top-level category.
                </p>
              </div>

              {updateState.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {updateState.error}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="submit" disabled={updatePending}>
                  {updatePending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
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
            <DialogTitle>Delete this category?</DialogTitle>
            <DialogDescription>
              Sub-categories under it will become top-level. This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!deleting && false}
              onClick={() => {
                if (deleting) handleDelete(deleting.id)
              }}
            >
              Delete Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
