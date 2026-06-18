'use client'

import { useEffect, useMemo } from 'react'
import { Wrench, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { useLiveQuery } from 'dexie-react-hooks'
import { createTechDb, type CachedEquipment } from '@/app/(tech)/lib/dexie'
import { cn } from '@/lib/utils'

interface EquipmentSectionProps {
  orgId: string
  serviceLocationId: string | null | undefined
  serverEquipment: CachedEquipment[]
}

export function EquipmentSection({
  orgId,
  serviceLocationId,
  serverEquipment,
}: EquipmentSectionProps) {
  const db = useMemo(() => createTechDb(orgId), [orgId])

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

  if (!serviceLocationId) {
    return (
      <p className="text-sm text-muted-foreground">No service location on file.</p>
    )
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No equipment recorded for this location.</p>
    )
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
            {(['door', 'opener', 'spring'] as const).map((kind) => {
              const list = grouped.get(kind)
              if (!list || list.length === 0) return null
              return (
                <div key={kind}>
                  <p className="mb-2 text-sm font-medium capitalize">{
                    kind === 'door' ? 'Door specs' : kind === 'opener' ? 'Opener specs' : 'Spring specs'
                  }</p>
                  <div className="flex flex-col gap-2">
                    {list.map((eq) => (
                      <div
                        key={eq.id}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <DoorSpecs eq={eq} />
                        <OpenerSpecs eq={eq} />
                        <SpringSpecs eq={eq} />
                        {eq.notes && (
                          <p className="mt-2 text-xs text-muted-foreground">{eq.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function DoorSpecs({ eq }: { eq: CachedEquipment }) {
  if (eq.kind !== 'door') return null
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
  if (eq.kind !== 'opener') return null
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
  if (eq.kind !== 'spring') return null
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

function Spec({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
