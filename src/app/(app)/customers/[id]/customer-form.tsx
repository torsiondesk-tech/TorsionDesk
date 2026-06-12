'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  createCustomer,
  updateCustomer,
  type CustomerActionState,
} from '../actions'
import { TagSelect, type TagOption } from '@/components/tag-select'
import { ReferralSelect, type ReferralOption } from '@/components/referral-select'
import { CustomerSearch } from '@/components/customer-search'

export interface CustomerFormData {
  id?: string
  name: string
  vip: boolean
  active: boolean
  parentCustomerId?: string | null
  assignedAgentId?: string | null
  referralSourceId?: string | null
  internalNotes?: string
  publicNotes?: string
  tagIds?: string[]
}

interface CustomerFormProps {
  mode: 'create' | 'edit'
  initial?: CustomerFormData
  availableTags: TagOption[]
  referralOptions: ReferralOption[]
  parentCustomerLabel?: string
}

export function CustomerForm({
  mode,
  initial,
  availableTags,
  referralOptions,
  parentCustomerLabel,
}: CustomerFormProps) {
  const router = useRouter()
  const action = mode === 'create' ? createCustomer : updateCustomer
  const [state, formAction, pending] = useActionState<
    CustomerActionState,
    FormData
  >(action, {})

  const [vip, setVip] = useState(initial?.vip ?? false)
  const [active, setActive] = useState(initial?.active ?? true)

  useEffect(() => {
    if (state.success && state.id) {
      router.push(`/customers/${state.id}`)
    }
  }, [state, router])

  const title = mode === 'create' ? 'New Customer' : 'Edit Customer'
  const cta = mode === 'create' ? 'Save Customer' : 'Update Customer'

  const defaultTags = availableTags.filter((t) =>
    initial?.tagIds?.includes(t.id)
  )

  return (
    <div className="mx-auto max-w-4xl animate-in fade-in-0 duration-300">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            {mode === 'edit' && initial?.id && (
              <input type="hidden" name="id" value={initial.id} />
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {/* LEFT COLUMN */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer name *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={initial?.name}
                    placeholder="Acme Property Management"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNo">Account number</Label>
                  <Input
                    id="accountNo"
                    name="accountNo"
                    disabled
                    placeholder="Assigned automatically when you save."
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Assigned automatically when you save.
                  </p>
                </div>

                {/* Base UI Checkbox does not render a native input, so hidden
                    inputs carry the real form values. */}
                <input type="hidden" name="vip" value={vip ? '1' : '0'} />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vip"
                    checked={vip}
                    onCheckedChange={(c) => setVip(c === true)}
                  />
                  <Label htmlFor="vip" className="cursor-pointer">VIP customer</Label>
                </div>

                <input type="hidden" name="active" value={active ? '1' : '0'} />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="active"
                    checked={active}
                    onCheckedChange={(c) => setActive(c === true)}
                  />
                  <Label htmlFor="active" className="cursor-pointer">Active</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentCustomerId">Parent Account</Label>
                  <CustomerSearch
                    name="parentCustomerId"
                    defaultValue={initial?.parentCustomerId ?? undefined}
                    defaultLabel={parentCustomerLabel}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <TagSelect
                    name="tagIds"
                    availableTags={availableTags}
                    defaultSelected={defaultTags}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Referral source</Label>
                  <ReferralSelect
                    name="referralSourceId"
                    options={referralOptions}
                    defaultValue={initial?.referralSourceId ?? undefined}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="internalNotes">Internal notes</Label>
                  <Textarea
                    id="internalNotes"
                    name="internalNotes"
                    defaultValue={initial?.internalNotes}
                    placeholder="Office-only notes…"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publicNotes">Public / work-order notes</Label>
                  <Textarea
                    id="publicNotes"
                    name="publicNotes"
                    defaultValue={initial?.publicNotes}
                    placeholder="Notes that appear on jobs…"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p role="status" className="text-sm text-emerald-600">
                Saved.
              </p>
            ) : null}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : cta}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
