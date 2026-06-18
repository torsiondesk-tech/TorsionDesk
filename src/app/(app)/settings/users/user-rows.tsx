'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useActionState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPhoneInput } from '@/lib/utils'
import {
  removeMember,
  revokeInvitation,
  saveProfile,
  updateMemberRole,
  type InviteState,
} from './actions'

const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Admin', value: 'org:admin' },
  { label: 'Dispatcher', value: 'org:dispatcher' },
  { label: 'Technician', value: 'org:technician' },
]

const initialState: InviteState = {}

function roleLabel(key: string): string {
  const map: Record<string, string> = {
    'org:admin': 'Admin',
    'org:dispatcher': 'Dispatcher',
    'org:technician': 'Technician',
  }
  return map[key] ?? key
}

/** Interactive row for a team member with profile edit, role change + remove. */
export function MemberRow({
  id,
  userId,
  label,
  role,
  firstName,
  lastName,
  phone,
  email,
  address,
  dateOfBirth,
  currentUserId,
}: {
  id: string
  userId: string
  label: string
  role: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  address: string | null
  dateOfBirth: string | null
  currentUserId: string | null
}) {
  const [roleState, roleFormAction, rolePending] = useActionState(updateMemberRole, initialState)
  const [profileState, profileFormAction, profilePending] = useActionState(saveProfile, initialState)
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedRole, setSelectedRole] = useState(role)
  const [roleDirty, setRoleDirty] = useState(false)
  const isSelf = userId === currentUserId
  const prevRoleRef = useRef(role)

  // Sync select with prop when the user has no pending change AND the prop actually changed.
  useEffect(() => {
    if (!roleDirty && role !== prevRoleRef.current) {
      setSelectedRole(role)
      prevRoleRef.current = role
    }
  }, [role, roleDirty])

  // Hide the checkmark as soon as the role save succeeds.
  useEffect(() => {
    if (roleState.success) {
      setRoleDirty(false)
    }
  }, [roleState])

  // Controlled form state so we never rely on defaultValue / React auto-reset.
  const [form, setForm] = useState({
    firstName: firstName ?? '',
    lastName: lastName ?? '',
    phone: formatPhoneInput(phone ?? ''),
    email: email ?? '',
    address: address ?? '',
    dateOfBirth: dateOfBirth ?? '',
  })

  const formRef = useRef<HTMLFormElement>(null)

  const openEditor = useCallback(() => {
    setEditing(true)
    // Sync latest props into controlled state when opening.
    setForm({
      firstName: firstName ?? '',
      lastName: lastName ?? '',
      phone: formatPhoneInput(phone ?? ''),
      email: email ?? '',
      address: address ?? '',
      dateOfBirth: dateOfBirth ?? '',
    })
  }, [firstName, lastName, phone, email, address, dateOfBirth])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return
    const fd = new FormData(formRef.current)
    startTransition(() => {
      profileFormAction(fd)
    })
  }

  return (
    <li className="flex flex-col gap-2 py-3 border-b border-border last:border-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-medium truncate">{label}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {email ? <span>{email}</span> : null}
            {phone ? <span>• {phone}</span> : null}
          </div>
          {roleState.error ? (
            <span className="text-xs text-destructive" role="alert">{roleState.error}</span>
          ) : roleState.success ? (
            <span className="text-xs text-emerald-600" role="status">{roleState.success}</span>
          ) : null}
          {profileState.error ? (
            <span className="text-xs text-destructive" role="alert">{profileState.error}</span>
          ) : profileState.success ? (
            <span className="text-xs text-emerald-600" role="status">{profileState.success}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Inline role change — pick role then click checkmark to confirm */}
          <form action={roleFormAction} className="flex items-center gap-2">
            <input type="hidden" name="membershipId" value={id} />
            <select
              name="role"
              value={selectedRole}
              disabled={isSelf}
              onChange={(e) => {
                const val = e.target.value
                setSelectedRole(val)
                setRoleDirty(val !== role)
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {roleDirty && !isSelf && (
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                disabled={rolePending}
                className="h-8 w-8 p-0"
                title="Save role"
              >
                {rolePending ? (
                  <span className="text-xs">…</span>
                ) : (
                  <Check className="h-4 w-4 text-emerald-600" />
                )}
              </Button>
            )}
          </form>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => (editing ? setEditing(false) : openEditor())}
          >
            {editing ? 'Close' : 'Edit profile'}
          </Button>

          {!isSelf && (
            <form
              action={async () => {
                await removeMember(userId)
              }}
            >
              <Button type="submit" size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive">
                Remove
              </Button>
            </form>
          )}
        </div>
      </div>

      {editing && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 p-3 rounded-lg bg-muted/50"
        >
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="membershipId" value={id} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">First name</label>
            <Input
              name="firstName"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              placeholder="First name"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Last name</label>
            <Input
              name="lastName"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="Last name"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Phone</label>
            <Input
              name="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
              placeholder="Phone number"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Email</label>
            <Input
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email address"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Role</label>
            <select
              name="role"
              defaultValue={role}
              disabled={isSelf}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date of birth</label>
            <Input
              name="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs text-muted-foreground">Address</label>
            <Input
              name="address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Street address"
              className="h-8 text-xs"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" size="sm" disabled={profilePending || isPending}>
              {profilePending || isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}

/** Interactive row for a pending invitation with revoke action. */
export function PendingRow({ id, email, role }: { id: string; email: string; role: string }) {
  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className="truncate">{email}</span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {roleLabel(role)}
        </span>
      </div>

      <form
        action={async () => {
          await revokeInvitation(id)
        }}
      >
        <Button type="submit" size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive">
          Revoke
        </Button>
      </form>
    </li>
  )
}
