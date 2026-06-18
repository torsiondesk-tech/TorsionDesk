'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import { teamProfiles } from '@/db/schema'
import { normalizePhone } from '@/lib/utils'

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
 *
 * ── Phone handling policy ────────────────────────────────────────────────────
 *  • DB stores RAW DIGITS ONLY (e.g. "7735597272").
 *  • Client-side formatting is display-only (e.g. "(773) 559-7272").
 *  • This ensures Twilio SMS, Stripe, and any downstream integration never has
 *    to strip parentheses or dashes.
 *  • `formatPhone` / `formatPhoneInput` in `lib/utils.ts` handle display.
 */

// The three allowed Clerk org-role keys — never invent new keys (A2).
const ROLE_KEYS = ['org:admin', 'org:dispatcher', 'org:technician'] as const

const inviteSchema = z.object({
  email: z.string().trim().max(255).email('Enter a valid email'),
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
  const { orgId, userId, orgRole } = await auth()
  if (!orgId) {
    return { error: 'No active organization.' }
  }

  // Defense-in-depth: re-verify caller is an org admin inside the action itself
  // (AUDIT-015) — middleware gates the route, but the action should not trust
  // that boundary alone.
  if (orgRole !== 'org:admin') {
    return { error: 'Only admins can invite users.' }
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

/** Revoke a pending organization invitation. */
export async function revokeInvitation(invitationId: string): Promise<InviteState> {
  const { orgId, orgRole } = await auth()
  if (!orgId) return { error: 'No active organization.' }
  if (orgRole !== 'org:admin') return { error: 'Only admins can revoke invitations.' }

  const client = await clerkClient()
  try {
    await client.organizations.revokeOrganizationInvitation({
      organizationId: orgId,
      invitationId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not revoke invitation.'
    return { error: message }
  }

  revalidatePath('/settings/users')
  return { success: 'Invitation revoked.' }
}

/** Remove a member from the organization. */
export async function removeMember(userId: string): Promise<InviteState> {
  const { orgId, orgRole, userId: currentUserId } = await auth()
  if (!orgId) return { error: 'No active organization.' }
  if (orgRole !== 'org:admin') return { error: 'Only admins can remove members.' }

  // Prevent self-removal so the admin doesn't lock themselves out.
  if (userId === currentUserId) {
    return { error: 'You cannot remove yourself.' }
  }

  const client = await clerkClient()

  // Prevent removing the last admin — count admins before deletion.
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
  })
  const admins = memberships.data.filter((m) => m.role === 'org:admin')
  const target = memberships.data.find((m) => m.publicUserData?.userId === userId)
  if (!target) return { error: 'Member not found.' }
  if (target.role === 'org:admin' && admins.length <= 1) {
    return { error: 'Cannot remove the last admin.' }
  }

  try {
    await client.organizations.deleteOrganizationMembership({
      organizationId: orgId,
      userId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not remove member.'
    return { error: message }
  }

  revalidatePath('/settings/users')
  return { success: 'Member removed.' }
}

const updateRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(ROLE_KEYS),
})

/** Update a member's organization role. */
export async function updateMemberRole(_prevState: InviteState, formData: FormData): Promise<InviteState> {
  const { orgId, orgRole, userId: currentUserId } = await auth()
  if (!orgId) return { error: 'No active organization.' }
  if (orgRole !== 'org:admin') return { error: 'Only admins can change roles.' }

  const parsed = updateRoleSchema.safeParse({
    membershipId: formData.get('membershipId'),
    role: formData.get('role'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const client = await clerkClient()

  // Find the target membership to get its userId.
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
  })
  const target = memberships.data.find((m) => m.id === parsed.data.membershipId)
  if (!target) return { error: 'Member not found.' }

  // Prevent self-role-change so the admin can't accidentally demote themselves.
  if (target.publicUserData?.userId === currentUserId) {
    return { error: 'You cannot change your own role.' }
  }

  // Prevent demoting the last admin.
  const admins = memberships.data.filter((m) => m.role === 'org:admin')
  if (target.role === 'org:admin' && parsed.data.role !== 'org:admin' && admins.length <= 1) {
    return { error: 'Cannot demote the last admin.' }
  }

  try {
    await client.organizations.updateOrganizationMembership({
      organizationId: orgId,
      userId: target.publicUserData?.userId!,
      role: parsed.data.role,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update role.'
    return { error: message }
  }

  revalidatePath('/settings/users')
  return { success: 'Role updated.' }
}

/** A normalized member row for the Users tab list. */
export type MemberRow = {
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
}
/** A normalized pending-invitation row for the Users tab list. */
export type InviteRow = { id: string; email: string; role: string }

const profileSchema = z.object({
  userId: z.string().min(1),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().max(500).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  membershipId: z.string().min(1).optional(),
  role: z.enum(ROLE_KEYS).optional(),
})

/** Upsert a team member's profile in the app-managed `team_profiles` table.
 *  Also updates the Clerk organization role if membershipId + role are provided.
 */
export async function saveProfile(_prevState: InviteState, formData: FormData): Promise<InviteState> {
  const { orgId, orgRole, userId: currentUserId } = await auth()
  if (!orgId) return { error: 'No active organization.' }
  if (orgRole !== 'org:admin') return { error: 'Only admins can edit profiles.' }

  // Convert empty strings to undefined so .optional() works correctly
  // (formData returns "" for empty fields, which zod .optional() rejects).
  const raw = {
    userId: formData.get('userId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    address: formData.get('address'),
    dateOfBirth: formData.get('dateOfBirth'),
    membershipId: formData.get('membershipId'),
    role: formData.get('role'),
  }
  const parsed = profileSchema.safeParse(
    Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v]),
    ),
  )
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const data = parsed.data
  const clean: Record<string, string | null> = {}
  if (data.firstName !== undefined) clean.firstName = data.firstName || null
  if (data.lastName !== undefined) clean.lastName = data.lastName || null
  if (data.phone !== undefined) clean.phone = normalizePhone(data.phone)
  if (data.email !== undefined) clean.email = data.email || null
  if (data.address !== undefined) clean.address = data.address || null
  if (data.dateOfBirth !== undefined) clean.dateOfBirth = data.dateOfBirth || null

  const client = await clerkClient()

  // ── Role update via Clerk (if provided) ───────────────────────────────────
  if (data.membershipId && data.role) {
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    })
    const target = memberships.data.find((m) => m.id === data.membershipId)
    if (!target) return { error: 'Member not found.' }

    // Prevent self-role-change
    if (target.publicUserData?.userId === currentUserId) {
      return { error: 'You cannot change your own role.' }
    }

    // Prevent demoting the last admin
    const admins = memberships.data.filter((m) => m.role === 'org:admin')
    if (target.role === 'org:admin' && data.role !== 'org:admin' && admins.length <= 1) {
      return { error: 'Cannot demote the last admin.' }
    }

    try {
      await client.organizations.updateOrganizationMembership({
        organizationId: orgId,
        userId: target.publicUserData?.userId!,
        role: data.role,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update role.'
      return { error: message }
    }
  }

  // ── Profile upsert in local DB ────────────────────────────────────────────
  try {
    await withTenant(orgId, async (tx) => {
      const existing = await tx
        .select({ id: teamProfiles.id })
        .from(teamProfiles)
        .where(eq(teamProfiles.userId, data.userId))
        .limit(1)

      if (existing.length > 0) {
        await tx
          .update(teamProfiles)
          .set({ ...clean, updatedAt: new Date() })
          .where(eq(teamProfiles.userId, data.userId))
      } else {
        await tx.insert(teamProfiles).values({
          tenantId: orgId,
          userId: data.userId,
          ...clean,
        })
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save profile.'
    return { error: message }
  }

  revalidatePath('/settings/users')
  return { success: 'Profile saved.' }
}

/** Read current org members + pending invitations for the active tenant.
 *  Display names come from the app-managed `team_profiles` table first,
 *  falling back to Clerk's public user data if no profile exists yet.
 */
export async function listOrgPeople(): Promise<{
  members: MemberRow[]
  pending: InviteRow[]
}> {
  const { orgId } = await auth()
  if (!orgId) return { members: [], pending: [] }

  const client = await clerkClient()

  const [memberships, invitations, dbProfiles] = await Promise.all([
    client.organizations.getOrganizationMembershipList({ organizationId: orgId }),
    client.organizations.getOrganizationInvitationList({
      organizationId: orgId,
      status: ['pending'],
    }),
    withTenant(orgId, async (tx) =>
      tx.select().from(teamProfiles).where(eq(teamProfiles.tenantId, orgId)),
    ),
  ])

  const profileMap = new Map(dbProfiles.map((p) => [p.userId, p]))

  const members: MemberRow[] = memberships.data.map((m) => {
    const userId = m.publicUserData?.userId ?? m.id
    const profile = profileMap.get(userId)
    const first = profile?.firstName ?? m.publicUserData?.firstName
    const last = profile?.lastName ?? m.publicUserData?.lastName
    const label =
      [first, last].filter(Boolean).join(' ') ||
      profile?.email ||
      m.publicUserData?.identifier ||
      'Member'

    return {
      id: m.id,
      userId,
      label,
      role: m.role,
      firstName: first ?? null,
      lastName: last ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? m.publicUserData?.identifier ?? null,
      address: profile?.address ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
    }
  })

  const pending: InviteRow[] = invitations.data.map((i) => ({
    id: i.id,
    email: i.emailAddress,
    role: i.role,
  }))

  return { members, pending }
}
