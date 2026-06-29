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
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductActionState,
} from '../actions'
import { Trash, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ProductFormData {
  id?: string
  name: string
  categoryId?: string | null
  model?: string
  sku?: string
  upc?: string
  partNo?: string
  type?: string
  unitPrice: string
  unitCost?: string
  active: boolean
  inventoryItem: boolean
  salesDescription?: string
  purchaseDescription?: string
  vendor1Name?: string
  vendor1Price?: string
  vendor2Name?: string
  vendor2Price?: string
  vendor3Name?: string
  vendor3Price?: string
}

interface ProductFormProps {
  mode: 'create' | 'edit'
  initial?: Partial<ProductFormData>
  categories: Array<{ id: string; name: string }>
}

export function ProductForm({
  mode,
  initial,
  categories,
}: ProductFormProps) {
  const router = useRouter()
  const action = mode === 'create' ? createProduct : updateProduct
  const [state, formAction, pending] = useActionState<
    ProductActionState,
    FormData
  >(action, {})

  const [active, setActive] = useState(initial?.active ?? true)
  const [inventoryItem, setInventoryItem] = useState(
    initial?.inventoryItem ?? false,
  )

  // Vendor rows state
  const buildInitialVendors = () => {
    const rows: { name: string; price: string }[] = []
    if (initial?.vendor1Name || initial?.vendor1Price) {
      rows.push({
        name: initial.vendor1Name ?? '',
        price: initial.vendor1Price ?? '',
      })
    }
    if (initial?.vendor2Name || initial?.vendor2Price) {
      rows.push({
        name: initial.vendor2Name ?? '',
        price: initial.vendor2Price ?? '',
      })
    }
    if (initial?.vendor3Name || initial?.vendor3Price) {
      rows.push({
        name: initial.vendor3Name ?? '',
        price: initial.vendor3Price ?? '',
      })
    }
    return rows.length > 0 ? rows : [{ name: '', price: '' }]
  }

  const [vendors, setVendors] = useState(buildInitialVendors)

  const addVendor = () => {
    setVendors((v) => (v.length < 3 ? [...v, { name: '', price: '' }] : v))
  }

  const removeVendor = (index: number) => {
    setVendors((v) => v.filter((_, i) => i !== index))
  }

  const updateVendor = (
    index: number,
    field: 'name' | 'price',
    value: string,
  ) => {
    setVendors((v) =>
      v.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  useEffect(() => {
    if (state.success) {
      router.push('/catalog?tab=products')
    }
  }, [state, router])

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!initial?.id) return
    setDeletePending(true)
    setDeleteError(null)
    const fd = new FormData()
    fd.set('id', initial.id)
    const result = await deleteProduct({}, fd)
    setDeletePending(false)
    if (result.success) {
      router.push('/catalog?tab=products')
    } else {
      setDeleteError(result.error ?? 'Could not delete.')
    }
  }

  const title = mode === 'create' ? 'New Product' : 'Edit Product'
  const cta = 'Save Product'

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
              <Label htmlFor="prod-name">Name *</Label>
              <Input
                id="prod-name"
                name="name"
                defaultValue={initial?.name}
                placeholder="Extension Spring Set"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                autoComplete="off"
                defaultValue={initial?.categoryId ?? ''}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                name="model"
                defaultValue={initial?.model}
                placeholder="Model / series"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                name="sku"
                defaultValue={initial?.sku}
                placeholder="Stock keeping unit"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="upc">UPC</Label>
              <Input
                id="upc"
                name="upc"
                defaultValue={initial?.upc}
                placeholder="Universal product code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partNo">Part #</Label>
              <Input
                id="partNo"
                name="partNo"
                defaultValue={initial?.partNo}
                placeholder="Part number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input
                id="type"
                name="type"
                defaultValue={initial?.type}
                placeholder="Product type"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <input type="hidden" name="active" value={active ? '1' : '0'} />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="active"
                  checked={active}
                  onCheckedChange={(c) => setActive(c === true)}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Active
                </Label>
              </div>

              <input
                type="hidden"
                name="inventoryItem"
                value={inventoryItem ? '1' : '0'}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="inventoryItem"
                  checked={inventoryItem}
                  onCheckedChange={(c) => setInventoryItem(c === true)}
                />
                <Label htmlFor="inventoryItem" className="cursor-pointer">
                  Inventory item
                </Label>
              </div>
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

        {/* ── Vendors ────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Vendors</h2>
          <div className="space-y-3">
            {vendors.map((vendor, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  aria-label={`Vendor ${index + 1} name`}
                  placeholder="Vendor name"
                  value={vendor.name}
                  onChange={(e) =>
                    updateVendor(index, 'name', e.target.value)
                  }
                  name={`vendor${index + 1}Name`}
                  className="flex-1"
                />
                <Input
                  aria-label={`Vendor ${index + 1} purchase price`}
                  placeholder="Purchase price"
                  value={vendor.price}
                  onChange={(e) =>
                    updateVendor(index, 'price', e.target.value)
                  }
                  name={`vendor${index + 1}Price`}
                  className="max-w-[160px]"
                />
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVendor(index)}
                    aria-label="Remove vendor row"
                    className="shrink-0"
                  >
                    <Trash className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {vendors.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVendor}
              >
                <Plus className="size-4" />
                Add vendor
              </Button>
            )}
          </div>
        </section>

        {/* ── Descriptions ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Descriptions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="salesDescription">
                Sales description
                <span className="ml-1 text-xs text-muted-foreground">
                  (customer-facing, appears on invoices)
                </span>
              </Label>
              <Textarea
                id="salesDescription"
                name="salesDescription"
                defaultValue={initial?.salesDescription}
                placeholder="Description shown to customers…"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDescription">
                Purchase description
                <span className="ml-1 text-xs text-muted-foreground">
                  (internal, for ordering)
                </span>
              </Label>
              <Textarea
                id="purchaseDescription"
                name="purchaseDescription"
                defaultValue={initial?.purchaseDescription}
                placeholder="Internal ordering notes…"
                rows={4}
              />
            </div>
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
          <Link href="/catalog?tab=products">
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
            <DialogTitle>Delete Product</DialogTitle>
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
