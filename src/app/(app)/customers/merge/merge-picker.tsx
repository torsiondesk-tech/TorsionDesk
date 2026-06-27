'use client'

import { useRouter } from 'next/navigation'
import { CustomerSearch } from '@/components/customer-search'
import { Card, CardContent } from '@/components/ui/card'

interface MergePickerProps {
  aId: string
  aName: string
}

export function MergePicker({ aId, aName }: MergePickerProps) {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Merge Customers</h1>
        <p className="text-sm text-muted-foreground">
          Search for the duplicate to merge into <strong>{aName}</strong>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm font-medium">Select the customer to merge</p>
          <CustomerSearch
            name="bId"
            onChange={(id) => {
              if (id && id !== aId) {
                router.push(`/customers/merge?a=${aId}&b=${id}`)
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            The selected customer will be compared side-by-side with <strong>{aName}</strong>.
            The losing record will be archived after the merge.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
