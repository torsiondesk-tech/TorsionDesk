import { eq, and } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  estimates,
  estimateLineItems,
  lineItemGroups,
  customers,
  serviceLocations,
  tenants,
} from '@/db/schema'

export interface EstimatePdfData {
  estimateNo: number
  companyName: string | null
  companyAddress: string | null
  companyPhone: string | null
  companyEmail: string | null
  customerName: string | null
  serviceAddress: string | null
  description: string | null
  notes: string | null
  expiryDate: string | null
  createdAt: string
  groups: {
    id: string | null
    name: string | null
    items: {
      description: string | null
      qty: string
      rate: string
      total: string
    }[]
  }[]
  grandTotal: string
}

export async function getEstimateForPdf(
  orgId: string,
  estimateId: string,
): Promise<EstimatePdfData | null> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        estimate: estimates,
        customerName: customers.name,
        locationAddress: serviceLocations.addressLine1,
        locationCity: serviceLocations.city,
        locationState: serviceLocations.state,
        locationPostalCode: serviceLocations.postalCode,
        companyName: tenants.companyName,
        companyAddress: tenants.address,
        companyPhone: tenants.phone,
        companyEmail: tenants.email,
      })
      .from(estimates)
      .leftJoin(customers, and(eq(customers.tenantId, estimates.tenantId), eq(customers.id, estimates.customerId)))
      .leftJoin(
        serviceLocations,
        and(
          eq(serviceLocations.tenantId, estimates.tenantId),
          eq(serviceLocations.id, estimates.serviceLocationId),
        ),
      )
      .leftJoin(tenants, eq(tenants.id, estimates.tenantId))
      .where(and(eq(estimates.tenantId, orgId), eq(estimates.id, estimateId)))
      .limit(1)

    if (!rows[0]) return null
    const { estimate, ...joined } = rows[0]

    const [lineItems, groups] = await Promise.all([
      tx
        .select()
        .from(estimateLineItems)
        .where(and(eq(estimateLineItems.tenantId, orgId), eq(estimateLineItems.estimateId, estimateId)))
        .orderBy(estimateLineItems.sortOrder),
      tx
        .select()
        .from(lineItemGroups)
        .where(and(eq(lineItemGroups.tenantId, orgId), eq(lineItemGroups.estimateId, estimateId)))
        .orderBy(lineItemGroups.sortOrder),
    ])

    const toMoney = (cents: number) => (cents / 100).toFixed(2)
    const toCents = (s: string | null) => Math.round(parseFloat(s ?? '0') * 100) || 0

    // Group line items: first by explicit group, then ungrouped in a synthetic group.
    const groupMap = new Map<string | null, EstimatePdfData['groups'][number]>()

    for (const g of groups) {
      groupMap.set(g.id, { id: g.id, name: g.name, items: [] })
    }

    let ungrouped: EstimatePdfData['groups'][number] | null = null

    let grandTotalCents = 0
    for (const li of lineItems) {
      const qty = parseFloat(li.qty ?? '0') || 0
      const rateCents = toCents(li.rate)
      const totalCents = Math.round(rateCents * qty)
      grandTotalCents += totalCents

      const item = {
        description: li.description,
        qty: li.qty ?? '0',
        rate: toMoney(rateCents),
        total: toMoney(totalCents),
      }

      if (li.groupId && groupMap.has(li.groupId)) {
        groupMap.get(li.groupId)!.items.push(item)
      } else {
        if (!ungrouped) {
          ungrouped = { id: null, name: null, items: [] }
        }
        ungrouped.items.push(item)
      }
    }

    const pdfGroups: EstimatePdfData['groups'] = []
    if (ungrouped && ungrouped.items.length > 0) {
      pdfGroups.push(ungrouped)
    }
    for (const g of groups) {
      const group = groupMap.get(g.id)
      if (group && group.items.length > 0) {
        pdfGroups.push(group)
      }
    }

    const serviceAddress = joined.locationAddress
      ? `${joined.locationAddress}${joined.locationCity ? `, ${joined.locationCity}` : ''}${joined.locationState ? ` ${joined.locationState}` : ''}${joined.locationPostalCode ? ` ${joined.locationPostalCode}` : ''}`
      : null

    return {
      estimateNo: estimate.estimateNo,
      companyName: joined.companyName ?? null,
      companyAddress: joined.companyAddress ?? null,
      companyPhone: joined.companyPhone ?? null,
      companyEmail: joined.companyEmail ?? null,
      customerName: joined.customerName ?? null,
      serviceAddress,
      description: estimate.description,
      notes: estimate.notes,
      expiryDate: estimate.expiryDate ? estimate.expiryDate : null,
      createdAt: estimate.createdAt ? estimate.createdAt.toISOString() : '',
      groups: pdfGroups,
      grandTotal: toMoney(grandTotalCents),
    }
  })
}
