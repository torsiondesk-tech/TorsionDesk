'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCatalogItemAction } from '@/app/(app)/catalog/actions'

interface CreateCatalogItemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Array<{ id: string; name: string }>
  onCreated: (item: { id: string; name: string; unitPrice: string; unitCost: string | null; description: string | null }) => void
  defaultName?: string
  defaultKind?: 'product' | 'service'
}

export function CreateCatalogItemModal({
  open,
  onOpenChange,
  categories,
  onCreated,
  defaultName,
  defaultKind,
}: CreateCatalogItemModalProps) {
  const [kind, setKind] = useState<'product' | 'service'>(defaultKind ?? 'product')

  // Sync kind when modal opens
  useEffect(() => {
    if (open && defaultKind) setKind(defaultKind)
  }, [open, defaultKind])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') ?? '').trim()
    const categoryId = String(fd.get('categoryId') ?? '')
    const unitPrice = String(fd.get('unitPrice') ?? '').trim()
    const unitCost = String(fd.get('unitCost') ?? '').trim() || undefined
    const description = String(fd.get('description') ?? '').trim() || undefined

    const nextErrors: Record<string, string> = {}
    if (!name) nextErrors.name = 'Name is required.'
    if (!categoryId) nextErrors.categoryId = 'Category is required.'
    if (!unitPrice) nextErrors.unitPrice = 'Unit price is required.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    startTransition(async () => {
      try {
        const item = await createCatalogItemAction({
          kind,
          name,
          categoryId,
          unitPrice,
          unitCost,
          description,
        })
        onCreated(item)
        onOpenChange(false)
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : 'Could not save. Please try again.',
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Catalog Item</DialogTitle>
            <DialogDescription>
              Create a new product or service and add it to the catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Kind toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setKind('product')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  kind === 'product'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Product
              </button>
              <button
                type="button"
                onClick={() => setKind('service')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  kind === 'service'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Service
              </button>
              <input type="hidden" name="kind" value={kind} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cim-name">Name *</Label>
              <Input id="cim-name" name="name" placeholder="Item name" defaultValue={defaultName} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cim-category">Category *</Label>
              <select
                id="cim-category"
                name="categoryId"
                defaultValue=""
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="" disabled>Select a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-sm text-destructive">{errors.categoryId}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cim-unitPrice">Unit price *</Label>
                <Input
                  id="cim-unitPrice"
                  name="unitPrice"
                  type="text"
                  placeholder="0.00"
                />
                {errors.unitPrice && (
                  <p className="text-sm text-destructive">{errors.unitPrice}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cim-unitCost">Unit cost</Label>
                <Input
                  id="cim-unitCost"
                  name="unitCost"
                  type="text"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cim-description">Description</Label>
              <Textarea
                id="cim-description"
                name="description"
                placeholder="Description (optional)"
                rows={3}
              />
            </div>

            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Create & Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
