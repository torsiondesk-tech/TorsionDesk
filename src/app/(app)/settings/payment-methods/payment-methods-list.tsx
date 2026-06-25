'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  createPaymentMethodAction,
  updatePaymentMethodAction,
  deletePaymentMethodAction,
  reorderPaymentMethodAction,
  type PaymentMethodActionState,
} from '@/app/(app)/payments/actions'
import { Pencil, Trash2, Plus, ArrowUp, ArrowDown, Lock } from 'lucide-react'

export type PaymentMethodRow = {
  id: string
  name: string
  isSystem: boolean
  isActive: boolean
  sortOrder: number
}

interface PaymentMethodsListProps {
  orgId: string
  initialMethods: PaymentMethodRow[]
}

export function PaymentMethodsList({ orgId, initialMethods }: PaymentMethodsListProps) {
  const router = useRouter()
  const [methods, setMethods] = useState(initialMethods)
  const [pending, startTransition] = useTransition()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null)
  const [deleting, setDeleting] = useState<PaymentMethodRow | null>(null)
  const [addName, setAddName] = useState('')
  const [editName, setEditName] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setMethods(initialMethods)
  }, [initialMethods])

  const handleCreate = () => {
    if (!addName.trim()) return
    startTransition(async () => {
      const result = await createPaymentMethodAction(orgId, { name: addName.trim() })
      if (result.error) {
        setActionError(result.error)
        return
      }
      setIsAddOpen(false)
      setAddName('')
      setActionError(null)
      router.refresh()
    })
  }

  const handleUpdate = () => {
    if (!editing) return
    startTransition(async () => {
      const result = await updatePaymentMethodAction(orgId, editing.id, {
        name: editName.trim(),
        isActive: editActive,
      })
      if (result.error) {
        setActionError(result.error)
        return
      }
      setEditing(null)
      setActionError(null)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!deleting) return
    startTransition(async () => {
      const result = await deletePaymentMethodAction(orgId, deleting.id)
      if (result.error) {
        setActionError(result.error)
        return
      }
      setDeleting(null)
      setActionError(null)
      router.refresh()
    })
  }

  const handleReorder = (id: string, direction: 'up' | 'down') => {
    startTransition(async () => {
      const result = await reorderPaymentMethodAction(orgId, id, direction)
      if (result.error) {
        setActionError(result.error)
        return
      }
      setActionError(null)
      router.refresh()
    })
  }

  const handleToggleActive = (row: PaymentMethodRow) => {
    startTransition(async () => {
      const result = await updatePaymentMethodAction(orgId, row.id, {
        isActive: !row.isActive,
      })
      if (result.error) {
        setActionError(result.error)
        return
      }
      router.refresh()
    })
  }

  const startEdit = (row: PaymentMethodRow) => {
    setEditing(row)
    setEditName(row.name)
    setEditActive(row.isActive)
    setActionError(null)
  }

  const isEmpty = methods.length === 0

  return (
    <TooltipProvider delay={0}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 size-4" />
              Add Payment Method
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Payment Method</DialogTitle>
                <DialogDescription>
                  e.g. Cash, Check, Zelle, Venmo, ACH, or Wire.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Name</Label>
                  <Input
                    id="add-name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Cash"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate()
                    }}
                  />
                </div>
                {actionError && (
                  <p role="alert" className="text-sm text-destructive">
                    {actionError}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={pending || !addName.trim()}>
                  {pending ? 'Adding…' : 'Add'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <p className="text-sm text-muted-foreground">
              No payment methods yet. Add cash, check, Zelle, Venmo, or a card processor to start
              recording payments.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add Payment Method
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {methods.map((method, index) => (
                  <tr key={method.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{method.name}</span>
                        {method.isSystem && (
                          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
                            System
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`active-${method.id}`}
                          checked={method.isActive}
                          disabled={method.isSystem || pending}
                          onCheckedChange={() => handleToggleActive(method)}
                        />
                        <Label htmlFor={`active-${method.id}`} className="text-sm font-normal">
                          {method.isActive ? 'Active' : 'Inactive'}
                        </Label>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {method.isSystem ? (
                          <>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <span className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground"
                                    aria-label="Built-in method"
                                  />
                                }
                              >
                                <Lock className="size-4" />
                              </TooltipTrigger>
                              <TooltipContent>Built-in method — can&apos;t be removed</TooltipContent>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Move up"
                              disabled={pending || index === 0}
                              onClick={() => handleReorder(method.id, 'up')}
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Move down"
                              disabled={pending || index === methods.length - 1}
                              onClick={() => handleReorder(method.id, 'down')}
                            >
                              <ArrowDown className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit payment method"
                              onClick={() => startEdit(method)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete payment method"
                              onClick={() => setDeleting(method)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </>
                        )}
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
              <DialogTitle>Edit Payment Method</DialogTitle>
              <DialogDescription>Rename or deactivate this method.</DialogDescription>
            </DialogHeader>
            {editing ? (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate()
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-active"
                    checked={editActive}
                    onCheckedChange={(v) => setEditActive(v === true)}
                  />
                  <Label htmlFor="edit-active" className="text-sm font-normal">Active</Label>
                </div>
                {actionError && (
                  <p role="alert" className="text-sm text-destructive">
                    {actionError}
                  </p>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button onClick={handleUpdate} disabled={pending || !editName.trim()}>
                    {pending ? 'Saving…' : 'Save'}
                  </Button>
                </DialogFooter>
              </div>
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
              <DialogTitle>Remove this payment method?</DialogTitle>
              <DialogDescription>
                {deleting ? (
                  <>
                    <strong>{deleting.name}</strong> will no longer appear in the Method
                    dropdown. Past payments recorded with it are unaffected.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
