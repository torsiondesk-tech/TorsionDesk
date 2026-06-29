"use client"

import * as React from "react"
import { Plus, ChevronDown, ChevronRight, Trash2, GripVertical } from "lucide-react"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CreateCatalogItemModal } from "@/components/catalog/create-item-modal"
import { LineItems } from "@/app/(app)/jobs/[id]/line-items"
import type { JobFormLineItem } from "@/app/(app)/jobs/[id]/job-form"
import {
  SearchDropdown,
  useCatalogSearch,
  toMoney,
  parseMoney,
  computeMargin,
} from "@/app/(app)/jobs/[id]/line-items"

export interface LineItemGroup {
  id: string
  name: string
  sortOrder?: number
}

export interface LineItemRow extends JobFormLineItem {
  groupId?: string | null
}

interface ReferenceData {
  taxItems: Array<{ id: string; name: string; rate: string | null }>
  productCategories: Array<{ id: string; name: string }>
}

interface GroupedLineItemsProps {
  groups: LineItemGroup[]
  lineItems: LineItemRow[]
  onChange: (groups: LineItemGroup[], items: LineItemRow[]) => void
  referenceData?: ReferenceData
  role?: string | null
  jobId?: string
}

type SearchResult = { id: string; name: string; unitPrice: string | null; unitCost: string | null; description: string | null }

export function GroupedLineItems({
  groups,
  lineItems,
  onChange,
  referenceData = { taxItems: [], productCategories: [] },
  role,
  jobId,
}: GroupedLineItemsProps) {
  const items = lineItems
  const isTechnician = role === 'technician'

  // Flat mode: delegate to the existing LineItems editor for full feature parity.
  if (groups.length === 0) {
    return (
      <FlatLineItemsWrapper
        items={items}
        onChange={(next) => onChange(groups, next)}
        referenceData={referenceData}
        jobId={jobId}
      />
    )
  }

  return (
    <GroupedEditor
      groups={groups}
      items={items}
      onChange={onChange}
      referenceData={referenceData}
      isTechnician={isTechnician}
      jobId={jobId}
    />
  )
}

function FlatLineItemsWrapper({
  items,
  onChange,
  referenceData,
  jobId,
}: {
  items: LineItemRow[]
  onChange: (items: LineItemRow[]) => void
  referenceData: ReferenceData
  jobId?: string
}) {
  return (
    <div className="space-y-4">
      <LineItems
        jobId={jobId}
        items={items as JobFormLineItem[]}
        onChange={onChange as (items: JobFormLineItem[]) => void}
        referenceData={referenceData}
      />
    </div>
  )
}

interface GroupedEditorProps {
  groups: LineItemGroup[]
  items: LineItemRow[]
  onChange: (groups: LineItemGroup[], items: LineItemRow[]) => void
  referenceData: ReferenceData
  isTechnician: boolean
  jobId?: string
}

function GroupedEditor({ groups, items, onChange, referenceData, isTechnician, jobId }: GroupedEditorProps) {
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(() => new Set(groups.map((g) => g.id)))
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [addingForGroupId, setAddingForGroupId] = React.useState<string | null | 'ungrouped'>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)

  // Catalog create modal state
  const [catalogModalOpen, setCatalogModalOpen] = React.useState(false)
  const [catalogModalDefaultName, setCatalogModalDefaultName] = React.useState('')
  const [catalogModalDefaultKind, setCatalogModalDefaultKind] = React.useState<'product' | 'service'>('product')
  const [catalogModalTarget, setCatalogModalTarget] = React.useState<{
    type: 'edit' | 'add'
    kind: 'product' | 'service'
  } | null>(null)

  const ungroupedItems = items.filter((i) => !i.groupId)
  const groupedItems = (groupId: string) => items.filter((i) => i.groupId === groupId)

  function setItems(next: LineItemRow[]) {
    onChange(groups, next)
  }

  function handleRenameGroup(groupId: string, name: string) {
    onChange(
      groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
      items,
    )
  }

  function handleAddGroup() {
    const nextIndex = groups.length + 1
    const name = `Group ${nextIndex}`
    const newGroup: LineItemGroup = {
      id: crypto.randomUUID(),
      name,
      sortOrder: groups.length,
    }
    onChange([...groups, newGroup], items)
    setOpenGroups((prev) => {
      const next = new Set(prev)
      next.add(newGroup.id)
      return next
    })
  }

  function handleDeleteGroup(groupId: string) {
    const nextGroups = groups.filter((g) => g.id !== groupId)
    const nextItems = items.map((i) => (i.groupId === groupId ? { ...i, groupId: null } : i))
    onChange(nextGroups, nextItems)
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  function updateItem(id: string, patch: Partial<LineItemRow>) {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function deleteItem(id: string) {
    setItems(items.filter((i) => i.id !== id))
    setConfirmDeleteId(null)
  }

  function addItem(item: LineItemRow) {
    setItems([...items, item])
    setAddingForGroupId(null)
  }

  const groupSubtotal = (groupId: string | null) => {
    const list = groupId === null ? ungroupedItems : groupedItems(groupId)
    return list.reduce((sum, i) => sum + parseMoney(i.rate) * (parseFloat(i.qty || '0') || 0), 0)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Line Items</h3>
        <Button variant="outline" size="sm" onClick={handleAddGroup}>
          <Plus className="mr-1 size-4" /> Add Group
        </Button>
      </div>

      {ungroupedItems.length > 0 && (
        <GroupSection
          group={{ id: 'ungrouped', name: 'Ungrouped', sortOrder: -1 }}
          isOpen={openGroups.has('ungrouped')}
          onToggle={() => toggleGroup('ungrouped')}
          items={ungroupedItems}
          subtotal={groupSubtotal(null)}
          referenceData={referenceData}
          isTechnician={isTechnician}
          editingId={editingId}
          setEditingId={setEditingId}
          adding={addingForGroupId === 'ungrouped'}
          setAdding={(v) => setAddingForGroupId(v ? 'ungrouped' : null)}
          onUpdateItem={updateItem}
          onDeleteItem={(id) => setConfirmDeleteId(id)}
          onAddItem={addItem}
          onRename={handleRenameGroup}
          onDeleteGroup={handleDeleteGroup}
          catalogModalState={{
            open: catalogModalOpen,
            setOpen: setCatalogModalOpen,
            defaultName: catalogModalDefaultName,
            setDefaultName: setCatalogModalDefaultName,
            defaultKind: catalogModalDefaultKind,
            setDefaultKind: setCatalogModalDefaultKind,
            target: catalogModalTarget,
            setTarget: setCatalogModalTarget,
          }}
        />
      )}

      {groups.map((group) => (
        <GroupSection
          key={group.id}
          group={group}
          isOpen={openGroups.has(group.id)}
          onToggle={() => toggleGroup(group.id)}
          items={groupedItems(group.id)}
          subtotal={groupSubtotal(group.id)}
          referenceData={referenceData}
          isTechnician={isTechnician}
          editingId={editingId}
          setEditingId={setEditingId}
          adding={addingForGroupId === group.id}
          setAdding={(v) => setAddingForGroupId(v ? group.id : null)}
          onUpdateItem={updateItem}
          onDeleteItem={(id) => setConfirmDeleteId(id)}
          onAddItem={addItem}
          onRename={handleRenameGroup}
          onDeleteGroup={handleDeleteGroup}
          catalogModalState={{
            open: catalogModalOpen,
            setOpen: setCatalogModalOpen,
            defaultName: catalogModalDefaultName,
            setDefaultName: setCatalogModalDefaultName,
            defaultKind: catalogModalDefaultKind,
            setDefaultKind: setCatalogModalDefaultKind,
            target: catalogModalTarget,
            setTarget: setCatalogModalTarget,
          }}
        />
      ))}

      <div className="pt-2">
        <Button variant="outline" size="sm" onClick={handleAddGroup}>
          <Plus className="mr-1 size-4" /> Add Group
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove line item?</DialogTitle>
            <DialogDescription>This removes the item and updates the total.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && deleteItem(confirmDeleteId)}>
              Remove Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CatalogModalState {
  open: boolean
  setOpen: (v: boolean) => void
  defaultName: string
  setDefaultName: (v: string) => void
  defaultKind: 'product' | 'service'
  setDefaultKind: (v: 'product' | 'service') => void
  target: { type: 'edit' | 'add'; kind: 'product' | 'service' } | null
  setTarget: (v: { type: 'edit' | 'add'; kind: 'product' | 'service' } | null) => void
}

interface GroupSectionProps {
  group: LineItemGroup
  isOpen: boolean
  onToggle: () => void
  items: LineItemRow[]
  subtotal: number
  referenceData: ReferenceData
  isTechnician: boolean
  editingId: string | null
  setEditingId: (id: string | null) => void
  adding: boolean
  setAdding: (v: boolean) => void
  onUpdateItem: (id: string, patch: Partial<LineItemRow>) => void
  onDeleteItem: (id: string) => void
  onAddItem: (item: LineItemRow) => void
  onRename: (groupId: string, name: string) => void
  onDeleteGroup: (groupId: string) => void
  catalogModalState: CatalogModalState
}

function GroupSection({
  group,
  isOpen,
  onToggle,
  items,
  subtotal,
  referenceData,
  isTechnician,
  editingId,
  setEditingId,
  adding,
  setAdding,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onRename,
  onDeleteGroup,
  catalogModalState,
}: GroupSectionProps) {
  const [isRenaming, setIsRenaming] = React.useState(false)
  const search = useCatalogSearch()

  function openCreateCatalog(kind: 'product' | 'service', defaultName: string, type: 'edit' | 'add') {
    catalogModalState.setDefaultKind(kind)
    catalogModalState.setDefaultName(defaultName)
    catalogModalState.setTarget({ type, kind })
    setTimeout(() => catalogModalState.setOpen(true), 0)
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger
        render={(props) => (
          <button
            {...props}
            className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-left font-medium"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="size-4 text-muted-foreground" />
              {isRenaming ? (
                <Input
                  aria-label="Group name"
                  value={group.name}
                  onChange={(e) => onRename(group.id, e.target.value)}
                  onBlur={() => setIsRenaming(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsRenaming(false)
                  }}
                  className="h-7 w-48"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span onDoubleClick={() => setIsRenaming(true)}>{group.name}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Subtotal ${toMoney(subtotal)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsRenaming(true)
                }}
              >
                Rename
              </Button>
              {group.id !== 'ungrouped' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteGroup(group.id)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </div>
          </button>
        )}
      />

      <CollapsibleContent>
        <div className="rounded-b-md border border-t-0 p-3">
          {items.length === 0 && !adding ? (
            <p className="text-sm text-muted-foreground">No items in this group.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-2 py-1 font-medium">Item</th>
                  <th className="px-2 py-1 font-medium">Qty</th>
                  <th className="px-2 py-1 font-medium">Rate</th>
                  <th className="px-2 py-1 font-medium">Total</th>
                  {!isTechnician && <>
                    <th className="px-2 py-1 font-medium">Cost</th>
                    <th className="px-2 py-1 font-medium">Margin</th>
                    <th className="px-2 py-1 font-medium">Tax</th>
                  </>}
                  <th className="px-2 py-1 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) =>
                  editingId === item.id ? (
                    <EditRow
                      key={item.id}
                      item={item}
                      referenceData={referenceData}
                      isTechnician={isTechnician}
                      onSave={(patch) => {
                        onUpdateItem(item.id!, patch)
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                      onOpenCreateCatalog={openCreateCatalog}
                    />
                  ) : (
                    <DisplayRow
                      key={item.id}
                      item={item}
                      referenceData={referenceData}
                      isTechnician={isTechnician}
                      onEdit={() => setEditingId(item.id ?? null)}
                      onDelete={() => onDeleteItem(item.id!)}
                      onUpdate={(patch) => onUpdateItem(item.id!, patch)}
                    />
                  ),
                )}
                {adding && (
                  <AddRow
                    groupId={group.id === 'ungrouped' ? null : group.id}
                    referenceData={referenceData}
                    isTechnician={isTechnician}
                    onSave={onAddItem}
                    onCancel={() => setAdding(false)}
                    onOpenCreateCatalog={openCreateCatalog}
                  />
                )}
              </tbody>
            </table>
          )}

          {!adding && (
            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                <Plus className="mr-1 size-4" /> Add Item
              </Button>
              <Dialog>
                <DialogTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        // keep dialog open; catalog search inside dialog would go here
                      }}
                    >
                      Search Catalog
                    </Button>
                  )}
                />
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Search Catalog</DialogTitle>
                    <DialogDescription>Search products or services to add to {group.name}.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <SearchDropdown
                      kind="product"
                      query={search.query}
                      results={search.results}
                      loading={search.loading}
                      onQueryChange={(q) => {
                        search.search(q, 'product')
                      }}
                      onSelect={(r) => {
                        onAddItem({
                          id: crypto.randomUUID(),
                          type: 'product',
                          refId: r.id,
                          title: r.name,
                          description: r.description ?? '',
                          qty: '1',
                          rate: r.unitPrice ?? '0',
                          cost: r.unitCost ?? '0',
                          taxItemId: null,
                          groupId: group.id === 'ungrouped' ? null : group.id,
                        })
                        search.setQuery('')
                        search.setResults([])
                      }}
                      onCreateNew={() => openCreateCatalog('product', search.query, 'add')}
                      onAddCustom={(q) => {
                        onAddItem({
                          id: crypto.randomUUID(),
                          type: 'product',
                          refId: null,
                          title: q,
                          description: '',
                          qty: '1',
                          rate: '0',
                          cost: '0',
                          taxItemId: null,
                          groupId: group.id === 'ungrouped' ? null : group.id,
                        })
                        search.setQuery('')
                        search.setResults([])
                      }}
                    />
                    <SearchDropdown
                      kind="service"
                      query={search.query}
                      results={search.results}
                      loading={search.loading}
                      onQueryChange={(q) => {
                        search.search(q, 'service')
                      }}
                      onSelect={(r) => {
                        onAddItem({
                          id: crypto.randomUUID(),
                          type: 'service',
                          refId: r.id,
                          title: r.name,
                          description: r.description ?? '',
                          qty: '1',
                          rate: r.unitPrice ?? '0',
                          cost: r.unitCost ?? '0',
                          taxItemId: null,
                          groupId: group.id === 'ungrouped' ? null : group.id,
                        })
                        search.setQuery('')
                        search.setResults([])
                      }}
                      onCreateNew={() => openCreateCatalog('service', search.query, 'add')}
                      onAddCustom={(q) => {
                        onAddItem({
                          id: crypto.randomUUID(),
                          type: 'service',
                          refId: null,
                          title: q,
                          description: '',
                          qty: '1',
                          rate: '0',
                          cost: '0',
                          taxItemId: null,
                          groupId: group.id === 'ungrouped' ? null : group.id,
                        })
                        search.setQuery('')
                        search.setResults([])
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {}} >Cancel</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </CollapsibleContent>

      <CreateCatalogItemModal
        open={catalogModalState.open}
        onOpenChange={catalogModalState.setOpen}
        categories={referenceData.productCategories}
        onCreated={(item) => {
          catalogModalState.setOpen(false)
          if (catalogModalState.target?.type === 'add') {
            onAddItem({
              id: crypto.randomUUID(),
              type: catalogModalState.target.kind,
              refId: item.id,
              title: item.name,
              description: item.description ?? '',
              qty: '1',
              rate: item.unitPrice,
              cost: item.unitCost ?? '0',
              taxItemId: null,
              groupId: group.id === 'ungrouped' ? null : group.id,
            })
          }
        }}
        defaultName={catalogModalState.defaultName}
        defaultKind={catalogModalState.defaultKind}
      />
    </Collapsible>
  )
}

function DisplayRow({
  item,
  referenceData,
  isTechnician,
  onEdit,
  onDelete,
  onUpdate,
}: {
  item: LineItemRow
  referenceData: ReferenceData
  isTechnician: boolean
  onEdit: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<LineItemRow>) => void
}) {
  const total = parseMoney(item.rate) * (parseFloat(item.qty || '0') || 0)
  return (
    <tr className="border-b">
      <td className="px-2 py-2">
        {item.title ? (
          <div className="flex flex-col">
            <span className="font-medium">{item.title}</span>
            {item.description && <span className="text-xs text-muted-foreground">{item.description}</span>}
          </div>
        ) : (
          item.description
        )}
      </td>
      <td className="px-2 py-2">{item.qty}</td>
      <td className="px-2 py-2">${parseFloat(item.rate || '0').toFixed(2)}</td>
      <td className="px-2 py-2">${toMoney(total)}</td>
      {!isTechnician && <>
        <td className="px-2 py-2">${parseFloat(item.cost || '0').toFixed(2)}</td>
        <td className="px-2 py-2">{computeMargin(item.rate || '0', item.cost || '0') ?? '—'}</td>
        <td className="px-2 py-2">
          <Select
            value={item.taxItemId ?? ''}
            onValueChange={(v) => onUpdate({ taxItemId: v || null })}
          >
            <SelectTrigger className="h-7 px-1 text-xs w-auto">
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
        </td>
      </>}
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>Remove</Button>
        </div>
      </td>
    </tr>
  )
}

function EditRow({
  item,
  referenceData,
  isTechnician,
  onSave,
  onCancel,
  onOpenCreateCatalog,
}: {
  item: LineItemRow
  referenceData: ReferenceData
  isTechnician: boolean
  onSave: (patch: Partial<LineItemRow>) => void
  onCancel: () => void
  onOpenCreateCatalog: (kind: 'product' | 'service', defaultName: string, type: 'edit' | 'add') => void
}) {
  const [draft, setDraft] = React.useState(item)
  const search = useCatalogSearch()
  const isCatalog = draft.type === 'product' || draft.type === 'service'

  return (
    <tr className="border-b bg-muted/30 align-top">
      <td className="px-2 py-2">
        <div className="space-y-2">
          {isCatalog ? (
            <div>
              <Label className="text-xs">Title</Label>
              <SearchDropdown
                kind={draft.type as 'product' | 'service'}
                query={search.query}
                results={search.results}
                loading={search.loading}
                onQueryChange={(q) => {
                  setDraft((d) => ({ ...d, title: q }))
                  search.search(q, draft.type as 'product' | 'service')
                }}
                onSelect={(r) => {
                  setDraft((d) => ({
                    ...d,
                    title: r.name,
                    description: r.description ?? d.description,
                    rate: r.unitPrice ?? d.rate,
                    cost: r.unitCost ?? d.cost,
                    refId: r.id,
                  }))
                  search.setQuery(r.name)
                  search.setResults([])
                }}
                onCreateNew={() => onOpenCreateCatalog(draft.type as 'product' | 'service', draft.title ?? '', 'edit')}
                onAddCustom={(q) => {
                  setDraft((d) => ({ ...d, title: q, refId: null }))
                  search.setQuery(q)
                  search.setResults([])
                }}
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                aria-label="Title"
                value={draft.title ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Title"
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              aria-label="Description"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Description"
              rows={2}
            />
          </div>
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="space-y-1">
          <Label className="text-xs">Qty</Label>
          <Input
            aria-label="Quantity"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={draft.qty}
            onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
            placeholder="Qty"
            className="w-full md:w-20"
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="space-y-1">
          <Label className="text-xs">Rate</Label>
          <Input
            aria-label="Rate"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={draft.rate}
            onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
            placeholder="Rate"
            className="w-full md:w-24"
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="space-y-1">
          <span className="text-xs text-transparent">Total</span>
          <div className="text-sm text-muted-foreground">
            ${toMoney(parseMoney(draft.rate) * (parseFloat(draft.qty || '0') || 0))}
          </div>
        </div>
      </td>
      {!isTechnician && (
        <>
          <td className="px-2 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Cost</Label>
              <Input
                aria-label="Cost"
                value={draft.cost}
                onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
                placeholder="Cost"
                className="w-full md:w-24"
              />
            </div>
          </td>
          <td className="px-2 py-2">
            <div className="space-y-1">
              <span className="text-xs text-transparent">Margin</span>
              <div className="text-sm text-muted-foreground">{computeMargin(draft.rate || '0', draft.cost || '0') ?? '—'}</div>
            </div>
          </td>
          <td className="px-2 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Tax</Label>
              <Select
                value={draft.taxItemId ?? ''}
                onValueChange={(v) => setDraft((d) => ({ ...d, taxItemId: v || null }))}
              >
                <SelectTrigger className="h-8 px-1.5 text-xs w-full md:w-auto">
                  <SelectValue placeholder="No Tax">
                    {draft.taxItemId
                      ? (() => {
                          const t = referenceData.taxItems.find((x) => x.id === draft.taxItemId)
                          return t ? `${t.name} (${t.rate}%)` : draft.taxItemId
                        })()
                      : null}
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
            </div>
          </td>
        </>
      )}
      <td className="px-2 py-2">
        <div className="space-y-1">
          <span className="text-xs text-transparent">Action</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onSave(draft)}>Save</Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function AddRow({
  groupId,
  referenceData,
  isTechnician,
  onSave,
  onCancel,
  onOpenCreateCatalog,
}: {
  groupId: string | null
  referenceData: ReferenceData
  isTechnician: boolean
  onSave: (item: LineItemRow) => void
  onCancel: () => void
  onOpenCreateCatalog: (kind: 'product' | 'service', defaultName: string, type: 'edit' | 'add') => void
}) {
  const [type, setType] = React.useState<LineItemRow['type']>('service')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [qty, setQty] = React.useState('1')
  const [rate, setRate] = React.useState('')
  const [cost, setCost] = React.useState('')
  const [taxItemId, setTaxItemId] = React.useState<string | null>(null)
  const search = useCatalogSearch()
  const isCatalog = type === 'product' || type === 'service'

  function handleSave() {
    onSave({
      id: crypto.randomUUID(),
      type,
      refId: null,
      title: title.trim() || null,
      description: description.trim(),
      qty,
      rate: type === 'discount' ? `-${Math.abs(parseFloat(rate || '0'))}` : rate || '0',
      cost: cost || '0',
      taxItemId,
      groupId,
    })
  }

  return (
    <tr className="border-b bg-muted/20 align-top">
      <td className="px-2 py-2">
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Item</Label>
            <div className="flex items-center gap-2">
              <Select value={type} onValueChange={(v) => setType(v as LineItemRow['type'])}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
              {isCatalog ? (
                <SearchDropdown
                  kind={type as 'product' | 'service'}
                  query={search.query}
                  results={search.results}
                  loading={search.loading}
                  onQueryChange={(q) => {
                    setTitle(q)
                    search.search(q, type as 'product' | 'service')
                  }}
                  onSelect={(r) => {
                    setTitle(r.name)
                    setDescription(r.description ?? '')
                    setRate(r.unitPrice ?? '0')
                    setCost(r.unitCost ?? '')
                    search.setQuery(r.name)
                    search.setResults([])
                  }}
                  onCreateNew={() => onOpenCreateCatalog(type as 'product' | 'service', title, 'add')}
                  onAddCustom={(q) => {
                    setTitle(q)
                    setDescription('')
                    setRate('')
                    setCost('')
                    search.setQuery(q)
                    search.setResults([])
                  }}
                />
              ) : (
                <Input
                  aria-label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === 'discount' ? 'Discount description' : 'Title'}
                />
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={2}
            />
          </div>
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="space-y-1">
          <Label className="text-xs">Qty</Label>
          <Input
            aria-label="Quantity"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            className="w-full md:w-20"
            disabled={type === 'discount'}
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="space-y-1">
          <Label className="text-xs">Rate</Label>
          <Input
            aria-label="Rate"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="Rate"
            className="w-full md:w-24"
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="space-y-1">
          <span className="text-xs text-transparent">Total</span>
          <div className="text-sm text-muted-foreground">
            ${toMoney(parseMoney(rate) * (parseFloat(qty || '0') || 0))}
          </div>
        </div>
      </td>
      {!isTechnician && (
        <>
          <td className="px-2 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Cost</Label>
              <Input
                aria-label="Cost"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Cost"
                className="w-full md:w-24"
              />
            </div>
          </td>
          <td className="px-2 py-2">
            <div className="space-y-1">
              <span className="text-xs text-transparent">Margin</span>
              <div className="text-sm text-muted-foreground">{computeMargin(rate || '0', cost || '0') ?? '—'}</div>
            </div>
          </td>
          <td className="px-2 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Tax</Label>
              <Select value={taxItemId ?? ''} onValueChange={(v) => setTaxItemId(v || null)}>
                <SelectTrigger className="h-8 px-1.5 text-xs w-full md:w-auto">
                  <SelectValue placeholder="No Tax">
                    {taxItemId
                      ? (() => {
                          const t = referenceData.taxItems.find((x) => x.id === taxItemId)
                          return t ? `${t.name} (${t.rate}%)` : taxItemId
                        })()
                      : null}
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
            </div>
          </td>
        </>
      )}
      <td className="px-2 py-2">
        <div className="space-y-1">
          <span className="text-xs text-transparent">Action</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleSave}>Add</Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      </td>
    </tr>
  )
}
