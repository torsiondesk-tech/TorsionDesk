import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { JobPool } from '@/app/(app)/dispatch/pool/job-pool'
import type { WeekJob, PoolCounts } from '@/app/(app)/dispatch/actions'

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
  useDroppable: () => ({ isOver: false, setNodeRef: vi.fn() }),
}))

const counts: PoolCounts = {
  unscheduled: 2,
  unassigned: 1,
  withOpenPOs: 0,
  partiallyCompleted: 1,
  paused: 0,
  markedForFollowUp: 0,
  total: 3, // j1 appears in both unscheduled + unassigned but counts once
}

const jobs: WeekJob[] = [
  {
    id: 'j1',
    jobNo: 1001,
    status: 'unscheduled',
    startDate: null,
    endDate: null,
    customerName: 'A',
    address: null,
    arrivalWindowStart: null,
    arrivalWindowEnd: null,
    description: 'Fix spring',
    techIds: [],
  },
  {
    id: 'j2',
    jobNo: 1002,
    status: 'unscheduled',
    startDate: null,
    endDate: null,
    customerName: 'B',
    address: null,
    arrivalWindowStart: null,
    arrivalWindowEnd: null,
    description: null,
    techIds: ['u1'],
  },
  {
    id: 'j3',
    jobNo: 1003,
    status: 'partially_completed',
    startDate: new Date(2026, 5, 16),
    endDate: null,
    customerName: 'C',
    address: null,
    arrivalWindowStart: null,
    arrivalWindowEnd: null,
    description: null,
    techIds: ['u1'],
  },
]

describe('JobPool', () => {
  it('renders tabs with counts', () => {
    render(<JobPool jobs={jobs} counts={counts} />)
    const allTab = screen.getByTestId('pool-tab-all')
    expect(allTab).toBeInTheDocument()
    expect(screen.getByTestId('pool-tab-unscheduled')).toBeInTheDocument()
    expect(allTab.textContent).toMatch(/3/) // All badge = total
  })

  it('shows the distinct job total, not the sum of overlapping classifications', () => {
    render(<JobPool jobs={jobs} counts={counts} />)
    // Bucket sum would be 2+1+0+1+0+0 = 4, but only 3 unique jobs are in the pool.
    expect(screen.getByText('3 total')).toBeInTheDocument()
  })

  it('shows all pool jobs by default', () => {
    render(<JobPool jobs={jobs} counts={counts} />)
    expect(screen.getByText('#JOB-1001')).toBeInTheDocument()
    expect(screen.getByText('#JOB-1002')).toBeInTheDocument()
    expect(screen.getByText('#JOB-1003')).toBeInTheDocument()
  })

  it('shows unscheduled jobs when the unscheduled tab is selected', async () => {
    render(<JobPool jobs={jobs} counts={counts} />)
    const tab = screen.getByTestId('pool-tab-unscheduled')
    await act(async () => { tab.click() })
    expect(screen.getByText('#JOB-1001')).toBeInTheDocument()
    expect(screen.getByText('#JOB-1002')).toBeInTheDocument()
    expect(screen.queryByText('#JOB-1003')).not.toBeInTheDocument()
  })

  it('switches to partially completed tab', async () => {
    render(<JobPool jobs={jobs} counts={counts} />)
    const tab = screen.getByTestId('pool-tab-partiallyCompleted')
    await act(async () => { tab.click() })
    expect(screen.getByText('#JOB-1003')).toBeInTheDocument()
    expect(screen.queryByText('#JOB-1001')).not.toBeInTheDocument()
  })

  it('calls onJobClick when a pool card is clicked', async () => {
    const onJobClick = vi.fn()
    render(<JobPool jobs={jobs} counts={counts} onJobClick={onJobClick} />)
    const card = screen.getByText('#JOB-1001').closest('div')!
    await act(async () => { card.click() })
    expect(onJobClick).toHaveBeenCalledWith(jobs[0])
  })
})
