import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listSmsTriggersAction } from '@/app/(app)/communications/actions'
import { SmsSettingsForm } from './sms-settings-form'

/**
 * SMS settings page (COMM-23).
 *
 * Server component loads the tenant's SMS triggers and sender number via
 * listSmsTriggersAction, which backfills defaults if needed, then renders the
 * client form that toggles triggers and updates the sender number.
 */
export default async function SmsSettingsPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const { triggers, settings } = await listSmsTriggersAction(orgId)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">SMS settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure automatic text messages and the Twilio sender number.
        </p>
      </div>
      <SmsSettingsForm
        orgId={orgId}
        initialTriggers={triggers}
        initialSmsPhoneNumber={settings.smsPhoneNumber}
      />
    </div>
  )
}
