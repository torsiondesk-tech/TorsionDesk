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
  createReferralSourceAction,
  updateReferralSourceAction,
  deleteReferralSourceAction,
  createJobSourceAction,
  updateJobSourceAction,
  deleteJobSourceAction,
  type LookupActionState,
} from './actions'
import { Pencil, Trash2, Plus } from 'lucide-react'

type LookupRow = { id: string; name: string }

const createInitial: LookupActionState = {}
const updateInitial: LookupActionState = {}

function LookupSection({
  title,
  emptyLabel,
  initialRows,
  createAction,
  updateAction,
  deleteAction,
  addButtonLabel,
  deleteConfirmLabel,
}: {
  title: string
  emptyLabel: string
  initialRows: LookupRow[]
  createAction: (
    _prev: LookupActionState,
    fd: FormData,
  ) => Promise<LookupActionState>
  updateAction: (
    _prev: LookupActionState,
    fd: FormData,
  ) => Promise<LookupActionState>
  deleteAction: (id: string) => Promise<{ success?: boolean; error?: string }>
  addButtonLabel: string
  deleteConfirmLabel: string
}) {
  const router = useRouter()

  const [rows, setRows] = useState<LookupRow[]>(initialRows)
  const [createState, createFormAction, createPending] = useActionState(
    createAction,
    createInitial,
  )
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateAction,
    updateInitial,
  )

  // Sync server data into local state
  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<LookupRow | null>(null)
  const [deleting, setDeleting] = useState<LookupRow | null>(null)

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
      const result = await deleteAction(id)
      if (result.success) {
        setDeleting(null)
        router.refresh()
      }
    },
    [deleteAction, router],
  )

  const isEmpty = rows.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight">{title}</h2>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <Plus className="mr-1 size-4" />
            {addButtonLabel}
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add {title}</DialogTitle>
              <DialogDescription>
                Add a new entry to the {title.toLowerCase()} list.
              </DialogDescription>
            </DialogHeader>
            <form action={createFormAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`add-${title}`}>Name</Label>
                <Input
                  id={`add-${title}`}
                  name="name"
                  placeholder="e.g. Google"
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
                <Button type="submit" disabled={createPending}>
                  {createPending ? 'Adding…' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="mr-1 size-4" />
            {addButtonLabel}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2 font-medium">{row.name}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${row.name}`}
                        onClick={() => setEditing(row)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${row.name}`}
                        onClick={() => setDeleting(row)}
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
            <DialogTitle>Edit {title}</DialogTitle>
            <DialogDescription>Update the name of this entry.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form action={updateFormAction} className="space-y-4">
              <input type="hidden" name="id" value={editing.id} />
              <div className="space-y-2">
                <Label htmlFor={`edit-${title}`}>Name</Label>
                <Input
                  id={`edit-${title}`}
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
            <DialogTitle>Delete this {title.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              {deleting ? (
                <>
                  &quot;{deleting.name}&quot; will be removed from the dropdown.
                  Existing records keep their value. This can&apos;t be undone.
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
              {deleteConfirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function LookupListsClient({
  initialReferrals,
  initialJobSources,
}: {
  initialReferrals: Array<{ id: string; name: string }>
  initialJobSources: Array<{ id: string; name: string }>
}) {
  return (
    <div className="space-y-10">
      <LookupSection
        title="Referral Sources"
        emptyLabel="No referral sources yet."
        initialRows={initialReferrals}
        createAction={createReferralSourceAction}
        updateAction={updateReferralSourceAction}
        deleteAction={deleteReferralSourceAction}
        addButtonLabel="Add Referral Source"
        deleteConfirmLabel="Delete Referral Source"
      />

      <LookupSection
        title="Job Sources"
        emptyLabel="No job sources yet."
        initialRows={initialJobSources}
        createAction={createJobSourceAction}
        updateAction={updateJobSourceAction}
        deleteAction={deleteJobSourceAction}
        addButtonLabel="Add Job Source"
        deleteConfirmLabel="Delete Job Source"
      />
    </div>
  )
}
