'use client'

import { useState, useMemo, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, ChevronDown, Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { useLiveQuery } from 'dexie-react-hooks'
import { createTechDb, type CachedEquipment } from '@/app/(tech)/lib/dexie'
import {
  createTechEquipmentAction,
  updateTechEquipmentAction,
  deleteTechEquipmentAction,
} from '../tech/jobs/actions'

interface EquipmentSectionProps {
  orgId: string
  jobId: string
  serviceLocationId: string | null | undefined
  serverEquipment: CachedEquipment[]
}

export function EquipmentSection({
  orgId,
  jobId,
  serviceLocationId,
  serverEquipment,
}: EquipmentSectionProps) {
  const db = useMemo(() => createTechDb(orgId), [orgId])
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!serverEquipment.length) return
    void db.equipment.bulkPut(serverEquipment)
  }, [db, serverEquipment])

  const cached = useLiveQuery<CachedEquipment[]>(
    () =>
      serviceLocationId
        ? db.equipment.where({ serviceLocationId }).toArray()
        : Promise.resolve([]),
    [db, serviceLocationId],
  )

  const items = cached?.length ? cached : serverEquipment

  const grouped = useMemo(() => {
    const byKind = new Map<CachedEquipment['kind'], CachedEquipment[]>()
    for (const item of items) {
      const list = byKind.get(item.kind) ?? []
      list.push(item)
      byKind.set(item.kind, list)
    }
    return byKind
  }, [items])

  function handleDelete(equipmentId: string) {
    startTransition(async () => {
      await db.equipment.delete(equipmentId)
      await deleteTechEquipmentAction(equipmentId, jobId)
      setEditingId(null)
      router.refresh()
    })
  }

  return (
    <Collapsible defaultOpen={true}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Equipment &amp; Spring Specs</CardTitle>
            </div>
            <ChevronDown className="size-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4">
            {!serviceLocationId ? (
              <p className="text-sm text-muted-foreground">
                Set a service location first to manage equipment.
              </p>
            ) : items.length === 0 && !showForm ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-sm text-muted-foreground">No equipment recorded for this location.</p>
                <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                  <Plus className="mr-1.5 size-3.5" />
                  Add Equipment
                </Button>
              </div>
            ) : (
              <>
                {(['door', 'opener', 'spring'] as const).map((kind) => {
                  const list = grouped.get(kind)
                  if (!list || list.length === 0) return null
                  return (
                    <div key={kind}>
                      <p className="mb-2 text-sm font-medium">
                        {kind === 'door' ? 'Door specs' : kind === 'opener' ? 'Opener specs' : 'Spring specs'}
                      </p>
                      <div className="flex flex-col gap-2">
                        {list.map((eq) =>
                          editingId === eq.id ? (
                            <EditEquipmentForm
                              key={eq.id}
                              item={eq}
                              jobId={jobId}
                              isPendingDelete={isPending}
                              onSuccess={() => {
                                setEditingId(null)
                                router.refresh()
                              }}
                              onCancel={() => setEditingId(null)}
                              onDelete={() => handleDelete(eq.id)}
                            />
                          ) : (
                            <div key={eq.id} className="rounded-lg border p-3 text-sm">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  {eq.kind === 'door' && <DoorSpecs eq={eq} />}
                                  {eq.kind === 'opener' && <OpenerSpecs eq={eq} />}
                                  {eq.kind === 'spring' && <SpringSpecs eq={eq} />}
                                  {eq.notes && (
                                    <p className="mt-2 text-xs text-muted-foreground">{eq.notes}</p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => setEditingId(eq.id)}
                                  aria-label="Edit equipment"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )
                })}

                {!showForm && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => setShowForm(true)}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add Equipment
                  </Button>
                )}
              </>
            )}

            {serviceLocationId && showForm && (
              <AddEquipmentForm
                orgId={orgId}
                jobId={jobId}
                serviceLocationId={serviceLocationId}
                onSuccess={() => {
                  setShowForm(false)
                  router.refresh()
                }}
                onCancel={() => setShowForm(false)}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ── Read-only spec renderers ───────────────────────────────────────────────────

function DoorSpecs({ eq }: { eq: CachedEquipment }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Spec label="Brand" value={eq.brand} />
      <Spec label="Model" value={eq.modelSeries} />
      <Spec label="Size" value={eq.widthFt && eq.heightFt ? `${eq.widthFt} × ${eq.heightFt}` : null} />
      <Spec label="Material" value={eq.material} />
      <Spec label="Style" value={eq.style} />
      <Spec label="Color" value={eq.color} />
    </div>
  )
}

function OpenerSpecs({ eq }: { eq: CachedEquipment }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Spec label="Brand" value={eq.brand} />
      <Spec label="Model" value={eq.model} />
      <Spec label="HP" value={eq.hp} />
      <Spec label="Serial" value={eq.serial} />
    </div>
  )
}

function SpringSpecs({ eq }: { eq: CachedEquipment }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Spec label="Wire size" value={eq.wireSize} />
      <Spec label="Inside diameter" value={eq.insideDiameter} />
      <Spec label="Length" value={eq.length} />
      <Spec label="Wind" value={eq.windDirection} />
      <Spec label="Cycle rating" value={eq.cycleRating?.toString() ?? null} />
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function EditEquipmentForm({
  item,
  jobId,
  isPendingDelete,
  onSuccess,
  onCancel,
  onDelete,
}: {
  item: CachedEquipment
  jobId: string
  isPendingDelete: boolean
  onSuccess: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('kind', item.kind)
    setError(null)
    startTransition(async () => {
      const result = await updateTechEquipmentAction(item.id, jobId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const busy = isPending || isPendingDelete

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium capitalize">Edit {item.kind}</p>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Door fields */}
      {item.kind === 'door' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="eq-edit-brand">Brand *</Label>
            <Input id="eq-edit-brand" name="brand" required autoComplete="off" defaultValue={item.brand ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-widthFt">Width (ft) *</Label>
            <Input id="eq-edit-widthFt" name="widthFt" inputMode="decimal" required defaultValue={item.widthFt ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-heightFt">Height (ft) *</Label>
            <Input id="eq-edit-heightFt" name="heightFt" inputMode="decimal" required defaultValue={item.heightFt ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-modelSeries">Model Series</Label>
            <Input id="eq-edit-modelSeries" name="modelSeries" autoComplete="off" defaultValue={item.modelSeries ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-material">Material</Label>
            <Input id="eq-edit-material" name="material" autoComplete="off" defaultValue={item.material ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-style">Style</Label>
            <Input id="eq-edit-style" name="style" autoComplete="off" defaultValue={item.style ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-color">Color</Label>
            <Input id="eq-edit-color" name="color" autoComplete="off" defaultValue={item.color ?? ''} />
          </div>
        </div>
      )}

      {/* Opener fields */}
      {item.kind === 'opener' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="eq-edit-brand">Brand *</Label>
            <Input id="eq-edit-brand" name="brand" required autoComplete="off" defaultValue={item.brand ?? ''} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="eq-edit-model">Model</Label>
            <Input id="eq-edit-model" name="model" autoComplete="off" defaultValue={item.model ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-hp">HP</Label>
            <Input id="eq-edit-hp" name="hp" inputMode="decimal" defaultValue={item.hp ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-serial">Serial</Label>
            <Input id="eq-edit-serial" name="serial" autoComplete="off" defaultValue={item.serial ?? ''} />
          </div>
        </div>
      )}

      {/* Spring fields */}
      {item.kind === 'spring' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-wireSize">Wire Size *</Label>
            <Input id="eq-edit-wireSize" name="wireSize" inputMode="decimal" required placeholder="e.g. 0.225" defaultValue={item.wireSize ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-insideDiameter">Inside Dia. *</Label>
            <Input id="eq-edit-insideDiameter" name="insideDiameter" inputMode="decimal" required placeholder="e.g. 2.0" defaultValue={item.insideDiameter ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-length">Length (in) *</Label>
            <Input id="eq-edit-length" name="length" inputMode="decimal" required defaultValue={item.length ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-edit-windDirection">Wind Direction *</Label>
            <select
              id="eq-edit-windDirection"
              name="windDirection"
              defaultValue={item.windDirection ?? 'left'}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="pair">Pair</option>
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="eq-edit-cycleRating">Cycle Rating</Label>
            <Input id="eq-edit-cycleRating" name="cycleRating" inputMode="numeric" placeholder="e.g. 10000" defaultValue={item.cycleRating?.toString() ?? ''} />
          </div>
        </div>
      )}

      {/* Common fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="eq-edit-installDate">Install Date</Label>
          <Input id="eq-edit-installDate" name="installDate" type="date" defaultValue={item.installDate ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eq-edit-warrantyExpires">Warranty Expires</Label>
          <Input id="eq-edit-warrantyExpires" name="warrantyExpires" type="date" defaultValue={item.warrantyExpires ?? ''} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="eq-edit-notes">Notes</Label>
          <Input id="eq-edit-notes" name="notes" placeholder="Additional details…" defaultValue={item.notes ?? ''} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <Button type="submit" size="sm" disabled={busy} className="self-start">
          <Save className="mr-1.5 size-3.5" />
          {isPending ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          {isPendingDelete ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </form>
  )
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddEquipmentForm({
  orgId: _orgId,
  jobId,
  serviceLocationId,
  onSuccess,
  onCancel,
}: {
  orgId: string
  jobId: string
  serviceLocationId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<'door' | 'opener' | 'spring'>('door')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('kind', kind)
    setError(null)
    startTransition(async () => {
      const result = await createTechEquipmentAction(serviceLocationId, jobId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Add Equipment</p>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Kind selector */}
      <div className="grid grid-cols-3 gap-1.5 rounded-lg border p-1 bg-background">
        {(['door', 'opener', 'spring'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-md py-1.5 text-sm font-medium transition-colors capitalize ${
              kind === k
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Door fields */}
      {kind === 'door' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="eq-brand">Brand *</Label>
            <Input id="eq-brand" name="brand" required autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-widthFt">Width (ft) *</Label>
            <Input id="eq-widthFt" name="widthFt" inputMode="decimal" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-heightFt">Height (ft) *</Label>
            <Input id="eq-heightFt" name="heightFt" inputMode="decimal" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-modelSeries">Model Series</Label>
            <Input id="eq-modelSeries" name="modelSeries" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-material">Material</Label>
            <Input id="eq-material" name="material" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-style">Style</Label>
            <Input id="eq-style" name="style" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-color">Color</Label>
            <Input id="eq-color" name="color" autoComplete="off" />
          </div>
        </div>
      )}

      {/* Opener fields */}
      {kind === 'opener' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="eq-brand">Brand *</Label>
            <Input id="eq-brand" name="brand" required autoComplete="off" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="eq-model">Model</Label>
            <Input id="eq-model" name="model" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-hp">HP</Label>
            <Input id="eq-hp" name="hp" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-serial">Serial</Label>
            <Input id="eq-serial" name="serial" autoComplete="off" />
          </div>
        </div>
      )}

      {/* Spring fields */}
      {kind === 'spring' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="eq-wireSize">Wire Size *</Label>
            <Input id="eq-wireSize" name="wireSize" inputMode="decimal" required placeholder="e.g. 0.225" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-insideDiameter">Inside Dia. *</Label>
            <Input id="eq-insideDiameter" name="insideDiameter" inputMode="decimal" required placeholder="e.g. 2.0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-length">Length (in) *</Label>
            <Input id="eq-length" name="length" inputMode="decimal" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-windDirection">Wind Direction *</Label>
            <select
              id="eq-windDirection"
              name="windDirection"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="pair">Pair</option>
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="eq-cycleRating">Cycle Rating</Label>
            <Input id="eq-cycleRating" name="cycleRating" inputMode="numeric" placeholder="e.g. 10000" />
          </div>
        </div>
      )}

      {/* Common fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="eq-installDate">Install Date</Label>
          <Input id="eq-installDate" name="installDate" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eq-warrantyExpires">Warranty Expires</Label>
          <Input id="eq-warrantyExpires" name="warrantyExpires" type="date" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="eq-notes">Notes</Label>
          <Input id="eq-notes" name="notes" placeholder="Additional details…" />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        <Save className="mr-1.5 size-3.5" />
        {isPending ? 'Saving…' : 'Save Equipment'}
      </Button>
    </form>
  )
}
