'use client'

import { useState, useTransition, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  addJobLineItem,
  updateJobLineItem,
  deleteJobLineItem,
  searchProductsAction,
  searchServicesAction,
} from '@/app/(app)/jobs/actions'
import { useOnline } from '@/app/(tech)/lib/use-online'
import { cn } from '@/lib/utils'
import type { JobDetail } from '@/lib/jobs/jobs'

type LineItemRow = JobDetail['lineItems'][number]

type SearchResult = {
  id: string
  name: string
  unitPrice: string | null
  unitCost: string | null
  description: string | null
}

interface TechLineItemsProps {
  jobId: string
  items: LineItemRow[]
}

function fmt(val: string | null | undefined): string {
  const n = parseFloat(val ?? '0') || 0
  return Math.abs(n).toFixed(2)
}

function computeTotal(items: LineItemRow[]): number {
  return items.reduce((sum, item) => {
    const qty = parseFloat(item.qty ?? '1') || 0
    const rate = parseFloat(item.rate ?? '0') || 0
    return sum + qty * rate
  }, 0)
}

export function TechLineItems({ jobId, items }: TechLineItemsProps) {
  const router = useRouter()
  const online = useOnline()
  const [isPending, startTransition] = useTransition()

  // ── Add sheet ────────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [addTab, setAddTab] = useState<'product' | 'service' | 'discount'>('product')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [addQty, setAddQty] = useState('1')
  const [addRate, setAddRate] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [discountDesc, setDiscountDesc] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')

  // ── Edit sheet ───────────────────────────────────────────────────────────────
  const [editingItem, setEditingItem] = useState<LineItemRow | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editRate, setEditRate] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(async (q: string, kind: 'product' | 'service') => {
    setSearchQuery(q)
    setSelected(null)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results =
          kind === 'product'
            ? await searchProductsAction(q)
            : await searchServicesAction(q)
        setSearchResults(results)
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  function selectCatalogItem(item: SearchResult) {
    setSelected(item)
    setAddDesc(item.description ?? '')
    setAddQty('1')
    setAddRate(item.unitPrice ?? '0')
  }

  function resetAddSheet() {
    setSearchQuery('')
    setSearchResults([])
    setSelected(null)
    setAddQty('1')
    setAddRate('')
    setAddDesc('')
    setDiscountDesc('')
    setDiscountAmount('')
  }

  function handleAddCatalogItem() {
    if (!selected) return
    startTransition(async () => {
      try {
        await addJobLineItem(jobId, {
          type: addTab as 'product' | 'service',
          refId: selected.id,
          title: selected.name,
          description: addDesc || selected.name,
          qty: addQty,
          rate: addRate,
          cost: selected.unitCost ?? '0',
        })
        toast.success('Item added')
        setAddOpen(false)
        resetAddSheet()
        router.refresh()
      } catch {
        toast.error('Failed to add item')
      }
    })
  }

  function handleAddDiscount() {
    const amount = parseFloat(discountAmount) || 0
    if (!amount) return
    startTransition(async () => {
      try {
        await addJobLineItem(jobId, {
          type: 'discount',
          title: discountDesc || 'Discount',
          description: discountDesc || 'Discount',
          qty: '1',
          rate: String(-Math.abs(amount)),
        })
        toast.success('Discount added')
        setAddOpen(false)
        resetAddSheet()
        router.refresh()
      } catch {
        toast.error('Failed to add discount')
      }
    })
  }

  function openEdit(item: LineItemRow) {
    setEditingItem(item)
    setEditQty(item.qty ?? '1')
    setEditRate(fmt(item.rate))
    setEditDesc(item.description ?? item.title ?? '')
  }

  function handleSaveEdit() {
    if (!editingItem) return
    const rateToSave =
      editingItem.type === 'discount'
        ? String(-Math.abs(parseFloat(editRate) || 0))
        : editRate
    startTransition(async () => {
      try {
        await updateJobLineItem(editingItem.id, jobId, {
          description: editDesc,
          qty: editQty,
          rate: rateToSave,
        })
        toast.success('Item updated')
        setEditingItem(null)
        router.refresh()
      } catch {
        toast.error('Failed to update item')
      }
    })
  }

  function handleDelete(item: LineItemRow) {
    startTransition(async () => {
      try {
        await deleteJobLineItem(item.id, jobId)
        toast.success('Item removed')
        router.refresh()
      } catch {
        toast.error('Failed to remove item')
      }
    })
  }

  const total = computeTotal(items)

  return (
    <div className="flex flex-col gap-3">
      {/* Line items list */}
      {items.length > 0 ? (
        <>
          <ul className="flex flex-col divide-y">
            {items.map((item) => {
              const qty = parseFloat(item.qty ?? '1') || 0
              const rate = parseFloat(item.rate ?? '0') || 0
              const lineTotal = qty * rate
              const isDiscount = item.type === 'discount'
              return (
                <li key={item.id} className="flex items-center gap-2 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        isDiscount && 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {item.title ?? item.description ?? 'Unnamed item'}
                    </p>
                    {item.title &&
                      item.description &&
                      item.description !== item.title && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                      )}
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {qty} × ${fmt(item.rate)}
                      {' = '}
                      <span className={cn(isDiscount && 'text-red-600 dark:text-red-400')}>
                        {isDiscount ? '-' : ''}${Math.abs(lineTotal).toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    disabled={isPending}
                    aria-label="Edit item"
                    className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted transition-colors disabled:opacity-40"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={isPending}
                    aria-label="Remove item"
                    className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/10 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex justify-between text-sm font-semibold border-t pt-2 tabular-nums">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No line items on this job.</p>
      )}

      {/* ── Add Item sheet ───────────────────────────────────────────────────── */}
      <Sheet
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) resetAddSheet()
        }}
      >
        <SheetTrigger
          render={
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={isPending || !online}
              title={!online ? 'Go online to add items' : undefined}
            >
              <Plus className="size-4" />
              Add Item
            </Button>
          }
        />
        <SheetContent side="bottom" className="h-[82vh] flex flex-col gap-0 pb-safe">
          <SheetHeader className="shrink-0 pb-4">
            <SheetTitle>Add Line Item</SheetTitle>
          </SheetHeader>

          <Tabs
            value={addTab}
            onValueChange={(v) => {
              setAddTab(v as typeof addTab)
              setSearchQuery('')
              setSearchResults([])
              setSelected(null)
            }}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="grid grid-cols-3 shrink-0">
              <TabsTrigger value="product">Product</TabsTrigger>
              <TabsTrigger value="service">Service</TabsTrigger>
              <TabsTrigger value="discount">Discount</TabsTrigger>
            </TabsList>

            {/* Shared catalog search tab for product + service */}
            {(['product', 'service'] as const).map((kind) => (
              <TabsContent
                key={kind}
                value={kind}
                className="flex flex-col flex-1 min-h-0 mt-4 gap-4"
              >
                {!selected ? (
                  /* Search view */
                  <>
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pl-9"
                        placeholder={`Search ${kind}s…`}
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value, kind)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto -mx-2 px-2">
                      {searching && (
                        <p className="text-sm text-muted-foreground py-2">Searching…</p>
                      )}
                      {!searching && searchQuery && searchResults.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">
                          No {kind}s found for &ldquo;{searchQuery}&rdquo;
                        </p>
                      )}
                      {!searching && !searchQuery && (
                        <p className="text-sm text-muted-foreground py-2">
                          Type to search the catalog.
                        </p>
                      )}
                      <ul className="flex flex-col divide-y">
                        {searchResults.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => selectCatalogItem(r)}
                              className="flex flex-col w-full text-left px-1 py-3 hover:bg-muted active:bg-muted rounded-md transition-colors"
                            >
                              <span className="text-sm font-medium">{r.name}</span>
                              {r.description && (
                                <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {r.description}
                                </span>
                              )}
                              {r.unitPrice != null && (
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  ${parseFloat(r.unitPrice).toFixed(2)}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  /* Confirm form after selecting from catalog */
                  <div className="flex flex-col flex-1 gap-4">
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit"
                    >
                      <X className="size-4" />
                      Back to search
                    </button>
                    <p className="font-medium">{selected.name}</p>
                    <div className="flex flex-col gap-3">
                      <div>
                        <Label htmlFor={`${kind}-desc`}>Description</Label>
                        <Input
                          id={`${kind}-desc`}
                          value={addDesc}
                          onChange={(e) => setAddDesc(e.target.value)}
                          className="mt-1"
                          placeholder="Description for this job"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`${kind}-qty`}>Qty</Label>
                          <Input
                            id={`${kind}-qty`}
                            type="number"
                            inputMode="decimal"
                            value={addQty}
                            onChange={(e) => setAddQty(e.target.value)}
                            className="mt-1"
                            min="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`${kind}-rate`}>Rate ($)</Label>
                          <Input
                            id={`${kind}-rate`}
                            type="number"
                            inputMode="decimal"
                            value={addRate}
                            onChange={(e) => setAddRate(e.target.value)}
                            className="mt-1"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-auto">
                      <Button
                        onClick={handleAddCatalogItem}
                        disabled={isPending || !addRate}
                        className="w-full"
                      >
                        {isPending ? 'Adding…' : `Add ${kind === 'product' ? 'Product' : 'Service'}`}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setSelected(null)}
                        className="w-full"
                      >
                        Back to Search
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}

            {/* Discount tab */}
            <TabsContent value="discount" className="flex flex-col flex-1 mt-4 gap-4">
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="disc-desc">Description</Label>
                  <Input
                    id="disc-desc"
                    placeholder="e.g. Military discount"
                    value={discountDesc}
                    onChange={(e) => setDiscountDesc(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="disc-amount">Amount ($)</Label>
                  <Input
                    id="disc-amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="mt-1"
                    min="0"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddDiscount}
                disabled={isPending || !discountAmount}
                className="mt-auto"
              >
                {isPending ? 'Adding…' : 'Add Discount'}
              </Button>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* ── Edit sheet ───────────────────────────────────────────────────────── */}
      <Sheet
        open={!!editingItem}
        onOpenChange={(o) => {
          if (!o) setEditingItem(null)
        }}
      >
        <SheetContent side="bottom" className="h-auto pb-safe">
          <SheetHeader className="pb-4">
            <SheetTitle>Edit Item</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="edit-desc">Description</Label>
              <Input
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-qty">Qty</Label>
                <Input
                  id="edit-qty"
                  type="number"
                  inputMode="decimal"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="mt-1"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="edit-rate">
                  {editingItem?.type === 'discount' ? 'Amount ($)' : 'Rate ($)'}
                </Label>
                <Input
                  id="edit-rate"
                  type="number"
                  inputMode="decimal"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="mt-1"
                  min="0"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleSaveEdit} disabled={isPending} className="w-full">
                {isPending ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEditingItem(null)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
