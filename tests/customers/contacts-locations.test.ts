/**
 * CUST-02 / CUST-03 — contact + location persistence (RED until src/lib/customers.ts exists).
 *
 * Contract: createContact persists billing/booking/SMS flags plus phone/email rows.
 * createLocation persists gated flag and full address.
 */

import { describe, it, expect, vi } from 'vitest'

const ORG_A = 'org_aaaa'

const auth = vi.fn(async () => ({ orgId: ORG_A }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => auth(),
}))

vi.mock('@/db/with-tenant', () => ({
  withTenant: vi.fn(async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: 'test-id' }]),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => {
          const whereResult = vi.fn(async () => [{ c: 1 }])
          whereResult.limit = vi.fn(async () => [{ id: 'cust_1' }])
          return { where: vi.fn(() => whereResult) }
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
    }
    return fn(tx)
  }),
}))

// Not-yet-existing module under test — RED signal.
import { createContact, createLocation } from '@/lib/customers'

describe('createContact', () => {
  it('persists contact with billing/booking/SMS flags', async () => {
    const result = await createContact(ORG_A, {
      customerId: 'cust_1',
      firstName: 'John',
      lastName: 'Doe',
      smsConsent: true,
      billingContact: true,
      bookingContact: false,
      phones: [{ number: '555-0100', type: 'cell', isPrimary: true }],
      emails: [{ address: 'john@example.com', type: 'work', isPrimary: true }],
    })
    expect(result).toBeDefined()
    expect(result.id).toBe('test-id')
  })
})

describe('createLocation', () => {
  it('persists location with gated flag and address', async () => {
    const result = await createLocation(ORG_A, {
      customerId: 'cust_1',
      name: 'Main Office',
      addressLine1: '123 Main St',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      gated: true,
    })
    expect(result).toBeDefined()
    expect(result.id).toBe('test-id')
  })
})
