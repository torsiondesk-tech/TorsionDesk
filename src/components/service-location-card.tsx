'use client'

import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface ServiceLocationCardLocation {
  id: string
  name: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  gated: boolean | null
}

export function isRedundantLocationName(
  name: string | null,
  addressLine1: string | null,
  city: string | null,
): boolean {
  if (!name || !addressLine1) return true
  const n = name.trim().toLowerCase().replace(/,\s*/g, ',')
  const a1 = addressLine1.trim().toLowerCase()
  const a1City = [addressLine1, city].filter(Boolean).join(', ').toLowerCase().replace(/,\s*/g, ',')
  return n === a1 || n === a1City || n.startsWith(a1 + ',')
}

interface ServiceLocationCardProps {
  location: ServiceLocationCardLocation | undefined
  isPrimary: boolean
  /** Omit for new-customer flow where no DB customer exists yet */
  onSetPrimary?: () => Promise<void>
  onEditAddress: () => void
  onChangeLocation: () => void
  onNewAddress: () => void
}

export function ServiceLocationCard({
  location,
  isPrimary,
  onSetPrimary,
  onEditAddress,
  onChangeLocation,
  onNewAddress,
}: ServiceLocationCardProps) {
  const cityStateZip = location
    ? [location.city, location.state, location.postalCode].filter(Boolean).join(', ')
    : ''

  return (
    <div className="rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm">
      <div className="space-y-0.5">
        {location ? (
          <>
            {!isRedundantLocationName(location.name, location.addressLine1, location.city) && (
              <div className="font-medium">{location.name}</div>
            )}
            {location.addressLine1 && (
              <div className="text-muted-foreground">{location.addressLine1}</div>
            )}
            {location.addressLine2 && (
              <div className="text-muted-foreground">{location.addressLine2}</div>
            )}
            {cityStateZip && (
              <div className="text-muted-foreground">{cityStateZip}</div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {isPrimary && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Primary</Badge>
              )}
              {location.gated && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Gated Property</Badge>
              )}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">Loading…</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {onSetPrimary && (
          isPrimary ? (
            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <Star className="size-3 fill-amber-500 text-amber-500" />
              Primary
            </span>
          ) : (
            <button
              type="button"
              onClick={onSetPrimary}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Star className="size-3" />
              Set as Primary
            </button>
          )
        )}
        <button
          type="button"
          onClick={onEditAddress}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Edit address
        </button>
        <button
          type="button"
          onClick={onChangeLocation}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Change location
        </button>
        <button
          type="button"
          onClick={onNewAddress}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + New address
        </button>
      </div>
    </div>
  )
}
