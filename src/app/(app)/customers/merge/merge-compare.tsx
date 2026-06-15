'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { submitMerge, type MergeActionState } from './merge-actions'

interface CustomerRecord {
  id: string
  name: string
  accountNo: number
  active: boolean | null
  vip: boolean | null
  internalNotes: string | null
  publicNotes: string | null
  createdAt: Date | null
}

interface MergeCompareProps {
  a: CustomerRecord
  b: CustomerRecord
}

const FIELDS: Array<{
  key: keyof CustomerRecord
  label: string
  render: (v: CustomerRecord[keyof CustomerRecord]) => string
}> = [
  { key: 'name', label: 'Name', render: (v) => String(v ?? '') },
  { key: 'accountNo', label: 'Account #', render: (v) => String(v ?? '') },
  { key: 'active', label: 'Active', render: (v) => (v ? 'Yes' : 'No') },
  { key: 'vip', label: 'VIP', render: (v) => (v ? 'Yes' : 'No') },
  { key: 'internalNotes', label: 'Internal Notes', render: (v) => String(v ?? '') },
  { key: 'publicNotes', label: 'Public Notes', render: (v) => String(v ?? '') },
]

export function MergeCompare({ a, b }: MergeCompareProps) {
  const router = useRouter()
  const [choices, setChoices] = useState<Record<string, 'left' | 'right'>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [state, formAction, pending] = useActionState<MergeActionState, FormData>(
    submitMerge,
    {},
  )

  const toggleField = (field: string, side: 'left' | 'right') => {
    setChoices((prev) => ({ ...prev, [field]: side }))
  }

  const winner = choices.name === 'left' ? a : b
  const loser = choices.name === 'left' ? b : a

  if (state.success) {
    router.push(`/customers/${winner.id}`)
    return null
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="winnerId" value={winner.id} />
      <input type="hidden" name="loserId" value={loser.id} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT — Record A */}
        <Card className={choices.name === 'left' ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="text-base">{a.name}</CardTitle>
            <p className="text-sm text-muted-foreground">Account #{a.accountNo}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleField(f.key, 'left')}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  choices[f.key] === 'left'
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:bg-muted'
                }`}
              >
                <span>
                  <span className="text-muted-foreground">{f.label}: </span>
                  <span className="font-medium">{f.render(a[f.key])}</span>
                </span>
                <span
                  className={`size-4 rounded-full border ${
                    choices[f.key] === 'left'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* RIGHT — Record B */}
        <Card className={choices.name === 'right' ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <CardTitle className="text-base">{b.name}</CardTitle>
            <p className="text-sm text-muted-foreground">Account #{b.accountNo}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleField(f.key, 'right')}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  choices[f.key] === 'right'
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:bg-muted'
                }`}
              >
                <span>
                  <span className="text-muted-foreground">{f.label}: </span>
                  <span className="font-medium">{f.render(b[f.key])}</span>
                </span>
                <span
                  className={`size-4 rounded-full border ${
                    choices[f.key] === 'right'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Hidden inputs for field choices */}
      {Object.entries(choices).map(([field, side]) => (
        <input
          key={field}
          type="hidden"
          name={`field_${field}`}
          value={side}
        />
      ))}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex justify-end">
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger
            render={<Button type="button" disabled={!choices.name || pending} />}
          >
            Merge &amp; Archive
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Merge into one record?</DialogTitle>
              <DialogDescription>
                “{loser.name}” will be archived and all its contacts, locations,
                and equipment move to “{winner.name}”. This can&apos;t be
                auto-undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  // Allow the form to submit; close dialog visually
                  setConfirmOpen(false)
                }}
              >
                {pending ? 'Merging…' : 'Merge &amp; Archive'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </form>
  )
}
