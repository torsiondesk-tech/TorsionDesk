import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { groupJobsByDay } from '@/app/(tech)/lib/group-jobs'
import { JobListCard } from '@/app/(tech)/components/job-list-card'
import { parseCalendarDate, toISODate } from '@/lib/utils'
import type { JobRow } from '@/lib/jobs/jobs'

function makeRow(overrides: Partial<JobRow> & { startDate: Date }): JobRow {
  return {
    id: 'job-1',
    jobNo: 1001,
    customerId: 'cust-1',
    customerName: 'Alice',
    description: null,
    city: 'Chicago',
    category: null,
    priority: null,
    status: 'scheduled',
    createdAt: null,
    arrivalWindowStart: null,
    arrivalWindowEnd: null,
    ...overrides,
  }
}

describe('groupJobsByDay', () => {
  it('groups a job dated today under Today', () => {
    const today = toISODate(new Date())
    const row = makeRow({ id: 'j1', startDate: parseCalendarDate(today)! })
    const groups = groupJobsByDay([row], today)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Today')
    expect(groups[0]?.jobs[0]?.id).toBe('j1')
  })

  it('groups a job dated tomorrow under Tomorrow', () => {
    const today = parseCalendarDate(toISODate(new Date()))!
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const row = makeRow({ id: 'j2', startDate: tomorrow })
    const groups = groupJobsByDay([row], toISODate(today))
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Tomorrow')
  })

  it('groups a late-day local time under its local calendar day (no UTC shift)', () => {
    const todayISO = toISODate(new Date())
    const today = parseCalendarDate(todayISO)!
    const late = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 0)
    const row = makeRow({ id: 'j3', startDate: late })
    const groups = groupJobsByDay([row], todayISO)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Today')
    expect(groups[0]?.jobs[0]?.id).toBe('j3')
  })
})

describe('JobListCard', () => {
  it('renders customer name and status label', () => {
    const row = makeRow({ id: 'j4', customerName: 'Bob Smith', status: 'on_site', startDate: new Date() })
    render(<JobListCard job={row} />)
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('On Site')).toBeInTheDocument()
  })
})
