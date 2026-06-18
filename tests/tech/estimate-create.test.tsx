import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTechDb, type CachedCustomer, type CachedLocation } from '@/app/(tech)/lib/dexie'
import { enqueueOutboxItem, flushOutbox, type EstimateCreatePayload } from '@/app/(tech)/lib/sync'
import { EstimateForm } from '@/app/(tech)/components/estimate-form'

vi.mock('@/app/(tech)/lib/use-online', () => ({
  useOnline: () => false,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/app/(tech)/tech/estimates/actions', () => ({
  createEstimateAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { createEstimateAction } from '@/app/(tech)/tech/estimates/actions'

const orgId = 'org_estimate'
const userId = 'user_estimate'

describe('EstimateForm offline queue', () => {
  let db: ReturnType<typeof createTechDb>

  const customers: CachedCustomer[] = [
    {
      id: 'cust-1',
      tenantId: orgId,
      name: 'Alice Homeowner',
      accountNo: 1001,
      primaryPhone: null,
      primaryCity: null,
    },
  ]

  const locations: CachedLocation[] = [
    {
      id: 'loc-1',
      tenantId: orgId,
      customerId: 'cust-1',
      name: 'Main House',
      addressLine1: '123 Main St',
      addressLine2: null,
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: null,
      latitude: null,
      longitude: null,
      gated: false,
    },
  ]

  beforeEach(async () => {
    db = createTechDb(orgId)
    await db.open()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('enqueues an estimate_create item offline and flushes it via createEstimateAction', async () => {
    render(
      <EstimateForm
        orgId={orgId}
        userId={userId}
        initialCustomers={customers}
        initialLocations={locations}
      />,
    )

    await userEvent.selectOptions(screen.getByLabelText(/customer/i), 'cust-1')
    await userEvent.selectOptions(screen.getByLabelText(/service location/i), 'loc-1')
    await userEvent.type(screen.getByLabelText(/description/i), 'Spring replacement')

    await userEvent.click(screen.getByRole('button', { name: /add item/i }))
    await userEvent.type(screen.getByPlaceholderText(/item name/i), 'Torsion spring')
    await userEvent.type(screen.getByPlaceholderText(/qty/i), '2')
    await userEvent.type(screen.getByPlaceholderText(/price/i), '125.00')

    await userEvent.click(screen.getByRole('button', { name: /create estimate/i }))

    await waitFor(async () => {
      const items = await db.outbox.where('type').equals('estimate_create').toArray()
      expect(items).toHaveLength(1)
      const payload = items[0]?.payload as EstimateCreatePayload
      expect(payload.input.customerId).toBe('cust-1')
      expect(payload.input.serviceLocationId).toBe('loc-1')
      expect(payload.input.description).toBe('Spring replacement')
      expect(payload.input.lineItems).toHaveLength(1)
      expect(payload.input.lineItems[0]).toMatchObject({
        name: 'Torsion spring',
        qty: '2',
        unitPrice: '125.00',
      })
    })

    const mocked = vi.mocked(createEstimateAction)
    mocked.mockResolvedValue({ success: true, id: 'est-1' })

    await flushOutbox(orgId, userId)

    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        description: 'Spring replacement',
      }),
    )

    const item = await db.outbox.toArray()
    expect(item).toHaveLength(1)
    expect(item[0]?.syncStatus).toBe('synced')
  })
})