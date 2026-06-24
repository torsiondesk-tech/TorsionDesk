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

vi.mock('@/app/(app)/jobs/actions', () => ({
  searchProductsAction: vi.fn(() => Promise.resolve([])),
  searchServicesAction: vi.fn(() => Promise.resolve([])),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { createEstimateAction } from '@/app/(tech)/tech/estimates/actions'
import { toast } from 'sonner'

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

  it('enqueues an estimate_create item offline and flushes it via createEstimateAction', { timeout: 15000 }, async () => {
    const mocked = vi.mocked(createEstimateAction)
    mocked.mockResolvedValue({ success: true, id: 'est-1' })

    render(
      <EstimateForm
        orgId={orgId}
        userId={userId}
        initialCustomers={customers}
        initialLocations={locations}
      />,
    )

    // Select existing customer via search dropdown
    await userEvent.type(screen.getByTestId('customer-search'), 'Alice')
    const suggestion = await screen.findByText('Alice Homeowner')
    await userEvent.click(suggestion)

    // Select service location
    const locationTrigger = screen.getByRole('combobox', { name: /service location/i })
    await userEvent.click(locationTrigger)
    const locOption = screen.getByRole('option', { name: /main house/i })
    await userEvent.click(locOption)

    // Fill description
    await userEvent.type(screen.getByLabelText('Description'), 'Spring replacement')

    // Add a custom line item
    await userEvent.click(screen.getByRole('button', { name: /add item/i }))
    await userEvent.type(screen.getByPlaceholderText(/search products/i), 'Torsion')
    await userEvent.click(screen.getByTestId('add-custom-item'))

    await userEvent.clear(screen.getByRole('textbox', { name: /product name/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /product name/i }), 'Torsion spring')
    await userEvent.clear(screen.getByRole('spinbutton', { name: /product quantity/i }))
    await userEvent.type(screen.getByRole('spinbutton', { name: /product quantity/i }), '2')
    await userEvent.clear(screen.getByRole('textbox', { name: /product rate/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /product rate/i }), '125.00')
    await userEvent.click(screen.getByRole('button', { name: /add product/i }))

    // Submit — the form auto-flushes the outbox while offline.
    await userEvent.click(screen.getByRole('button', { name: /create estimate/i }))

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('Queued estimate — will sync when online')
    })

    const items = await db.outbox.where('type').equals('estimate_create').toArray()
    expect(items).toHaveLength(1)
    const payload = items[0]?.payload as EstimateCreatePayload
    expect(payload.input.customerId).toBe('cust-1')
    expect(payload.input.serviceLocationId).toBe('loc-1')
    expect(payload.input.description).toBe('Spring replacement')
    expect(payload.input.lineItems).toBeDefined()
    expect(payload.input.lineItems).toHaveLength(1)
    expect(payload.input.lineItems![0]).toMatchObject({
      title: 'Torsion spring',
      qty: '2',
      rate: '125.00',
    })

    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        description: 'Spring replacement',
      }),
    )

    expect(items[0]?.syncStatus).toBe('synced')
  })
})
