import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  arrivalWindowStart: new Date(2026, 5, 16, 9, 0),
  arrivalWindowEnd: new Date(2026, 5, 16, 11, 0),
  description: 'Fix spring',
  techIds: ['u1'],
}

const popupData: PopupData = {
  customerId: 'cust-1',
  serviceLocationId: 'loc-1',
  customerPhone: '5551234567',
  fullAddress: '123 Main St, Suite 100, Tampa, FL, 33602',
  notesForTechs: 'Bring extension springs',
  completionNotes: null,
  priority: 'high',
  estimatedDuration: 2,
  poNumber: 'PO-42',
  endDate: null,
  billingType: 'single_invoice',
  contactName: 'Johann Oro',
  contactEmail: 'johannoro@gmail.com',
  customerLocations: [
    { id: 'loc-1', name: 'Main Office', addressLine1: '123 Main St', addressLine2: null, city: 'Tampa', state: 'FL', postalCode: '33602', gated: false, isPrimary: true },
    { id: 'loc-2', name: 'Warehouse', addressLine1: '456 Warehouse Rd', addressLine2: null, city: 'Tampa', state: 'FL', postalCode: '33603', gated: false, isPrimary: false },
  ],
}

describe('DispatchPopup', () => {
  it('does not render when job is null', () => {
    const { container } = render(
      <DispatchPopup job={null} techs={techs} open={true} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders header title with job number', () => {
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Detailed Job View (#1001)')).toBeInTheDocument()
  })

  it('renders customer name and status badge', () => {
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} />)
    expect(screen.getByText("Acme Corp's Current")).toBeInTheDocument()
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1)
  })

  it('renders sidebar action buttons', () => {
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Dispatch')).toBeInTheDocument()
    expect(screen.getByText('View Details')).toBeInTheDocument()
    expect(screen.getByText('Make Changes')).toBeInTheDocument()
    expect(screen.getByText('Exit')).toBeInTheDocument()
  })

  it('renders arrival window', () => {
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} />)
    expect(screen.getByText(/9:00 AM.*to.*11:00 AM/)).toBeInTheDocument()
  })

  it('renders assigned tech name', () => {
    render(<DispatchPopup job={job} techs={techs} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Joe Tech')).toBeInTheDocument()
  })

  it('renders popupData phone, address, and notes', () => {
    render(
      <DispatchPopup
        job={job}
        techs={techs}
        open={true}
        onClose={vi.fn()}
        popupData={popupData}
      />,
    )
    expect(screen.getByText('(555) 123-4567 (Mobile)')).toBeInTheDocument()
    expect(screen.getByText('johannoro@gmail.com')).toBeInTheDocument()
    expect(screen.getByText('123 Main St, Suite 100, Tampa, FL, 33602')).toBeInTheDocument()
    expect(screen.getByText('Bring extension springs')).toBeInTheDocument()
  })

  it('renders PO number and billing type from popupData', () => {
    render(
      <DispatchPopup
        job={job}
        techs={techs}
        open={true}
        onClose={vi.fn()}
        popupData={popupData}
      />,
    )
    expect(screen.getByText('PO-42')).toBeInTheDocument()
    expect(screen.getByText('Single Invoice')).toBeInTheDocument()
  })

  it('renders estimated duration with h suffix', () => {
    render(
      <DispatchPopup
        job={job}
        techs={techs}
        open={true}
        onClose={vi.fn()}
        popupData={popupData}
      />,
    )
    expect(screen.getByText('2h')).toBeInTheDocument()
  })
})
