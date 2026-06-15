'use client'

import { useActionState, useState, useEffect, useCallback } from 'react'
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
  createTaxItemAction,
  updateTaxItemAction,
  deleteTaxItemAction,
  type TaxItemActionState,
} from './actions'
import { Pencil, Trash2, Plus } from 'lucide-react'

export type TaxItemRow = {
  id: string
  name: string
  rate: string
}

const createInitial: TaxItemActionState = {}
const updateInitial: TaxItemActionState = {}

export function TaxItemsList({ initialItems }: { initialItems: TaxItemRow[] }) {
  const router = useRouter()

  const [items, setItems] = useState<TaxItemRow[]>(initialItems)
  const [createState, createAction, createPending] = useActionState(
    createTaxItemAction,
    createInitial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateTaxItemAction,
    updateInitial,
  )

  // Sync server data into local state
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<TaxItemRow | null>(null)
  const [deleting, setDeleting] = useState<TaxItemRow | null>(null)

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

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteTaxItemAction(id)
    if (result.success) {
      setDeleting(null)
      router.refresh()
    }
  }, [router])

  const isEmpty = items.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 size-4" />
            Add Tax Item
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Tax Item</DialogTitle>
              <DialogDescription>
                Enter the rate as a percentage — e.g. 10.25 for 10.25%.
              </DialogDescription>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name</Label>
                <Input
                  id="add-name"
                  name="name"
                  placeholder="e.g. Illinois Sales Tax"
                  required
                  minLength={1}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-rate">Rate (%)</Label>
                <Input
                  id="add-rate"
                  name="rate"
                  placeholder="10.25"
                  required
                  minLength={1}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the rate as a percentage — e.g. 10.25 for 10.25%.
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

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">No tax items yet.</p>
          <Button variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Tax Item
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-right font-semibold">Rate</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {item.rate}%
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit tax item"
                        onClick={() => setEditing(item)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete tax item"
                        onClick={() => setDeleting(item)}
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
            <DialogTitle>Edit Tax Item</DialogTitle>
            <DialogDescription>Update the name or rate.</DialogDescription>
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
                <Label htmlFor="edit-rate">Rate (%)</Label>
                <Input
                  id="edit-rate"
                  name="rate"
                  defaultValue={editing.rate}
                  required
                  minLength={1}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the rate as a percentage — e.g. 10.25 for 10.25%.
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
            <DialogTitle>Delete this tax item?</DialogTitle>
            <DialogDescription>
              {deleting ? (
                <>
                  &quot;{deleting.name}&quot; will be removed. Customers set to this
                  tax item will need a new one. This can&apos;t be undone.
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
              Delete Tax Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
