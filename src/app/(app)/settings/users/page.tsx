import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { auth } from '@clerk/nextjs/server'
import { listOrgPeople } from './actions'
import { InviteForm } from './invite-form'
import { MemberRow, PendingRow } from './user-rows'

/**
 * Users settings page (AUTH-02, D-06).
 *
 * Server component: reads the active org's members + pending invitations via the
 * Clerk backend SDK (`listOrgPeople`), renders the invite-by-email form (client),
 * and lists current members and any pending invites with their roles. Inviting a
 * teammate goes through Clerk's built-in organization invitation system — no
 * custom token table, no Resend (D-06).
 */

export default async function UsersPage() {
  const { userId: currentUserId } = await auth()
  const { members, pending } = await listOrgPeople()

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 duration-300">
      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>
            Enter an email and pick a role. Clerk sends the invitation and handles
            the sign-up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>
            {members.length} member{members.length === 1 ? '' : 's'} in this
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="divide-y divide-foreground/10">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  id={m.id}
                  userId={m.userId}
                  label={m.label}
                  role={m.role}
                  firstName={m.firstName}
                  lastName={m.lastName}
                  phone={m.phone}
                  email={m.email}
                  address={m.address}
                  dateOfBirth={m.dateOfBirth}
                  currentUserId={currentUserId}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
          <CardDescription>
            Invites that have been sent but not yet accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending invitations.
            </p>
          ) : (
            <ul className="divide-y divide-foreground/10">
              {pending.map((i) => (
                <PendingRow key={i.id} id={i.id} email={i.email} role={i.role} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
