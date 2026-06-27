import { eq, and } from 'drizzle-orm'
import { withTenant } from '@/db/with-tenant'
import {
  customers,
  contacts,
  serviceLocations,
  customerTags,
  customerEvents,
} from '@/db/schema'

export interface FieldChoices {
  [fieldName: string]: 'winner' | 'loser'
}

/**
 * Merge two customers: reassign all child FKs from loser → winner,
 * apply field-level winner choices, then archive (not delete) the loser.
 */
export async function mergeCustomers(
  orgId: string,
  winnerId: string,
  loserId: string,
  fieldChoices: FieldChoices,
): Promise<void> {
  if (winnerId === loserId) {
    throw new Error('Cannot merge a customer into itself')
  }

  return withTenant(orgId, async (tx) => {
    // Verify winner exists, is active, and not already merged into another record
    const [winnerRecord] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, winnerId)))
      .limit(1)
    if (!winnerRecord || !winnerRecord.active || winnerRecord.mergedInto) {
      throw new Error('Winner is not available for merge')
    }

    // Verify loser exists (inactive is fine — merging a deactivated duplicate is valid)
    const [loserRecord] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, loserId)))
      .limit(1)
    if (!loserRecord) {
      throw new Error('Loser record not found')
    }

    // Prevent circular merge chains (AN-002)
    if (loserRecord.mergedInto) {
      throw new Error('Cannot merge a record that has already been merged')
    }

    // 1. Reassign contacts
    await tx
      .update(contacts)
      .set({ customerId: winnerId })
      .where(and(eq(contacts.tenantId, orgId), eq(contacts.customerId, loserId)))

    // 2. Reassign service locations
    await tx
      .update(serviceLocations)
      .set({ customerId: winnerId })
      .where(
        and(eq(serviceLocations.tenantId, orgId), eq(serviceLocations.customerId, loserId)),
      )

    // 3. Handle customer_tags: delete loser tags that winner already has to avoid unique violation,
    //    then update remaining loser tags to winner.
    const loserTagRows = await tx
      .select({ tagId: customerTags.tagId })
      .from(customerTags)
      .where(
        and(eq(customerTags.tenantId, orgId), eq(customerTags.customerId, loserId)),
      )

    const winnerTagRows = await tx
      .select({ tagId: customerTags.tagId })
      .from(customerTags)
      .where(
        and(eq(customerTags.tenantId, orgId), eq(customerTags.customerId, winnerId)),
      )

    const winnerTagIds = new Set(winnerTagRows.map((r) => r.tagId))

    for (const row of loserTagRows) {
      if (winnerTagIds.has(row.tagId)) {
        // Delete duplicate
        await tx
          .delete(customerTags)
          .where(
            and(
              eq(customerTags.tenantId, orgId),
              eq(customerTags.customerId, loserId),
              eq(customerTags.tagId, row.tagId),
            ),
          )
      } else {
        // Reassign to winner
        await tx
          .update(customerTags)
          .set({ customerId: winnerId })
          .where(
            and(
              eq(customerTags.tenantId, orgId),
              eq(customerTags.customerId, loserId),
              eq(customerTags.tagId, row.tagId),
            ),
          )
      }
    }

    // 4. Reassign events
    await tx
      .update(customerEvents)
      .set({ customerId: winnerId })
      .where(
        and(eq(customerEvents.tenantId, orgId), eq(customerEvents.customerId, loserId)),
      )

    // 5. Reassign parent_customer_id references
    await tx
      .update(customers)
      .set({ parentCustomerId: winnerId })
      .where(
        and(
          eq(customers.tenantId, orgId),
          eq(customers.parentCustomerId, loserId),
        ),
      )

    // 6. Apply field-level winner choices
    if (winnerRecord && loserRecord) {
      const updates: Record<string, unknown> = {}
      const loserData = loserRecord as Record<string, unknown>
      for (const [field, choice] of Object.entries(fieldChoices)) {
        if (choice === 'loser') {
          updates[field] = loserData[field]
        }
        // choice === 'winner' means keep winner's value — no change
      }
      if (Object.keys(updates).length > 0) {
        await tx
          .update(customers)
          .set(updates)
          .where(and(eq(customers.tenantId, orgId), eq(customers.id, winnerId)))
      }
    }

    // 7. Archive the loser (never delete)
    await tx
      .update(customers)
      .set({
        active: false,
        archivedAt: new Date(),
        mergedInto: winnerId,
      })
      .where(and(eq(customers.tenantId, orgId), eq(customers.id, loserId)))
  })
}
