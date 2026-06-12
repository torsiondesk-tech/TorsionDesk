'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
import { deactivateCustomer } from '../actions'

export function CustomerActionBar({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [deactivating, setDeactivating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleDeactivate = async () => {
    setDeactivating(true)
    try {
      await deactivateCustomer(customerId)
      router.refresh()
      setDialogOpen(false)
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link href={`/customers/${customerId}/edit`}>
        <Button variant="outline" size="sm">Edit Customer</Button>
      </Link>

      <Button variant="outline" size="sm" disabled title="Available in a later release">
        New Job
      </Button>
      <Button variant="outline" size="sm" disabled title="Available in a later release">
        New Estimate
      </Button>

      <Link href={`/customers/merge?a=${customerId}`}>
        <Button variant="outline" size="sm">Merge</Button>
      </Link>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            Deactivate
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate this customer?</DialogTitle>
            <DialogDescription>
              They&apos;ll be hidden from the active list but their records are kept.
              You can reactivate them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
