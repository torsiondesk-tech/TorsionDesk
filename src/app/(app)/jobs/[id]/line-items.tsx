'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { Textarea } from '@/components/ui/textarea'
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

export function toMoney(n: number): string {
  return (n / 100).toFixed(2)
}

export function parseMoney(s: string): number {
  return Math.round(parseFloat(s || '0') * 100) || 0
}

/** Compute margin % from unit rate and unit cost. */
export function computeMargin(rateStr: string, costStr: string): string | null {
  const rate = parseFloat(rateStr || '0')
  const cost = parseFloat(costStr || '0')
  if (rate === 0) return null
  const pct = ((rate - cost) / rate) * 100
  return `${pct.toFixed(1)}%`
}

type SearchResult = { id: string; name: string; unitPrice: string | null; unitCost: string | null; description: string | null }

export function useCatalogSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  async function search(q: string, kind: 'product' | 'service') {
    if (!q.trim()) {
      setResults([])
      setQuery('')
      return
    }
    setQuery(q)
    setLoading(true)
    try {
      const rows =
        kind === 'product'
          ? await searchProductsAction(q)
          : await searchServicesAction(q)
      setResults(rows)
    } finally {
      setLoading(false)
    }
  }

  return { query, results, loading, search, setQuery, setResults }
}

export function SearchDropdown({
  query,
  results,
  loading,
  onQueryChange,
  onSelect,
  onCreateNew,
  onAddCustom,
  kind,
}: {
  query: string
  results: SearchResult[]
  loading: boolean
  onQueryChange: (q: string) => void
  onSelect: (r: SearchResult) => void
  onCreateNew: () => void
  onAddCustom?: (q: string) => void
  kind: 'product' | 'service'
}) {
  const [open, setOpen] = useState(false)
  return (
    <Combobox open={open} onOpenChange={setOpen}>
      <ComboboxInput
        className="w-full"
        placeholder={`Search ${kind}s...`}
        value={query}
        onChange={(e) => {
          const q = e.currentTarget.value
          onQueryChange(q)
        }}
        showTrigger={false}
        showClear={!!query}
      />
      <ComboboxContent>
        <ComboboxList>
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {!loading &&
            results.map((r) => (
              <ComboboxItem
                key={r.id}
                value={r.id}
                onClick={() => onSelect(r)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ${parseFloat(r.unitPrice || '0').toFixed(2)}
                  </span>
                </div>
              </ComboboxItem>
            ))}
          {!loading && !results.length && query.trim() && (
            <ComboboxEmpty>
              <span>No {kind}s found.</span>
            </ComboboxEmpty>
          )}
        </ComboboxList>
        {!loading && query.trim() && (
          <div
            className={cn(
              'flex flex-col gap-1 border-t border-border px-1 py-1',
              results.length === 0 && 'border-border',
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            {onAddCustom && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={() => {
                  setOpen(false)
                  onAddCustom(query)
                }}
                className="flex w-full flex-col rounded-md px-1.5 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              >
                <span className="text-sm font-medium">
                  Add &ldquo;{query}&rdquo; as custom {kind}
                </span>
                <span className="text-xs text-muted-foreground">
                  Not in catalog — enter name and price manually
                </span>
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={() => {
                setOpen(false)
                onCreateNew()
              }}
              className="flex w-full flex-col rounded-md px-1.5 py-2 text-left hover:bg-accent hover:text-accent-foreground"
            >
              <span className="text-sm font-medium">+ Create new {kind}</span>
              <span className="text-xs text-muted-foreground">Add to catalog and this job</span>
            </button>
          </div>
        )}
      </ComboboxContent>
    </Combobox>
  )
}

export function LineItems({ jobId, items, onChange, referenceData }: LineItemsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTab, setDialogTab] = useState<'product' | 'service' | 'discount'>('product')
  const [addTitle, setAddTitle] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addRate, setAddRate] = useState('')
  const [addCost, setAddCost] = useState('')
  const [addTaxItemId, setAddTaxItemId] = useState<string | undefined>(undefined)
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null)

  const dialogSearch = useCatalogSearch()

  // Inline states
  const [inlineAdd, setInlineAdd] = useState<{
    type: 'product' | 'service' | 'discount' | 'expense'
    title: string
    description: string
    qty: string
    rate: string
    cost: string
    taxItemId: string | null
    refId: string | null
  } | null>(null)
  const inlineAddSearch = useCatalogSearch()

  const [inlineEdit, setInlineEdit] = useState<{
    id: string
    type: 'product' | 'service' | 'discount' | 'expense'
    title: string
    description: string
    qty: string
    rate: string
    cost: string
    taxItemId: string | null
    refId: string | null
  } | null>(null)
  const inlineEditSearch = useCatalogSearch()

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Catalog create modal
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [catalogModalDefaultName, setCatalogModalDefaultName] = useState('')
  const [catalogModalDefaultKind, setCatalogModalDefaultKind] = useState<'product' | 'service'>('product')
  const [catalogModalTarget, setCatalogModalTarget] = useState<'dialog' | 'inline-add' | 'inline-edit'>('dialog')

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

  // -- Dialog helpers --------------------------------------------------------

  function resetDialog() {
    setAddTitle('')
    setAddDescription('')
    setAddQty('1')
    setAddRate('')
    setAddCost('')
    setAddTaxItemId(undefined)
    setSelectedRefId(null)
    dialogSearch.setQuery('')
    dialogSearch.setResults([])
    setDialogTab('product')
  }

  function handleCatalogCreated(item: { id: string; name: string; unitPrice: string; unitCost: string | null; description: string | null }) {
    if (catalogModalTarget === 'dialog') {
      setAddTitle(item.name)
      setAddDescription(item.description ?? '')
      setAddRate(item.unitPrice)
      setAddCost(item.unitCost ?? '')
      setSelectedRefId(item.id)
      dialogSearch.setQuery(item.name)
      dialogSearch.setResults([])
    } else if (catalogModalTarget === 'inline-add' && inlineAdd) {
      setInlineAdd({ ...inlineAdd, title: item.name, description: item.description ?? '', rate: item.unitPrice, cost: item.unitCost ?? '', refId: item.id })
      inlineAddSearch.setQuery(item.name)
      inlineAddSearch.setResults([])
    } else if (catalogModalTarget === 'inline-edit' && inlineEdit) {
      setInlineEdit({ ...inlineEdit, title: item.name, description: item.description ?? '', rate: item.unitPrice, cost: item.unitCost ?? '', refId: item.id })
      inlineEditSearch.setQuery(item.name)
      inlineEditSearch.setResults([])
    }
    setCatalogModalOpen(false)
  }

  function openCreateCatalog(kind: 'product' | 'service', target: 'dialog' | 'inline-add' | 'inline-edit', defaultName?: string) {
    setCatalogModalDefaultKind(kind)
    setCatalogModalDefaultName(defaultName ?? '')
    setCatalogModalTarget(target)
    setTimeout(() => setCatalogModalOpen(true), 0)
  }

  async function handleAddFromDialog() {
    if (!addTitle.trim()) return

    const newItem: JobFormLineItem = {
      id: crypto.randomUUID(),
      type: dialogTab === 'discount' ? 'discount' : dialogTab,
      refId: selectedRefId,
      title: addTitle.trim() || null,
      description: addDescription.trim(),
      qty: addQty || '1',
      rate: dialogTab === 'discount' ? `-${Math.abs(parseFloat(addRate || '0'))}` : (addRate || '0'),
      cost: addCost || '0',
      taxItemId: addTaxItemId ?? null,
    }

    if (jobId) {
      startTransition(async () => {
        await addJobLineItem(jobId, newItem)
        router.refresh()
      })
    } else {
      onChange([...items, newItem])
    }

    setDialogOpen(false)
    resetDialog()
  }

  // -- Inline add ------------------------------------------------------------

  function startInlineAdd(type: 'product' | 'service' | 'discount' | 'expense') {
    setInlineAdd({
      type,
      title: '',
      description: '',
      qty: '1',
      rate: '',
      cost: '',
      taxItemId: null,
      refId: null,
    })
    inlineAddSearch.setQuery('')
    inlineAddSearch.setResults([])
  }

  function handleInlineAddSelect(result: SearchResult) {
    if (!inlineAdd) return
    setInlineAdd({
      ...inlineAdd,
      title: result.name,
      description: result.description ?? '',
      rate: result.unitPrice ?? '0',
      cost: result.unitCost ?? '',
      refId: result.id,
    })
    inlineAddSearch.setQuery(result.name)
    inlineAddSearch.setResults([])
  }

  function handleInlineAdd() {
    if (!inlineAdd || !inlineAdd.title.trim()) return
    const newItem: JobFormLineItem = {
      id: crypto.randomUUID(),
      type: inlineAdd.type,
      refId: inlineAdd.refId,
      title: inlineAdd.title.trim() || null,
      description: inlineAdd.description.trim(),
      qty: inlineAdd.qty || '1',
      rate: inlineAdd.type === 'discount'
        ? `-${Math.abs(parseFloat(inlineAdd.rate || '0'))}`
        : (inlineAdd.rate || '0'),
      cost: inlineAdd.cost || '0',
      taxItemId: inlineAdd.taxItemId,
    }
    if (jobId) {
      startTransition(async () => {
        await addJobLineItem(jobId, newItem)
        router.refresh()
      })
    } else {
      onChange([...items, newItem])
    }
    setInlineAdd(null)
    inlineAddSearch.setQuery('')
    inlineAddSearch.setResults([])
  }

  // -- Inline edit -----------------------------------------------------------

  function startInlineEdit(item: JobFormLineItem) {
    const title = item.title ?? ''
    setInlineEdit({
      id: item.id!,
      type: item.type,
      title,
      description: item.description,
      qty: item.qty,
      rate: item.rate,
      cost: item.cost,
      taxItemId: item.taxItemId ?? null,
      refId: item.refId ?? null,
    })
    inlineEditSearch.setQuery(title)
    inlineEditSearch.setResults([])
  }

  function handleInlineEditSelect(result: SearchResult) {
    if (!inlineEdit) return
    setInlineEdit({
      ...inlineEdit,
      title: result.name,
      description: result.description ?? '',
      rate: result.unitPrice ?? '0',
      cost: result.unitCost ?? '',
      refId: result.id,
    })
    inlineEditSearch.setQuery(result.name)
    inlineEditSearch.setResults([])
  }

  function handleInlineEditSave() {
    if (!inlineEdit || !inlineEdit.title.trim()) return
    const updates: Partial<JobFormLineItem> = {
      title: inlineEdit.title.trim() || null,
      description: inlineEdit.description.trim(),
      qty: inlineEdit.qty,
      rate: inlineEdit.rate,
      cost: inlineEdit.cost,
      taxItemId: inlineEdit.taxItemId,
      refId: inlineEdit.refId,
    }
    const next = items.map((i) => (i.id === inlineEdit.id ? { ...i, ...updates } : i))
    if (jobId) {
      const item = items.find((i) => i.id === inlineEdit.id)
      if (item) {
        startTransition(async () => {
          await updateJobLineItem(inlineEdit.id, jobId, updates)
          router.refresh()
        })
      }
    } else {
      onChange(next)
    }
    setInlineEdit(null)
    inlineEditSearch.setQuery('')
    inlineEditSearch.setResults([])
  }

  // -- Shared handlers -------------------------------------------------------

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
          title: next.title,
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

  // -- Render helpers --------------------------------------------------------

  const renderDisplayRow = (item: JobFormLineItem) => {
    const lineTotal = parseMoney(item.rate) * (parseFloat(item.qty || '0') || 0)
    const isEditing = inlineEdit != null && inlineEdit.id === item.id
    if (isEditing) {
      const e = inlineEdit!
      const isCatalog = e.type === 'product' || e.type === 'service'
      const isDiscountEdit = e.type === 'discount'
      return (
        <tr key={e.id} className="border-b bg-muted/30">
          <td colSpan={8} className="px-3 py-3">
            <div className={`grid grid-cols-1 gap-3 ${isDiscountEdit ? 'md:grid-cols-[2fr_1fr_1fr_1fr_auto]' : 'md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]'}`}>
              {/* Item */}
              <div className="space-y-2">
                {isCatalog ? (
                  <div>
                    <Label className="text-xs">Title</Label>
                    <SearchDropdown
                      kind={e.type as 'product' | 'service'}
                      query={inlineEditSearch.query}
                      results={inlineEditSearch.results}
                      loading={inlineEditSearch.loading}
                      onQueryChange={(q) => {
                        setInlineEdit({ ...e, title: q })
                        inlineEditSearch.search(q, e.type as 'product' | 'service')
                      }}
                      onSelect={handleInlineEditSelect}
                      onCreateNew={() =>
                        openCreateCatalog(e.type as 'product' | 'service', 'inline-edit', e.title)
                      }
                      onAddCustom={(q) => {
                        setInlineEdit({ ...e, title: q, refId: null })
                        inlineEditSearch.setQuery(q)
                        inlineEditSearch.setResults([])
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={e.title}
                      onChange={(ev) => setInlineEdit({ ...e, title: ev.target.value })}
                      placeholder="Title"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={e.description}
                    onChange={(ev) => setInlineEdit({ ...e, description: ev.target.value })}
                    placeholder="Description"
                    rows={2}
                  />
                </div>
              </div>
              {/* Qty */}
              <div className="space-y-1">
                <Label className="text-xs">Qty</Label>
                <Input
                  value={e.qty}
                  onChange={(ev) => setInlineEdit({ ...e, qty: ev.target.value })}
                  className="w-full md:w-20"
                />
              </div>
              {/* Rate */}
              <div className="space-y-1">
                <Label className="text-xs">Rate</Label>
                <Input
                  value={e.rate}
                  onChange={(ev) => setInlineEdit({ ...e, rate: ev.target.value })}
                  className="w-full md:w-24"
                />
              </div>
              {/* Total */}
              <div className="space-y-1">
                <span className="text-xs text-transparent">Total</span>
                <div className="text-sm text-muted-foreground">
                  ${(parseMoney(e.rate) * (parseFloat(e.qty || '0') || 0) / 100).toFixed(2)}
                </div>
              </div>
              {!isDiscountEdit && (
                <>
                  {/* Cost */}
                  <div className="space-y-1">
                    <Label className="text-xs">Cost</Label>
                    <Input
                      value={e.cost}
                      onChange={(ev) => setInlineEdit({ ...e, cost: ev.target.value })}
                      className="w-full md:w-24"
                    />
                  </div>
                  {/* Margin */}
                  <div className="space-y-1">
                    <span className="text-xs text-transparent">Margin</span>
                    <div className="text-sm text-muted-foreground">
                      {computeMargin(e.rate || '0', e.cost || '0') ?? '—'}
                    </div>
                  </div>
                  {/* Tax */}
                  <div className="space-y-1">
                    <Label className="text-xs">Tax</Label>
                    <select
                      value={e.taxItemId ?? ''}
                      onChange={(ev) => setInlineEdit({ ...e, taxItemId: ev.target.value || null })}
                      className="h-8 w-full rounded-md border border-input bg-transparent px-1.5 text-xs md:w-auto"
                    >
                      <option value="">No Tax</option>
                      {referenceData.taxItems.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.rate}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {/* Action */}
              <div className="space-y-1">
                <span className="text-xs text-transparent">Action</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleInlineEditSave}>
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInlineEdit(null)
                      inlineEditSearch.setQuery('')
                      inlineEditSearch.setResults([])
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )
    }

    return (
      <tr key={item.id} className="border-b">
        <td className="px-3 py-2 text-sm">
          <div className="flex flex-col">
            {item.title ? (
              <>
                <span className="font-medium">{item.title}</span>
                {item.description && (
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                )}
              </>
            ) : (
              <span>{item.description}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-sm">{item.qty}</td>
        <td className="px-3 py-2 text-sm">${parseFloat(item.rate || '0').toFixed(2)}</td>
        <td className="px-3 py-2 text-sm">${(lineTotal / 100).toFixed(2)}</td>
        <td className="px-3 py-2 text-sm">{item.type === 'discount' ? '—' : `$${parseFloat(item.cost || '0').toFixed(2)}`}</td>
        <td className="px-3 py-2 text-sm">{item.type === 'discount' ? '—' : (computeMargin(item.rate || '0', item.cost || '0') ?? '—')}</td>
        <td className="px-3 py-2 text-sm">
          {item.type === 'discount' ? (
            '—'
          ) : (
            <Select
              value={item.taxItemId ?? ''}
              onValueChange={(v) =>
                handleUpdate(item, {
                  taxItemId: v || null,
                })
              }
            >
              <SelectTrigger className="h-7 px-1.5 text-xs w-auto">
                <SelectValue placeholder="No Tax">
                  {(() => {
                    if (!item.taxItemId) return 'No Tax'
                    const t = referenceData.taxItems.find((x) => x.id === item.taxItemId)
                    return t ? `${t.name} (${t.rate}%)` : item.taxItemId
                  })()}
                </SelectValue>
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
          )}
        </td>
        <td className="px-3 py-2 text-sm">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startInlineEdit(item)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmDeleteId(item.id ?? null)}
            >
              Remove
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  const renderInlineAddRow = () => {
    if (!inlineAdd) return null
    const a = inlineAdd
    const isDiscount = a.type === 'discount'
    return (
      <tr key="inline-add" className="border-b bg-muted/20">
        <td colSpan={8} className="px-3 py-3">
          <div className={`grid grid-cols-1 gap-3 ${isDiscount ? 'md:grid-cols-[2fr_1fr_1fr_1fr_auto]' : 'md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto]'}`}>
            {/* Item */}
            <div className="space-y-2">
              <div>
                <Label className="text-xs">{isDiscount ? 'Description' : 'Title'}</Label>
                {isDiscount ? (
                  <Input
                    value={a.title}
                    onChange={(e) => setInlineAdd({ ...a, title: e.target.value })}
                    placeholder="e.g. 5% Discount"
                  />
                ) : (
                  <SearchDropdown
                    kind={a.type as 'product' | 'service'}
                    query={inlineAddSearch.query}
                    results={inlineAddSearch.results}
                    loading={inlineAddSearch.loading}
                    onQueryChange={(q) => {
                      setInlineAdd({ ...a, title: q })
                      inlineAddSearch.search(q, a.type as 'product' | 'service')
                    }}
                    onSelect={handleInlineAddSelect}
                    onCreateNew={() =>
                      openCreateCatalog(a.type as 'product' | 'service', 'inline-add', a.title)
                    }
                    onAddCustom={(q) => {
                      setInlineAdd({ ...a, title: q, refId: null })
                      inlineAddSearch.setQuery(q)
                      inlineAddSearch.setResults([])
                    }}
                  />
                )}
              </div>
              <div>
                <Label className="text-xs">{isDiscount ? 'Notes' : 'Description'}</Label>
                <Textarea
                  value={a.description}
                  onChange={(e) => setInlineAdd({ ...a, description: e.target.value })}
                  placeholder={isDiscount ? 'Optional notes' : 'Description'}
                  rows={2}
                />
              </div>
            </div>
            {/* Qty */}
            <div className="space-y-1">
              <Label className="text-xs">Qty</Label>
              <Input
                value={a.qty}
                onChange={(e) => setInlineAdd({ ...a, qty: e.target.value })}
                className="w-full md:w-20"
                disabled={isDiscount}
              />
            </div>
            {/* Rate */}
            <div className="space-y-1">
              <Label className="text-xs">Rate</Label>
              <Input
                value={a.rate}
                onChange={(e) => setInlineAdd({ ...a, rate: e.target.value })}
                className="w-full md:w-24"
                placeholder={isDiscount ? '0.00' : undefined}
              />
              {isDiscount && (
                <p className="text-xs text-muted-foreground">Enter positive -- saved as negative.</p>
              )}
            </div>
            {/* Total */}
            <div className="space-y-1">
              <span className="text-xs text-transparent">Total</span>
              <div className="text-sm text-muted-foreground">
                ${(parseMoney(a.rate) * (parseFloat(a.qty || '0') || 0) / 100).toFixed(2)}
              </div>
            </div>
            {!isDiscount && (
              <>
                {/* Cost */}
                <div className="space-y-1">
                  <Label className="text-xs">Cost</Label>
                  <Input
                    value={a.cost}
                    onChange={(e) => setInlineAdd({ ...a, cost: e.target.value })}
                    className="w-full md:w-24"
                  />
                </div>
                {/* Margin */}
                <div className="space-y-1">
                  <span className="text-xs text-transparent">Margin</span>
                  <div className="text-sm text-muted-foreground">
                    {computeMargin(a.rate || '0', a.cost || '0') ?? '—'}
                  </div>
                </div>
                {/* Tax */}
                <div className="space-y-1">
                  <Label className="text-xs">Tax</Label>
                  <select
                    value={a.taxItemId ?? ''}
                    onChange={(e) => setInlineAdd({ ...a, taxItemId: e.target.value || null })}
                    className="h-8 w-full rounded-md border border-input bg-transparent px-1.5 text-xs md:w-auto"
                  >
                    <option value="">No Tax</option>
                    {referenceData.taxItems.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.rate}%)
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {/* Action */}
            <div className="space-y-1">
              <span className="text-xs text-transparent">Action</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={handleInlineAdd}>
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInlineAdd(null)
                    inlineAddSearch.setQuery('')
                    inlineAddSearch.setResults([])
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Line Items</h3>
        <div className="flex items-center gap-2">
          {!inlineAdd && (
            <>
              <Button variant="outline" size="sm" onClick={() => startInlineAdd('product')}>
                + Product
              </Button>
              <Button variant="outline" size="sm" onClick={() => startInlineAdd('service')}>
                + Service
              </Button>
              <Button variant="outline" size="sm" onClick={() => startInlineAdd('discount')}>
                + Discount
              </Button>
            </>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="size-4 mr-1" />Add Line Item</Button>}>
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
                  dialogSearch.setQuery('')
                  dialogSearch.setResults([])
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
                    <SearchDropdown
                      kind="product"
                      query={dialogSearch.query}
                      results={dialogSearch.results}
                      loading={dialogSearch.loading}
                      onQueryChange={(q) => {
                        setAddTitle(q)
                        dialogSearch.search(q, 'product')
                      }}
                      onSelect={(r) => {
                        setAddTitle(r.name)
                        setAddDescription(r.description ?? '')
                        setAddRate(r.unitPrice ?? '0')
                        setAddCost(r.unitCost ?? '')
                        setSelectedRefId(r.id)
                        dialogSearch.setQuery(r.name)
                        dialogSearch.setResults([])
                      }}
                      onCreateNew={() =>
                        openCreateCatalog('product', 'dialog', addTitle)
                      }
                      onAddCustom={(q) => {
                        setAddTitle(q)
                        setAddDescription('')
                        setAddRate('')
                        setAddCost('')
                        setSelectedRefId(null)
                        dialogSearch.setQuery(q)
                        dialogSearch.setResults([])
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="service" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Search Catalog</Label>
                    <SearchDropdown
                      kind="service"
                      query={dialogSearch.query}
                      results={dialogSearch.results}
                      loading={dialogSearch.loading}
                      onQueryChange={(q) => {
                        setAddTitle(q)
                        dialogSearch.search(q, 'service')
                      }}
                      onSelect={(r) => {
                        setAddTitle(r.name)
                        setAddDescription(r.description ?? '')
                        setAddRate(r.unitPrice ?? '0')
                        setAddCost(r.unitCost ?? '')
                        setSelectedRefId(r.id)
                        dialogSearch.setQuery(r.name)
                        dialogSearch.setResults([])
                      }}
                      onCreateNew={() =>
                        openCreateCatalog('service', 'dialog', addTitle)
                      }
                      onAddCustom={(q) => {
                        setAddTitle(q)
                        setAddDescription('')
                        setAddRate('')
                        setAddCost('')
                        setSelectedRefId(null)
                        dialogSearch.setQuery(q)
                        dialogSearch.setResults([])
                      }}
                    />
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
                      Enter a positive number -- it will be saved as a negative line
                      item.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {(dialogTab === 'product' || dialogTab === 'service') && (
                <div className="grid gap-4 sm:grid-cols-2 pt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      placeholder="Item name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={addDescription}
                      onChange={(e) => setAddDescription(e.target.value)}
                      placeholder="Optional details"
                      rows={2}
                    />
                  </div>
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
                    <Label>Margin</Label>
                    <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">
                      {computeMargin(addRate || '0', addCost || '0') ?? '—'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tax</Label>
                    <Select
                      value={addTaxItemId ?? ''}
                      onValueChange={(v) => setAddTaxItemId(v || undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No Tax">
                          {(() => {
                            if (!addTaxItemId) return null
                            const t = referenceData.taxItems.find((x) => x.id === addTaxItemId)
                            return t ? `${t.name} (${t.rate}%)` : null
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Tax</SelectItem>
                        {referenceData.taxItems.map((t) => {
                          const itemText = `${t.name} (${t.rate}%)`
                          return (
                            <SelectItem key={t.id} value={t.id}>
                              {itemText}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddFromDialog} disabled={isPending}>
                  {isPending ? 'Adding...' : 'Add Line Item'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
              {productsAndServices.length === 0 && !inlineAdd ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No line items yet. Add a product, service, or discount to build
                    the job total.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => startInlineAdd('product')}>+ Product</Button>
                    <Button variant="outline" size="sm" onClick={() => startInlineAdd('service')}>+ Service</Button>
                    <Button variant="outline" size="sm" onClick={() => startInlineAdd('discount')}>+ Discount</Button>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Rate</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Cost</th>
                      <th className="px-3 py-2 font-medium">Margin</th>
                      <th className="px-3 py-2 font-medium">Tax</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsAndServices.map(renderDisplayRow)}
                    {renderInlineAddRow()}
                    {!inlineAdd && (
                      <tr className="border-b">
                        <td colSpan={8} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => startInlineAdd('product')}>+ Product</Button>
                            <Button variant="outline" size="sm" onClick={() => startInlineAdd('service')}>+ Service</Button>
                            <Button variant="outline" size="sm" onClick={() => startInlineAdd('discount')}>+ Discount</Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
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
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Rate</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Cost</th>
                      <th className="px-3 py-2 font-medium">Margin</th>
                      <th className="px-3 py-2 font-medium">Tax</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(renderDisplayRow)}
                    {!inlineAdd && (
                      <tr className="border-b">
                        <td colSpan={8} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => startInlineAdd('expense')}>+ Expense</Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
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
            <div className="flex justify-between text-destructive">
              <span>Discounts</span>
              <span>-${totals.discount}</span>
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
              <span>Gross Profit</span>
              <span>${totals.grossProfit}</span>
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
              {isPending ? 'Removing...' : 'Remove Item'}
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
        defaultName={catalogModalDefaultName}
        defaultKind={catalogModalDefaultKind}
      />
    </div>
  )
}
