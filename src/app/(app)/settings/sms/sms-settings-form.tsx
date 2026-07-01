'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateCommunicationSettingsAction, updateTriggerAction } from '@/app/(app)/communications/actions'
import { triggerType } from '@/db/schema'

type Trigger = {
  id: string
  triggerType: string
  channel: string
  enabled: boolean
  subject: string | null
  footerText: string | null
}

const LABELS: Record<string, string> = {
  estimate_send: 'Send estimate',
  invoice_send: 'Send invoice',
  on_the_way: 'Technician on the way',
  appointment_reminder: 'Appointment reminder',
}

const DESCRIPTIONS: Record<string, string> = {
  estimate_send: 'Sent when a user clicks Send on an estimate (requires customer mobile consent).',
  invoice_send: 'Sent when a user clicks Send on an invoice (requires customer mobile consent).',
  on_the_way: 'Sent automatically when a job is transitioned to On The Way.',
  appointment_reminder: 'Sent automatically before a scheduled appointment if the customer opted in.',
}

export function SmsSettingsForm({
  orgId,
  initialTriggers,
  initialSmsPhoneNumber,
}: {
  orgId: string
  initialTriggers: Trigger[]
  initialSmsPhoneNumber: string | null
}) {
  const [phoneState, phoneAction, phonePending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const smsPhoneNumber = formData.get('smsPhoneNumber') as string
      return updateCommunicationSettingsAction(orgId, { smsPhoneNumber })
    },
    null,
  )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 duration-300">
      <Card>
        <CardHeader>
          <CardTitle>SMS sender number</CardTitle>
          <CardDescription>
            The Twilio phone number used to send customer text messages. Leave blank to use the account default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={phoneAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smsPhoneNumber">Twilio sender number</Label>
              <Input
                id="smsPhoneNumber"
                name="smsPhoneNumber"
                type="tel"
                defaultValue={initialSmsPhoneNumber ?? ''}
                placeholder="+1 555 123 4567"
              />
            </div>
            {phoneState?.error ? (
              <p role="alert" className="text-sm text-destructive">{phoneState.error}</p>
            ) : null}
            {phoneState?.success ? (
              <p role="status" className="text-sm text-emerald-600">Sender number saved.</p>
            ) : null}
            <Button type="submit" disabled={phonePending}>
              {phonePending ? 'Saving…' : 'Save sender number'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMS triggers</CardTitle>
          <CardDescription>
            Turn each automatic SMS on or off. Customer mobile consent is always required for marketing-style sends.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {initialTriggers.map((trigger) => (
            <TriggerRow key={trigger.id} orgId={orgId} trigger={trigger} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function TriggerRow({ orgId, trigger }: { orgId: string; trigger: Trigger }) {
  const [state, action, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const enabled = formData.get('enabled') === 'on'
      return updateTriggerAction(orgId, {
        triggerType: trigger.triggerType as (typeof triggerType.enumValues)[number],
        channel: 'sms',
        enabled,
      })
    },
    null,
  )

  return (
    <form action={action} className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{LABELS[trigger.triggerType] ?? trigger.triggerType}</h3>
        <p className="text-sm text-muted-foreground">
          {DESCRIPTIONS[trigger.triggerType] ?? trigger.triggerType}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input type="hidden" name="enabled" value="off" />
        <Switch
          id={`${trigger.triggerType}-sms-enabled`}
          name="enabled"
          defaultChecked={trigger.enabled}
          value="on"
        />
        <Label htmlFor={`${trigger.triggerType}-sms-enabled`} className="sr-only">
          Enable {LABELS[trigger.triggerType] ?? trigger.triggerType}
        </Label>
        <Button type="submit" size="sm" variant="outline" disabled={pending} className="ml-2">
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {state?.error ? (
        <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p role="status" className="w-full text-sm text-emerald-600">Saved.</p>
      ) : null}
    </form>
  )
}
