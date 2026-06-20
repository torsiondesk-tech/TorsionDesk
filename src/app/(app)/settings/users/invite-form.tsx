'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inviteUser, type InviteState } from './actions'

/**
 * Invite-by-email form (AUTH-02, D-06).
 *
 * Email input + a role select offering exactly Admin / Dispatcher / Technician,
 * mapped to the Clerk org-role keys `org:admin` / `org:dispatcher` /
 * `org:technician` (A2). Submits to the `inviteUser` server action, which calls
 * Clerk's built-in organization invitation API. Global UI quality standard:
 * shadcn primitives, consistent spacing, clear hierarchy, entrance animation.
 */
const initialState: InviteState = {}

// Exactly the three allowed roles, label → Clerk key (A2).
const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Admin', value: 'org:admin' },
  { label: 'Dispatcher', value: 'org:dispatcher' },
  { label: 'Technician', value: 'org:technician' },
]

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUser, initialState)
  const [role, setRole] = useState('org:dispatcher')

  return (
    <form
      action={formAction}
      className="flex flex-col flex-wrap gap-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="teammate@example.com"
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <input type="hidden" name="role" value={role} />
        <Select value={role} onValueChange={(val) => { if (val) setRole(val) }}>
          <SelectTrigger id="role" className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send invite'}
      </Button>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-emerald-600 sm:basis-full">
          {state.success}
        </p>
      ) : null}
    </form>
  )
}
