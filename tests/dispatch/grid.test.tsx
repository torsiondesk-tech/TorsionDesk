import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeekGrid } from '@/app/(app)/dispatch/grid/week-grid'
import type { WeekJob, Technician } from '@/app/(app)/dispatch/actions'

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ isOver: false, setNodeRef: vi.fn() }),
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), isDragging: false }),
}))

const techs: Technician[] = [
  { userId: 'u1', firstName: 'Alice', lastName: 'Smith', name: 'Alice Smith' },
  { userId: 'u2', firstName: 'Bob', lastName: 'Jones', name: 'Bob Jones' },
]

const weekDates = [
  new Date(2026, 5, 15),
  new Date(2026, 5, 16),
  new Date(2026, 5, 17),
  new Date(2026, 5, 18),
  new Date(2026, 5, 19),
  new Date(2026, 5, 20),
  new Date(2026, 5, 21),
]

describe('WeekGrid', () => {
  it('renders a row for each technician', () => {
    render(<WeekGrid technicians={techs} jobs={[]} weekDates={weekDates} />
    )
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('renders 7 day columns', () => {
    render(<WeekGrid technicians={techs} jobs={[]} weekDates={weekDates} />
    )
    expect(screen.getByText('Mon, 6/15')).toBeInTheDocument()
    expect(screen.getByText('Sun, 6/21')).toBeInTheDocument()
  })

  it('places jobs in the correct tech row and day column', () => {
    const jobs: WeekJob[] = [
      {
        id: 'j1',
        jobNo: 1042,
        status: 'scheduled',
        startDate: new Date(2026, 5, 16),
        endDate: null,
        customerName: "Infantino's Garage",
        address: '123 Main St',
        arrivalWindowStart: null,
        arrivalWindowEnd: null,
        description: 'Spring replacement',
        techIds: ['u1'],
      },
    ]
    render(<WeekGrid technicians={techs} jobs={jobs} weekDates={weekDates} />
    )
    expect(screen.getByText('#JOB-1042')).toBeInTheDocument()
    expect(screen.getByText("Infantino's Garage")).toBeInTheDocument()
  })
})
