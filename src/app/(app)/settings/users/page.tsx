import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { listOrgPeople } from './actions'
import { InviteForm } from './invite-form'

/**
 * Users settings page (AUTH-02, D-06).
 *
 * Server component: reads the active org's members + pending invitations via the
 * Clerk backend SDK (`listOrgPeople`), renders the invite-by-email form (client),
 * and lists current members and any pending invites with their roles. Inviting a
 * teammate goes through Clerk's built-in organization invitation system — no
 * custom token table, no Resend (D-06).
 */

// Pretty-print a Clerk org-role key for display.
function roleLabel(key: string): string {
  const map: Record<string, string> = {
    'org:admin': 'Admin',
    'org:dispatcher': 'Dispatcher',
    'org:technician': 'Technician',
  }
  return map[key] ?? key
}

export default async function UsersPage() {
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
                <li
                  key={m.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="truncate">{m.label}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {roleLabel(m.role)}
                  </span>
                </li>
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
                <li
                  key={i.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="truncate">{i.email}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {roleLabel(i.role)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
