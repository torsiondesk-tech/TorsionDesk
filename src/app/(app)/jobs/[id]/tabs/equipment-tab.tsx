import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getEquipmentByServiceLocation } from '@/lib/customers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface EquipmentTabProps {
  serviceLocationId: string | null
}

function kindLabel(kind: string) {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

export async function EquipmentTab({ serviceLocationId }: EquipmentTabProps) {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  if (!serviceLocationId) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <p className="text-muted-foreground">
          No equipment on file for this service location.
        </p>
      </div>
    )
  }

  const equipment = await getEquipmentByServiceLocation(orgId, serviceLocationId)

  if (equipment.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <p className="text-muted-foreground">
          No equipment on file for this service location.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {equipment.map((eq) => (
        <Card key={eq.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{eq.brand ?? 'Unknown Brand'}</CardTitle>
              <Badge variant="outline">{kindLabel(eq.kind)}</Badge>
            </div>
            {eq.model && (
              <p className="text-sm text-muted-foreground">{eq.model}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {eq.kind === 'door' && (
              <>
                {eq.widthFt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Width</span>
                    <span>{eq.widthFt} ft</span>
                  </div>
                )}
                {eq.heightFt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Height</span>
                    <span>{eq.heightFt} ft</span>
                  </div>
                )}
              </>
            )}
            {eq.kind === 'spring' && (
              <>
                {eq.wireSize && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wire Size</span>
                    <span>{eq.wireSize}</span>
                  </div>
                )}
                {eq.windDirection && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wind</span>
                    <span className="capitalize">{eq.windDirection}</span>
                  </div>
                )}
              </>
            )}
            {eq.installDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Installed</span>
                <span>{new Date(eq.installDate).toLocaleDateString()}</span>
              </div>
            )}
            {eq.notes && (
              <p className="text-muted-foreground">{eq.notes}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
