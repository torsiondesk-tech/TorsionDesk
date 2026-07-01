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
import { Textarea } from '@/components/ui/textarea'
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
  job_confirmation: 'Job confirmation',
  tech_notify: 'Technician assignment notification',
  estimate_send: 'Send estimate',
  invoice_send: 'Send invoice',
  payment_receipt: 'Payment receipt',
}

const DESCRIPTIONS: Record<string, string> = {
  job_confirmation: 'Sent automatically to the customer when a new job is created.',
  tech_notify: 'Sent to assigned technicians when a job is assigned or reassigned.',
  estimate_send: 'Sent when a user clicks Send on an estimate.',
  invoice_send: 'Sent when a user clicks Send on an invoice.',
  payment_receipt: 'Sent automatically after a payment is recorded or received.',
}

export function EmailSettingsForm({
  orgId,
  initialTriggers,
  initialSenderName,
}: {
  orgId: string
  initialTriggers: Trigger[]
  initialSenderName: string | null
}) {
  const [senderState, senderAction, senderPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const emailSenderName = formData.get('emailSenderName') as string
      return updateCommunicationSettingsAction(orgId, { emailSenderName })
    },
    null,
  )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 duration-300">
      <Card>
        <CardHeader>
          <CardTitle>Email sender</CardTitle>
          <CardDescription>
            The display name used when sending customer emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={senderAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailSenderName">Sender name</Label>
              <Input
                id="emailSenderName"
                name="emailSenderName"
                defaultValue={initialSenderName ?? ''}
                placeholder="Infantino's Garage Door Service"
              />
            </div>
            {senderState?.error ? (
              <p role="alert" className="text-sm text-destructive">{senderState.error}</p>
            ) : null}
            {senderState?.success ? (
              <p role="status" className="text-sm text-emerald-600">Sender name saved.</p>
            ) : null}
            <Button type="submit" disabled={senderPending}>
              {senderPending ? 'Saving…' : 'Save sender name'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email triggers</CardTitle>
          <CardDescription>
            Turn each automatic email on or off. You can also customize the subject line and footer text.
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
      const subject = (formData.get('subject') as string) || undefined
      const footerText = (formData.get('footerText') as string) || undefined
      return updateTriggerAction(orgId, {
        triggerType: trigger.triggerType as (typeof triggerType.enumValues)[number],
        channel: 'email',
        enabled,
        subject,
        footerText,
      })
    },
    null,
  )

  return (
    <form action={action} className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{LABELS[trigger.triggerType] ?? trigger.triggerType}</h3>
          <p className="text-sm text-muted-foreground">
            {DESCRIPTIONS[trigger.triggerType] ?? trigger.triggerType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="hidden" name="enabled" value="off" />
          <Switch
            id={`${trigger.triggerType}-enabled`}
            name="enabled"
            defaultChecked={trigger.enabled}
            value="on"
          />
          <Label htmlFor={`${trigger.triggerType}-enabled`} className="sr-only">
            Enable {LABELS[trigger.triggerType] ?? trigger.triggerType}
          </Label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${trigger.triggerType}-subject`}>Subject line</Label>
          <Input
            id={`${trigger.triggerType}-subject`}
            name="subject"
            defaultValue={trigger.subject ?? ''}
            placeholder="Default subject"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${trigger.triggerType}-footer`}>Footer text</Label>
          <Textarea
            id={`${trigger.triggerType}-footer`}
            name="footerText"
            defaultValue={trigger.footerText ?? ''}
            placeholder="Footer text included in every email for this trigger"
          />
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p role="status" className="text-sm text-emerald-600">Saved.</p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save trigger'}
      </Button>
    </form>
  )
}
