'use client'

import { useActionState, useState, useCallback } from 'react'
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
  createProductCategoryAction,
  updateProductCategoryAction,
  deleteProductCategoryAction,
  type ProductCategoryActionState,
} from './actions'
import { Pencil, Trash2, Plus } from 'lucide-react'

type Category = { id: string; name: string }

const createInitial: ProductCategoryActionState = {}
const updateInitial: ProductCategoryActionState = {}

export function CategoryForm({
  initialCategories,
}: {
  initialCategories: Category[]
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [createState, createAction, createPending] = useActionState(
    createProductCategoryAction,
    createInitial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateProductCategoryAction,
    updateInitial,
  )

  // Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const handleDelete = useCallback(
    async (id: string) => {
      const result = await deleteProductCategoryAction(id)
      if (result.success) {
        setCategories((prev) => prev.filter((c) => c.id !== id))
        setDeleting(null)
      }
    },
    [],
  )

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
              <DialogTitle>Add Product Category</DialogTitle>
              <DialogDescription>Create a new category for products and services.</DialogDescription>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name</Label>
                <Input
                  id="add-name"
                  name="name"
                  placeholder="e.g. Garage Doors"
                  required
                  minLength={1}
                  maxLength={255}
                />
              </div>

              {createState.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {createState.error}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createPending}
                  onClick={() => {
                    if (createState.success) setIsAddOpen(false)
                  }}
                >
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
          <p className="text-sm text-muted-foreground">No product categories yet.</p>
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
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2">{cat.name}</td>
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
            <DialogTitle>Edit Product Category</DialogTitle>
            <DialogDescription>Update the name of this category.</DialogDescription>
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

              {updateState.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {updateState.error}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updatePending}
                  onClick={() => {
                    if (updateState.success) setEditing(null)
                  }}
                >
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
              &quot;{deleting?.name}&quot; will be removed. This can&apos;t be undone.
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
              Delete Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
