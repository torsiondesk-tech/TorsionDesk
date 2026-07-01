import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listTemplatesAction } from './actions'
import { TemplatesClient } from './templates-client'

export default async function CommunicationTemplatesPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const templates = await listTemplatesAction(orgId)

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h2 className="text-lg font-semibold">Communication templates</h2>
        <p className="text-sm text-muted-foreground">
          Reusable email and SMS templates selectable when sending invoices, estimates, and job notifications.
        </p>
      </div>
      <TemplatesClient orgId={orgId} initialTemplates={templates} />
    </div>
  )
}
