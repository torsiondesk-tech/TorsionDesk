import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const mockUpdateJobServiceLocation = vi.fn().mockResolvedValue({ success: true })
const mockCreateServiceLocationForJob = vi.fn().mockResolvedValue({ id: 'loc-new', error: undefined })

vi.mock('@/app/(app)/dispatch/actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(app)/dispatch/actions')>()
  return {
    ...actual,
    updateJobServiceLocation: (...args: unknown[]) => mockUpdateJobServiceLocation(...args),
    createServiceLocationForJob: (...args: unknown[]) => mockCreateServiceLocationForJob(...args),
    transitionJobStatusAction: vi.fn().mockResolvedValue({ success: true }),
  }
})

vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: ({
    onAddressSelect,
  }: {
    onAddressSelect?: (r: unknown) => void
    defaultValue?: string
  }) => (
    <input
      data-testid="address-autocomplete"
      placeholder="Start typing an address…"
      onChange={(e) => {
        if (e.target.value === 'autofill') {
          onAddressSelect?.({
            addressLine1: '789 New St',
            city: 'Orlando',
            state: 'FL',
            postalCode: '32801',
            country: 'USA',
            latitude: '28.5',
            longitude: '-81.4',
          })
        }
      }}
    />
  ),
}))

import { DispatchPopup } from '@/app/(app)/dispatch/popup/dispatch-popup'
import type { WeekJob, Technician, PopupData } from '@/app/(app)/dispatch/actions'

const techs: Technician[] = [
  { userId: 'u1', firstName: 'Joe', lastName: 'Tech', name: 'Joe Tech' },
]

const job: WeekJob = {
  id: 'j1',
  jobNo: 1001,
  status: 'in_progress',
  startDate: new Date(2026, 5, 16),
  endDate: null,
  customerName: 'Acme Corp',
  address: '123 Main St',
  arrivalWindowStart: null,
  arrivalWindowEnd: null,
  description: 'Fix spring',
  techIds: ['u1'],
}

const popupData: PopupData = {
  customerId: 'cust-1',
  serviceLocationId: 'loc-1',
  customerPhone: null,
  fullAddress: '123 Main St, Tampa, FL, 33602',
  notesForTechs: null,
  completionNotes: null,
  priority: null,
  estimatedDuration: null,
  poNumber: null,
  endDate: null,
  billingType: null,
  contactName: null,
  contactEmail: null,
  customerLocations: [
    {
      id: 'loc-1',
      name: 'Main Office',
      addressLine1: '123 Main St',
      addressLine2: null,
      city: 'Tampa',
      state: 'FL',
      postalCode: '33602',
      gated: false,
      isPrimary: true,
    },
    {
      id: 'loc-2',
      name: 'Warehouse',
      addressLine1: '456 Warehouse Rd',
      addressLine2: null,
      city: 'Tampa',
      state: 'FL',
      postalCode: '33603',
      gated: false,
      isPrimary: false,
    },
  ],
}

/** Find the Service Location section container and return within() helpers. */
function getLocationSection() {
  const label = screen.getByText('Service Location')
  const section = label.closest('.flex') as HTMLElement
  return within(section)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateJobServiceLocation.mockResolvedValue({ success: true })
  mockCreateServiceLocationForJob.mockResolvedValue({ id: 'loc-new', error: undefined })
})

describe('DispatchPopup — Service Location editor', () => {
  it('shows the address and [edit] link in display mode', () => {
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} popupData={popupData} />)
    expect(screen.getByText('123 Main St, Tampa, FL, 33602')).toBeInTheDocument()
    expect(getLocationSection().getByText('[edit]')).toBeInTheDocument()
  })

  it('opens the location select when [edit] is clicked', async () => {
    const user = userEvent.setup()
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} popupData={popupData} />)
    await user.click(getLocationSection().getByText('[edit]'))
    const section = getLocationSection()
    expect(section.getByRole('combobox')).toBeInTheDocument()
    expect(section.getByText('Save')).toBeInTheDocument()
    expect(section.getByText('Cancel')).toBeInTheDocument()
  })

  it('cancels and restores display mode', async () => {
    const user = userEvent.setup()
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} popupData={popupData} />)
    await user.click(getLocationSection().getByText('[edit]'))
    await user.click(getLocationSection().getByText('Cancel'))
    const section = getLocationSection()
    expect(section.queryByRole('combobox')).toBeNull()
    expect(section.getByText('[edit]')).toBeInTheDocument()
    expect(mockUpdateJobServiceLocation).not.toHaveBeenCalled()
  })

  it('calls updateJobServiceLocation when saving an existing selection', async () => {
    const user = userEvent.setup()
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} popupData={popupData} />)
    await user.click(getLocationSection().getByText('[edit]'))
    await user.click(getLocationSection().getByText('Save'))
    await waitFor(() =>
      expect(mockUpdateJobServiceLocation).toHaveBeenCalledWith({
        jobId: 'j1',
        serviceLocationId: 'loc-1',
      }),
    )
  })

  it('reveals the new address form when "+ Add new address…" is chosen', async () => {
    const user = userEvent.setup()
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} popupData={popupData} />)
    await user.click(getLocationSection().getByText('[edit]'))
    await user.click(getLocationSection().getByRole('combobox'))
    await user.click(screen.getByText('+ Add new address…'))
    expect(screen.getByTestId('address-autocomplete')).toBeInTheDocument()
    expect(getLocationSection().getByText('Save & Assign')).toBeInTheDocument()
    expect(getLocationSection().getByText('Back')).toBeInTheDocument()
  })

  it('Back button returns to the location select without saving', async () => {
    const user = userEvent.setup()
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} popupData={popupData} />)
    await user.click(getLocationSection().getByText('[edit]'))
    await user.click(getLocationSection().getByRole('combobox'))
    await user.click(screen.getByText('+ Add new address…'))
    await user.click(getLocationSection().getByText('Back'))
    expect(screen.queryByTestId('address-autocomplete')).toBeNull()
    expect(getLocationSection().getByRole('combobox')).toBeInTheDocument()
    expect(mockCreateServiceLocationForJob).not.toHaveBeenCalled()
  })

  it('calls createServiceLocationForJob when new address form is submitted', async () => {
    const user = userEvent.setup()
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} popupData={popupData} />)
    await user.click(getLocationSection().getByText('[edit]'))
    await user.click(getLocationSection().getByRole('combobox'))
    await user.click(screen.getByText('+ Add new address…'))
    // Trigger autocomplete fill via the mock
    await user.type(screen.getByTestId('address-autocomplete'), 'autofill')
    await user.click(getLocationSection().getByText('Save & Assign'))
    await waitFor(() =>
      expect(mockCreateServiceLocationForJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'j1',
          customerId: 'cust-1',
          addressLine1: '789 New St',
          city: 'Orlando',
          state: 'FL',
          postalCode: '32801',
        }),
      ),
    )
  })

  it('Save & Assign is disabled when street address is empty', async () => {
    const user = userEvent.setup()
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} popupData={popupData} />)
    await user.click(getLocationSection().getByText('[edit]'))
    await user.click(getLocationSection().getByRole('combobox'))
    await user.click(screen.getByText('+ Add new address…'))
    // No address typed — button should be disabled
    expect(getLocationSection().getByText('Save & Assign').closest('button')).toBeDisabled()
  })
})
