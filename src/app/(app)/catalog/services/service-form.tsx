'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createService,
  updateService,
  deleteService,
  type ServiceActionState,
} from '../actions'

export interface ServiceFormData {
  id?: string
  name: string
  categoryId?: string | null
  unitPrice: string
  unitCost?: string
  description?: string
  active: boolean
}

interface ServiceFormProps {
  mode: 'create' | 'edit'
  initial?: Partial<ServiceFormData>
  categories: Array<{ id: string; name: string }>
}

export function ServiceForm({
  mode,
  initial,
  categories,
}: ServiceFormProps) {
  const router = useRouter()
  const action = mode === 'create' ? createService : updateService
  const [state, formAction, pending] = useActionState<
    ServiceActionState,
    FormData
  >(action, {})

  const [active, setActive] = useState(initial?.active ?? true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (state.success) {
      router.push('/catalog?tab=services')
    }
  }, [state, router])

  const handleDelete = async () => {
    if (!initial?.id) return
    setDeletePending(true)
    setDeleteError(null)
    const fd = new FormData()
    fd.set('id', initial.id)
    const result = await deleteService({}, fd)
    setDeletePending(false)
    if (result.success) {
      router.push('/catalog?tab=services')
    } else {
      setDeleteError(result.error ?? 'Could not delete.')
    }
  }

  const title = mode === 'create' ? 'New Service' : 'Edit Service'
  const cta = 'Save Service'

  return (
    <div className="mx-auto max-w-4xl animate-in fade-in-0 duration-300 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>

      <form action={formAction} autoComplete="off" className="space-y-8">
        {mode === 'edit' && initial?.id && (
          <input type="hidden" name="id" value={initial.id} />
        )}

        {/* ── Basics ─────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                autoComplete="off"
                defaultValue={initial?.categoryId ?? ''}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-name">Name *</Label>
              <Input
                id="svc-name"
                name="name"
                defaultValue={initial?.name}
                placeholder="Tune Up"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="hidden" name="active" value={active ? '1' : '0'} />
              <Checkbox
                id="active"
                checked={active}
                onCheckedChange={(c) => setActive(c === true)}
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Pricing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit price *</Label>
              <Input
                id="unitPrice"
                name="unitPrice"
                type="text"
                defaultValue={initial?.unitPrice}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitCost">Unit cost</Label>
              <Input
                id="unitCost"
                name="unitCost"
                type="text"
                defaultValue={initial?.unitCost}
                placeholder="0.00"
              />
            </div>
          </div>
        </section>

        {/* ── Description ────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Description</h2>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initial?.description}
              placeholder="Service description…"
              rows={4}
            />
          </div>
        </section>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : cta}
          </Button>
          <Link href="/catalog?tab=services">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          {mode === 'edit' && initial?.id && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </form>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete “{initial?.name}”? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {deleteError && (
              <p role="alert" className="text-sm text-destructive">{deleteError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deletePending}
                onClick={handleDelete}
              >
                {deletePending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
