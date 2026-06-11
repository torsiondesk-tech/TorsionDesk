'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth, clerkClient } from '@clerk/nextjs/server'

/**
 * Users settings server actions (AUTH-02, D-06).
 *
 * Team invitations use Clerk's BUILT-IN organization invitation system: the admin
 * enters an email + role, Clerk sends the invite email and owns the accept flow.
 * There is NO custom invitation-token table and NO Resend invite email in Phase 0
 * (D-06) — we only call the Clerk backend SDK.
 *
 * The chosen role maps to one of EXACTLY three Clerk org-role keys (RESEARCH A2).
 * `role` is constrained by zod to those keys so an admin can never invite with an
 * arbitrary/elevated role (T-00-10). /settings is admin-gated by middleware
 * (Plan 03, T-00-06), so only an admin reaches this action.
 */

// The three allowed Clerk org-role keys — never invent new keys (A2).
const ROLE_KEYS = ['org:admin', 'org:dispatcher', 'org:technician'] as const

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(ROLE_KEYS),
})

export type InviteState = { error?: string; success?: string }

/**
 * Invite a teammate by email with a role via Clerk org invitations.
 *
 * Signature note: exported as a 2-arg `useActionState` action (prevState,
 * formData). The plan's `inviteUser(email, role)` contract is satisfied — email
 * and role are read from the form; the underlying call is
 * `createOrganizationInvitation({ organizationId, emailAddress, role })`.
 */
export async function inviteUser(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { orgId, userId } = await auth()
  if (!orgId) {
    return { error: 'No active organization.' }
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your input.' }
  }

  const client = await clerkClient()
  try {
    await client.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: parsed.data.email,
      role: parsed.data.role,
      inviterUserId: userId ?? undefined,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not send the invitation.'
    return { error: message }
  }

  revalidatePath('/settings/users')
  return { success: `Invitation sent to ${parsed.data.email}.` }
}

/** A normalized member row for the Users tab list. */
export type MemberRow = { id: string; label: string; role: string }
/** A normalized pending-invitation row for the Users tab list. */
export type InviteRow = { id: string; email: string; role: string }

/** Read current org members + pending invitations for the active tenant. */
export async function listOrgPeople(): Promise<{
  members: MemberRow[]
  pending: InviteRow[]
}> {
  const { orgId } = await auth()
  if (!orgId) return { members: [], pending: [] }

  const client = await clerkClient()

  const [memberships, invitations] = await Promise.all([
    client.organizations.getOrganizationMembershipList({ organizationId: orgId }),
    client.organizations.getOrganizationInvitationList({
      organizationId: orgId,
      status: ['pending'],
    }),
  ])

  const members: MemberRow[] = memberships.data.map((m) => ({
    id: m.id,
    label:
      m.publicUserData?.identifier ||
      [m.publicUserData?.firstName, m.publicUserData?.lastName]
        .filter(Boolean)
        .join(' ') ||
      'Member',
    role: m.role,
  }))

  const pending: InviteRow[] = invitations.data.map((i) => ({
    id: i.id,
    email: i.emailAddress,
    role: i.role,
  }))

  return { members, pending }
}
