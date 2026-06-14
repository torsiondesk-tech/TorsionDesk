'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import { CreateCatalogItemModal } from '@/components/catalog/create-item-modal'
import {
  addJobLineItem,
  updateJobLineItem,
  deleteJobLineItem,
  searchProductsAction,
  searchServicesAction,
} from '../actions'
import { computeJobTotals } from '@/lib/jobs/totals'
import type { JobFormLineItem } from './job-form'

interface ReferenceData {
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  productCategories: Array<{ id: string; name: string }>
}

interface LineItemsProps {
  jobId?: string
  items: JobFormLineItem[]
  onChange: (items: JobFormLineItem[]) => void
  referenceData: ReferenceData
}

function toMoney(n: number): string {
  return (n / 100).toFixed(2)
}

function parseMoney(s: string): number {
  return Math.round(parseFloat(s || '0') * 100) || 0
}

export function LineItems({ jobId, items, onChange, referenceData }: LineItemsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTab, setDialogTab] = useState<'product' | 'service' | 'discount'>('product')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Search state for catalog combobox
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; name: string; unitPrice: string | null }>
  >([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)

  // Form state for add dialog
  const [addDescription, setAddDescription] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addRate, setAddRate] = useState('')
  const [addCost, setAddCost] = useState('')
  const [addTaxItemId, setAddTaxItemId] = useState<string | undefined>(undefined)
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null)

  const totals = useMemo(() => {
    return computeJobTotals(
      items.map((i) => ({
        type: i.type,
        qty: i.qty,
        rate: i.rate,
        cost: i.cost,
        taxRate:
          referenceData.taxItems.find((t) => t.id === i.taxItemId)?.rate ?? null,
      })),
    )
  }, [items, referenceData.taxItems])

  const productsAndServices = items.filter(
    (i) => i.type === 'product' || i.type === 'service' || i.type === 'discount',
  )
  const expenses = items.filter((i) => i.type === 'expense')

  async function handleSearch(q: string) {
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      if (dialogTab === 'product') {
        const rows = await searchProductsAction(q)
        setSearchResults(rows)
      } else {
        const rows = await searchServicesAction(q)
        setSearchResults(rows)
      }
    } finally {
      setSearchLoading(false)
    }
  }

  function resetDialog() {
    setAddDescription('')
    setAddQty('1')
    setAddRate('')
    setAddCost('')
    setAddTaxItemId(undefined)
    setSelectedRefId(null)
    setSearchQuery('')
    setSearchResults([])
    setDialogTab('product')
  }

  function handleCatalogCreated(item: {
    id: string
    name: string
    unitPrice: string
  }) {
    setAddDescription(item.name)
    setAddRate(item.unitPrice)
    setSelectedRefId(item.id)
    setCatalogModalOpen(false)
  }

  async function handleAdd() {
    if (!addDescription.trim()) return

    const newItem: JobFormLineItem = {
      type: dialogTab === 'discount' ? 'discount' : dialogTab,
      refId: selectedRefId,
      description: addDescription.trim(),
      qty: addQty || '1',
      rate: dialogTab === 'discount' ? `-${Math.abs(parseFloat(addRate || '0'))}` : (addRate || '0'),
      cost: addCost || '0',
      taxItemId: addTaxItemId ?? null,
    }

    if (jobId) {
      startTransition(async () => {
        await addJobLineItem(jobId, {
          type: newItem.type,
          refId: newItem.refId,
          description: newItem.description,
          qty: newItem.qty,
          rate: newItem.rate,
          cost: newItem.cost,
          taxItemId: newItem.taxItemId,
        })
        router.refresh()
      })
    } else {
      onChange([...items, newItem])
    }

    setDialogOpen(false)
    resetDialog()
  }

  async function handleDelete(id?: string) {
    if (!id) return

    if (jobId) {
      startTransition(async () => {
        await deleteJobLineItem(id, jobId)
        router.refresh()
      })
    } else {
      onChange(items.filter((i) => i.id !== id))
    }
    setConfirmDeleteId(null)
  }

  async function handleUpdate(
    item: JobFormLineItem,
    updates: Partial<JobFormLineItem>,
  ) {
    const next = { ...item, ...updates }
    if (jobId && item.id) {
      startTransition(async () => {
        await updateJobLineItem(item.id!, jobId, {
          description: next.description,
          qty: next.qty,
          rate: next.rate,
          cost: next.cost,
          taxItemId: next.taxItemId,
        })
        router.refresh()
      })
    } else {
      onChange(items.map((i) => (i.id === item.id ? next : i)))
    }
  }

  const renderItemRow = (item: JobFormLineItem) => {
    const lineTotal = parseMoney(item.rate) * (parseFloat(item.qty || '0') || 0)
    return (
      <tr key={item.id ?? `${item.description}-${Math.random()}`} className="border-b">
        <td className="px-3 py-2 text-sm">{item.description}</td>
        <td className="px-3 py-2 text-sm">{item.qty}</td>
        <td className="px-3 py-2 text-sm">${parseFloat(item.rate || '0').toFixed(2)}</td>
        <td className="px-3 py-2 text-sm">${(lineTotal / 100).toFixed(2)}</td>
        <td className="px-3 py-2 text-sm">${parseFloat(item.cost || '0').toFixed(2)}</td>
        <td className="px-3 py-2 text-sm">
          <select
            value={item.taxItemId ?? ''}
            onChange={(e) =>
              handleUpdate(item, {
                taxItemId: e.target.value || null,
              })
            }
            className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
          >
            <option value="">No Tax</option>
            {referenceData.taxItems.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.rate}%)
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirmDeleteId(item.id ?? null)}
          >
            Remove
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Line Items</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm">Add Line Item</Button>}>
            Add Line Item
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Line Item</DialogTitle>
              <DialogDescription>
                Choose a product, service, or discount to add to this job.
              </DialogDescription>
            </DialogHeader>

            <Tabs
              value={dialogTab}
              onValueChange={(v) => {
                setDialogTab(v as 'product' | 'service' | 'discount')
                setSearchQuery('')
                setSearchResults([])
                setSelectedRefId(null)
              }}
            >
              <TabsList>
                <TabsTrigger value="product">Product</TabsTrigger>
                <TabsTrigger value="service">Service</TabsTrigger>
                <TabsTrigger value="discount">Discount</TabsTrigger>
              </TabsList>

              <TabsContent value="product" className="space-y-4">
                <div className="space-y-2">
                  <Label>Search Catalog</Label>
                  <Combobox>
                    <ComboboxInput
                      placeholder="Search products…"
                      value={searchQuery}
                      onChange={(e) => {
                        const q = e.currentTarget.value
                        setSearchQuery(q)
                        if (q.trim()) {
                          handleSearch(q)
                        } else {
                          setSearchResults([])
                        }
                      }}
                      showClear={!!searchQuery}
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        {searchLoading && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Searching…
                          </div>
                        )}
                        {!searchLoading &&
                          searchResults.map((r) => (
                            <ComboboxItem
                              key={r.id}
                              value={r.id}
                              onClick={() => {
                                setAddDescription(r.name)
                                setAddRate(r.unitPrice ?? '0')
                                setSelectedRefId(r.id)
                                setSearchQuery(r.name)
                                setSearchResults([])
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{r.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ${parseFloat(r.unitPrice || '0').toFixed(2)}
                                </span>
                              </div>
                            </ComboboxItem>
                          ))}
                        {!searchLoading && !searchResults.length && searchQuery.trim() && (
                          <ComboboxEmpty>
                            <div className="flex flex-col gap-2">
                              <span>No products found.</span>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => setCatalogModalOpen(true)}
                              >
                                Create New Product
                              </Button>
                            </div>
                          </ComboboxEmpty>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              </TabsContent>

              <TabsContent value="service" className="space-y-4">
                <div className="space-y-2">
                  <Label>Search Catalog</Label>
                  <Combobox>
                    <ComboboxInput
                      placeholder="Search services…"
                      value={searchQuery}
                      onChange={(e) => {
                        const q = e.currentTarget.value
                        setSearchQuery(q)
                        if (q.trim()) {
                          handleSearch(q)
                        } else {
                          setSearchResults([])
                        }
                      }}
                      showClear={!!searchQuery}
                    />
                    <ComboboxContent>
                      <ComboboxList>
                        {searchLoading && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Searching…
                          </div>
                        )}
                        {!searchLoading &&
                          searchResults.map((r) => (
                            <ComboboxItem
                              key={r.id}
                              value={r.id}
                              onClick={() => {
                                setAddDescription(r.name)
                                setAddRate(r.unitPrice ?? '0')
                                setSelectedRefId(r.id)
                                setSearchQuery(r.name)
                                setSearchResults([])
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{r.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ${parseFloat(r.unitPrice || '0').toFixed(2)}
                                </span>
                              </div>
                            </ComboboxItem>
                          ))}
                        {!searchLoading && !searchResults.length && searchQuery.trim() && (
                          <ComboboxEmpty>
                            <div className="flex flex-col gap-2">
                              <span>No services found.</span>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => setCatalogModalOpen(true)}
                              >
                                Create New Service
                              </Button>
                            </div>
                          </ComboboxEmpty>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              </TabsContent>

              <TabsContent value="discount" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="discount-desc">Description</Label>
                  <Input
                    id="discount-desc"
                    value={addDescription}
                    onChange={(e) => setAddDescription(e.target.value)}
                    placeholder="e.g. 5% Discount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount-amount">Amount</Label>
                  <Input
                    id="discount-amount"
                    type="number"
                    step="0.01"
                    value={addRate}
                    onChange={(e) => setAddRate(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a positive number — it will be saved as a negative line
                    item.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {(dialogTab === 'product' || dialogTab === 'service') && (
              <div className="grid gap-4 sm:grid-cols-2 pt-4">
                <div className="space-y-2">
                  <Label>Qty / Hrs</Label>
                  <Input
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate</Label>
                  <Input
                    value={addRate}
                    onChange={(e) => setAddRate(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cost</Label>
                  <Input
                    value={addCost}
                    onChange={(e) => setAddCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax</Label>
                  <Select
                    value={addTaxItemId ?? ''}
                    onValueChange={(v) => setAddTaxItemId(v || undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No Tax" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Tax</SelectItem>
                      {referenceData.taxItems.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={isPending}>
                {isPending ? 'Adding…' : 'Add Line Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Line items table */}
        <div className="flex-1">
          <Tabs defaultValue="products">
            <TabsList>
              <TabsTrigger value="products">Products &amp; Services</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              {productsAndServices.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No line items yet. Add a product, service, or discount to build
                  the job total.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Rate</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Cost</th>
                      <th className="px-3 py-2 font-medium">Tax</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>{productsAndServices.map(renderItemRow)}</tbody>
                </table>
              )}
            </TabsContent>

            <TabsContent value="expenses">
              {expenses.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No expenses yet.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Rate</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Cost</th>
                      <th className="px-3 py-2 font-medium">Tax</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>{expenses.map(renderItemRow)}</tbody>
                </table>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Totals panel */}
        <div className="w-full rounded-xl border bg-card p-5 lg:w-72">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Totals
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Products</span>
              <span>${totals.products}</span>
            </div>
            <div className="flex justify-between">
              <span>Services</span>
              <span>${totals.services}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxes &amp; Fees</span>
              <span>${totals.taxes}</span>
            </div>
            <div className="flex justify-between">
              <span>Drive &amp; Labor</span>
              <span>${totals.driveLabor}</span>
            </div>
            <div className="flex justify-between">
              <span>Billable Expenses</span>
              <span>${totals.expenses}</span>
            </div>
            <div className="my-2 h-px bg-border" />
            <div className="flex justify-between font-semibold">
              <span>Job Total</span>
              <span>${totals.jobTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Payments / Deposits</span>
              <span>${totals.payments}</span>
            </div>
            <div className="my-2 h-px bg-border" />
            <div className="flex justify-between font-semibold">
              <span>Total Due</span>
              <span>${totals.totalDue}</span>
            </div>
            <div className="flex justify-between">
              <span>Job Cost</span>
              <span>${totals.jobCost}</span>
            </div>
            <div className="flex justify-between">
              <span>Gross Profit %</span>
              <span>{totals.grossProfitPct ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove line item?</DialogTitle>
            <DialogDescription>
              This removes the item from the job and updates the totals.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(confirmDeleteId ?? undefined)}
              disabled={isPending}
            >
              {isPending ? 'Removing…' : 'Remove Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline catalog create modal */}
      <CreateCatalogItemModal
        open={catalogModalOpen}
        onOpenChange={setCatalogModalOpen}
        categories={referenceData.productCategories}
        onCreated={handleCatalogCreated}
      />
    </div>
  )
}
