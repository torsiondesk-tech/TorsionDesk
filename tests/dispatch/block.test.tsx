import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { JobBlock } from '@/app/(app)/dispatch/grid/job-block'
import type { WeekJob } from '@/app/(app)/dispatch/actions'

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
}))

const baseJob: WeekJob = {
  id: 'j1',
  jobNo: 1042,
  status: 'scheduled',
  startDate: new Date('2026-06-16'),
  endDate: null,
  customerName: "Infantino's Garage",
  address: '123 Main St',
  arrivalWindowStart: new Date('2026-06-16T08:00:00'),
  arrivalWindowEnd: new Date('2026-06-16T12:00:00'),
  description: 'Spring replacement and tune-up',
  techIds: ['u1'],
}

describe('JobBlock', () => {
  it('renders job number', () => {
    render(<JobBlock job={baseJob} />)
    expect(screen.getByText('#JOB-1042')).toBeInTheDocument()
  })

  it('renders customer name', () => {
    render(<JobBlock job={baseJob} />)
    expect(screen.getByText("Infantino's Garage")).toBeInTheDocument()
  })

  it('renders arrival window', () => {
    render(<JobBlock job={baseJob} />)
    expect(screen.getByText(/8:00 AM.*12:00 PM/)).toBeInTheDocument()
  })

  it('renders status badge', () => {
    render(<JobBlock job={baseJob} />)
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
  })

  it('truncates long description', () => {
    const longJob = { ...baseJob, description: 'A'.repeat(200) }
    const { container } = render(<JobBlock job={longJob} />)
    const desc = container.querySelector('.truncate')
    expect(desc).toBeTruthy()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<JobBlock job={baseJob} onClick={onClick} />)
    const block = screen.getByText('#JOB-1042').closest('div')!
    await act(async () => { block.click() })
    expect(onClick).toHaveBeenCalledWith(baseJob)
  })
})
