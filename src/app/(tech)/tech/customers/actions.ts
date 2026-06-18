'use server'

import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import { serviceLocations } from '@/db/schema'
import { listCustomers } from '@/lib/customers'

export async function listTechCustomersAction(orgId: string, _userId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }

  return listCustomers(orgId, { pageSize: 1000 })
}

export async function listTechServiceLocationsAction(orgId: string, _userId: string) {
  const { orgId: sessionOrgId } = await auth()
  if (!sessionOrgId || sessionOrgId !== orgId) {
    throw new Error('Unauthorized')
  }

  const rows = await withTenant(orgId, async (tx) => {
    return tx
      .select({
        id: serviceLocations.id,
        tenantId: serviceLocations.tenantId,
        customerId: serviceLocations.customerId,
        name: serviceLocations.name,
        addressLine1: serviceLocations.addressLine1,
        addressLine2: serviceLocations.addressLine2,
        city: serviceLocations.city,
        state: serviceLocations.state,
        postalCode: serviceLocations.postalCode,
        country: serviceLocations.country,
        latitude: serviceLocations.latitude,
        longitude: serviceLocations.longitude,
        gated: serviceLocations.gated,
      })
      .from(serviceLocations)
      .where(eq(serviceLocations.tenantId, orgId))
      .orderBy(serviceLocations.name)
  })
  return { rows }
}
