import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listEmailTriggersAction } from '@/app/(app)/communications/actions'
import { EmailSettingsForm } from './email-settings-form'

/**
 * Email settings page (COMM-22).
 *
 * Server component loads the tenant's email triggers and sender name via
 * listEmailTriggersAction, which backfills defaults if needed, then renders
 * the client form that toggles triggers and updates the sender name.
 */
export default async function EmailSettingsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const { triggers, settings } = await listEmailTriggersAction(orgId)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Email settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure automatic customer emails and the sender name shown in inboxes.
        </p>
      </div>
      <EmailSettingsForm
        orgId={orgId}
        initialTriggers={triggers}
        initialSenderName={settings.emailSenderName}
      />
    </div>
  )
}
