'use server'

import { auth } from '@clerk/nextjs/server'
import { eq, and } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  contacts,
  contactPhones,
  contactEmails,
  jobCategories,
  referralSources,
  taxItems,
  tags,
  salesReps,
} from '@/db/schema'
import { listJobCategories, listTaxItems, listOrgMembers } from '@/app/(app)/jobs/actions'
import { listReferralSources, listTags } from '@/lib/tags'
import { listSalesReps } from '@/lib/settings'
import { listProductCategories } from '@/lib/catalog'

export async function listTechContactsAction(orgId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }

  return withTenant(orgId, async (tx) => {
    const contactRows = await tx
      .select({
        id: contacts.id,
        tenantId: contacts.tenantId,
        customerId: contacts.customerId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        jobTitle: contacts.jobTitle,
      })
      .from(contacts)
      .where(eq(contacts.tenantId, orgId))

    const phoneRows = await tx
      .select({ contactId: contactPhones.contactId, number: contactPhones.number })
      .from(contactPhones)
      .where(and(eq(contactPhones.tenantId, orgId), eq(contactPhones.isPrimary, true)))

    const emailRows = await tx
      .select({ contactId: contactEmails.contactId, address: contactEmails.address })
      .from(contactEmails)
      .where(and(eq(contactEmails.tenantId, orgId), eq(contactEmails.isPrimary, true)))

    const phonesByContactId = new Map(phoneRows.map((p) => [p.contactId, p.number]))
    const emailsByContactId = new Map(emailRows.map((e) => [e.contactId, e.address]))

    return {
      rows: contactRows.map((c) => ({
        id: c.id,
        tenantId: c.tenantId,
        customerId: c.customerId,
        firstName: c.firstName,
        lastName: c.lastName,
        jobTitle: c.jobTitle,
        primaryPhone: phonesByContactId.get(c.id) ?? null,
        primaryEmail: emailsByContactId.get(c.id) ?? null,
      })),
    }
  })
}

export async function listTechJobCategoriesAction(orgId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }
  return { rows: await listJobCategories(orgId) }
}

export async function listTechReferralSourcesAction(orgId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }
  return { rows: await listReferralSources(orgId) }
}

export async function listTechTaxItemsAction(orgId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }
  return { rows: await listTaxItems(orgId) }
}

export async function listTechTagsAction(orgId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }
  return { rows: await listTags(orgId) }
}

export async function listTechOrgMembersAction(orgId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }
  return { rows: await listOrgMembers(orgId) }
}

export async function listTechSalesRepsAction(orgId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }
  return { rows: await listSalesReps(orgId) }
}

export async function listTechProductCategoriesAction(orgId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }
  return { rows: await listProductCategories(orgId) }
}
