'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, asc } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '@/db/with-tenant'
import { communicationTemplates } from '@/db/schema'
import type { CommunicationTemplate } from '@/db/schema'
import { logger } from '@/lib/logger'

export type { CommunicationTemplate }

const templateInputSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['invoice', 'estimate', 'job', 'general']),
  channel: z.enum(['email', 'sms']).default('email'),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().max(10000).nullable().optional(),
  sortOrder: z.number().int().default(0),
})

export async function listTemplatesAction(
  orgId: string,
  category?: string,
): Promise<CommunicationTemplate[]> {
  try {
    return withTenant(orgId, async (tx) => {
      const conditions = [eq(communicationTemplates.tenantId, orgId)]
      if (category) conditions.push(eq(communicationTemplates.category, category))
      return tx
        .select()
        .from(communicationTemplates)
        .where(and(...conditions))
        .orderBy(asc(communicationTemplates.sortOrder), asc(communicationTemplates.createdAt))
    })
  } catch (err) {
    logger.error('listTemplatesAction', err)
    return []
  }
}

export async function createTemplateAction(
  orgId: string,
  input: z.infer<typeof templateInputSchema>,
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const parsed = templateInputSchema.parse(input)
    const result = await withTenant(orgId, async (tx) => {
      const [row] = await tx
        .insert(communicationTemplates)
        .values({
          tenantId: orgId,
          name: parsed.name,
          category: parsed.category,
          channel: parsed.channel,
          subject: parsed.subject ?? null,
          body: parsed.body ?? null,
          sortOrder: parsed.sortOrder,
        })
        .returning({ id: communicationTemplates.id })
      return row
    })
    revalidatePath('/settings/communication-templates')
    return { success: true, id: result?.id }
  } catch (err) {
    logger.error('createTemplateAction', err)
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export async function updateTemplateAction(
  orgId: string,
  id: string,
  input: Partial<z.infer<typeof templateInputSchema>>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const partial = templateInputSchema.partial().parse(input)
    await withTenant(orgId, async (tx) => {
      await tx
        .update(communicationTemplates)
        .set({ ...partial, updatedAt: new Date() })
        .where(and(eq(communicationTemplates.tenantId, orgId), eq(communicationTemplates.id, id)))
    })
    revalidatePath('/settings/communication-templates')
    return { success: true }
  } catch (err) {
    logger.error('updateTemplateAction', err)
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export async function deleteTemplateAction(
  orgId: string,
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await withTenant(orgId, async (tx) => {
      await tx
        .delete(communicationTemplates)
        .where(and(eq(communicationTemplates.tenantId, orgId), eq(communicationTemplates.id, id)))
    })
    revalidatePath('/settings/communication-templates')
    return { success: true }
  } catch (err) {
    logger.error('deleteTemplateAction', err)
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}
