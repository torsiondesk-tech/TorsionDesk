'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
        <select
          id="role"
          name="role"
          defaultValue="org:dispatcher"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none sm:w-44"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
