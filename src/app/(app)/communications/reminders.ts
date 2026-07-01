import { eq, and, isNull } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import { scheduledSms, jobs, tenants } from '@/db/schema'
import { resolveSmsRecipient } from './recipients'
import { logger } from '@/lib/logger'

function buildReminderMessage(startInstant: Date, companyName: string | null): string {
  const when = startInstant.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const company = companyName ?? "Infantino's Garage Door Service"
  return `Reminder: your garage door service is scheduled for ${when}. — ${company}`
}

export async function scheduleAppointmentReminder(
  orgId: string,
  jobId: string,
  leadHours: number | null | undefined,
): Promise<void> {
  return withTenant(orgId, async (tx) => {
    const [job] = await tx
      .select({
        arrivalWindowStart: jobs.arrivalWindowStart,
        startDate: jobs.startDate,
        customerId: jobs.customerId,
      })
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))

    if (!job) {
      logger.error('scheduleAppointmentReminder: job not found', { orgId, jobId })
      return
    }

    const startValue = job.arrivalWindowStart ?? job.startDate
    if (!startValue || !leadHours || leadHours <= 0) {
      await cancelPendingRemindersTx(tx, orgId, jobId)
      return
    }

    const startInstant = typeof startValue === 'string' ? new Date(startValue) : startValue
    if (isNaN(startInstant.getTime())) {
      await cancelPendingRemindersTx(tx, orgId, jobId)
      return
    }

    const recipient = await resolveSmsRecipient(tx, orgId, 'job', jobId)
    if (!recipient) {
      await cancelPendingRemindersTx(tx, orgId, jobId)
      return
    }

    const fireAt = new Date(startInstant.getTime() - leadHours * 60 * 60 * 1000)

    const [company] = await tx
      .select({ companyName: tenants.companyName })
      .from(tenants)
      .where(eq(tenants.id, orgId))

    const messageBody = buildReminderMessage(startInstant, company?.companyName ?? null)

    const [existing] = await tx
      .select({ id: scheduledSms.id })
      .from(scheduledSms)
      .where(
        and(
          eq(scheduledSms.tenantId, orgId),
          eq(scheduledSms.jobId, jobId),
          isNull(scheduledSms.sentAt),
          isNull(scheduledSms.cancelledAt),
        ),
      )

    if (existing) {
      await tx
        .update(scheduledSms)
        .set({
          contactId: recipient.contactId,
          phone: recipient.phone,
          messageBody,
          fireAt,
          errorMessage: null,
        })
        .where(and(eq(scheduledSms.tenantId, orgId), eq(scheduledSms.id, existing.id)))
    } else {
      await tx.insert(scheduledSms).values({
        tenantId: orgId,
        jobId,
        contactId: recipient.contactId,
        phone: recipient.phone,
        messageBody,
        fireAt,
      })
    }
  })
}

async function cancelPendingRemindersTx(tx: any, tenantId: string, jobId: string): Promise<void> {
  await tx
    .update(scheduledSms)
    .set({ cancelledAt: new Date() })
    .where(
      and(
        eq(scheduledSms.tenantId, tenantId),
        eq(scheduledSms.jobId, jobId),
        isNull(scheduledSms.sentAt),
        isNull(scheduledSms.cancelledAt),
      ),
    )
}

export async function cancelAppointmentReminders(orgId: string, jobId: string): Promise<void> {
  return withTenant(orgId, async (tx) => {
    await cancelPendingRemindersTx(tx, orgId, jobId)
  })
}

export async function getReminderLeadHoursForJob(
  orgId: string,
  jobId: string,
): Promise<number | null> {
  return withTenant(orgId, async (tx) => {
    const [job] = await tx
      .select({ arrivalWindowStart: jobs.arrivalWindowStart, startDate: jobs.startDate })
      .from(jobs)
      .where(and(eq(jobs.tenantId, orgId), eq(jobs.id, jobId)))

    const startValue = job?.arrivalWindowStart ?? job?.startDate
    if (!startValue) return null

    const startInstant = typeof startValue === 'string' ? new Date(startValue) : startValue
    if (isNaN(startInstant.getTime())) return null

    const [row] = await tx
      .select({ fireAt: scheduledSms.fireAt })
      .from(scheduledSms)
      .where(
        and(
          eq(scheduledSms.tenantId, orgId),
          eq(scheduledSms.jobId, jobId),
          isNull(scheduledSms.sentAt),
          isNull(scheduledSms.cancelledAt),
        ),
      )

    if (!row?.fireAt) return null
    const fireAt = typeof row.fireAt === 'string' ? new Date(row.fireAt) : row.fireAt
    if (isNaN(fireAt.getTime())) return null

    const leadMs = startInstant.getTime() - fireAt.getTime()
    return Math.round(leadMs / (60 * 60 * 1000))
  })
}
