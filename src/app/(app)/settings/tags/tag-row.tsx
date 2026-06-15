'use client'

import { useActionState, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  createTagAction,
  updateTagAction,
  deleteTagAction,
  type TagActionState,
} from './actions'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { TagWithUsage } from '@/lib/settings'

const PRESET_COLORS = [
  { name: 'slate', hex: '#64748b' },
  { name: 'red', hex: '#ef4444' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'green', hex: '#22c55e' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'violet', hex: '#8b5cf6' },
  { name: 'pink', hex: '#ec4899' },
]

const createInitial: TagActionState = {}
const updateInitial: TagActionState = {}

export function TagRow({ initialTags }: { initialTags: TagWithUsage[] }) {
  const router = useRouter()

  const [tags, setTags] = useState<TagWithUsage[]>(initialTags)
  const [createState, createAction, createPending] = useActionState(
    createTagAction,
    createInitial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateTagAction,
    updateInitial,
  )

  // Sync server data into local state
  useEffect(() => {
    setTags(initialTags)
  }, [initialTags])

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<TagWithUsage | null>(null)
  const [deleting, setDeleting] = useState<TagWithUsage | null>(null)

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
    const result = await deleteTagAction(id)
    if (result.success) {
      setDeleting(null)
      router.refresh()
    }
  }, [router])

  const isEmpty = tags.length === 0

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex items-center justify-between">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 size-4" />
            Add Tag
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Tag</DialogTitle>
              <DialogDescription>
                Create a new tag with a preset color.
              </DialogDescription>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Tag Name</Label>
                <Input
                  id="add-name"
                  name="name"
                  placeholder="e.g. VIP"
                  required
                  minLength={1}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <label
                      key={c.hex}
                      className="group relative cursor-pointer"
                      title={c.name}
                    >
                      <input
                        type="radio"
                        name="color"
                        value={c.hex}
                        defaultChecked={c.hex === '#3b82f6'}
                        className="sr-only peer"
                      />
                      <span
                        className="block size-8 rounded-full border-2 border-transparent peer-checked:border-foreground transition-colors"
                        style={{ backgroundColor: c.hex }}
                      />
                    </label>
                  ))}
                </div>
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
          <p className="text-sm text-muted-foreground">No tags yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tags you create here appear when tagging customers, jobs, and estimates.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Tag
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Color</th>
                <th className="px-4 py-2 text-left font-semibold">Tag Name</th>
                <th className="px-4 py-2 text-left font-semibold">Usage Count</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <span
                      className="inline-block size-4 rounded-full border"
                      style={{ backgroundColor: tag.color ?? '#3b82f6' }}
                      aria-label={`Color: ${tag.color}`}
                    />
                  </td>
                  <td className="px-4 py-2 font-medium">{tag.name}</td>
                  <td className="px-4 py-2">
                    <Badge variant={tag.usageCount > 0 ? 'secondary' : 'outline'}>
                      {tag.usageCount}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit tag"
                        onClick={() => setEditing(tag)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete tag"
                        onClick={() => setDeleting(tag)}
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
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>Update the tag name or color.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form action={updateAction} className="space-y-4">
              <input type="hidden" name="id" value={editing.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-name">Tag Name</Label>
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
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <label
                      key={c.hex}
                      className="group relative cursor-pointer"
                      title={c.name}
                    >
                      <input
                        type="radio"
                        name="color"
                        value={c.hex}
                        defaultChecked={c.hex === (editing.color ?? '#3b82f6')}
                        className="sr-only peer"
                      />
                      <span
                        className="block size-8 rounded-full border-2 border-transparent peer-checked:border-foreground transition-colors"
                        style={{ backgroundColor: c.hex }}
                      />
                    </label>
                  ))}
                </div>
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
            <DialogTitle>Delete this tag?</DialogTitle>
            <DialogDescription>
              {deleting && deleting.usageCount > 0 ? (
                <>
                  &quot;{deleting.name}&quot; is used on {deleting.usageCount} record(s).
                  Deleting it removes the tag from all of them. This can&apos;t be undone.
                </>
              ) : deleting ? (
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
              Delete tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
