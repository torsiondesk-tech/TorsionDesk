'use server'

import { auth } from '@clerk/nextjs/server'
import { withTenant } from '@/db/with-tenant'
import { tenants } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { renderTemplate, findUnknownTags } from '@/lib/comms/template-render'
import { buildInvoiceContext } from '@/lib/comms/template-tags-context'
import { buildHtmlWrapper } from '@/lib/comms/send'

export async function previewTemplateAction(
  orgId: string,
  invoiceId: string,
  input: { subject?: string | null; bodyHtml?: string | null },
): Promise<{ subject: string; bodyHtml: string; unknownTags: string[] }> {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }

  return withTenant(orgId, async (tx) => {
    const ctx = await buildInvoiceContext(tx, orgId, invoiceId)
    const subject = input.subject ? renderTemplate(input.subject, ctx, 'text') : ''
    const renderedBody = input.bodyHtml ? renderTemplate(input.bodyHtml, ctx, 'html') : ''

    const [company] = await tx.select({ companyName: tenants.companyName }).from(tenants).where(eq(tenants.id, orgId))
    const companyName = company?.companyName ?? "Infantino's Garage Door Service"
    const bodyHtml = buildHtmlWrapper(companyName, renderedBody)

    const unknownTags = [
      ...findUnknownTags(input.subject ?? '', ctx),
      ...findUnknownTags(input.bodyHtml ?? '', ctx),
    ]

    return { subject, bodyHtml, unknownTags }
  })
}
